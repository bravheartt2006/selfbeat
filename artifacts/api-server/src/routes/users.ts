import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import {
  db,
  selfbeatUsersTable,
  selfbeatFingerprintsTable,
  selfbeatUserHistoryTable,
} from "@workspace/db";
import { apiRateLimiter } from "../middlewares/rateLimiter";
import { sendTrialReminderEmail, sendTrialExpiryEmail } from "../lib/email";

const router = Router();

export function requireAuth(req: any, res: any, next: any) {
  const userId = (req.session as any)?.userId || (req.user as any)?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

function computeTrialFields(user: typeof selfbeatUsersTable.$inferSelect) {
  const now = new Date();
  const isOnActiveTrial =
    user.trialUsed &&
    user.trialStartDate !== null &&
    user.trialEndDate !== null &&
    user.trialEndDate > now;

  const trialExpiredRecently =
    user.trialUsed &&
    user.trialEndDate !== null &&
    user.trialEndDate <= now &&
    now.getTime() - user.trialEndDate.getTime() < 24 * 60 * 60 * 1000;

  return {
    isOnActiveTrial: !!isOnActiveTrial,
    trialEndDate: user.trialEndDate ? user.trialEndDate.toISOString() : null,
    trialExpiredRecently: !!trialExpiredRecently,
  };
}

async function maybeFireTrialEmails(user: typeof selfbeatUsersTable.$inferSelect) {
  if (!user.trialUsed || !user.trialEndDate) return;
  const now = new Date();
  const msLeft = user.trialEndDate.getTime() - now.getTime();

  // Trial is over — send expiry email once
  if (msLeft <= 0 && !user.trialExpirySent && user.email) {
    await db
      .update(selfbeatUsersTable)
      .set({ trialExpirySent: true })
      .where(eq(selfbeatUsersTable.id, user.id));
    sendTrialExpiryEmail(user.email, user.displayName, "WELCOME_BACK").catch(() => {});
    return;
  }

  // Within 24h of expiry — send reminder once
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
  if (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000 && !user.trialReminderSent && user.email) {
    await db
      .update(selfbeatUsersTable)
      .set({ trialReminderSent: true })
      .where(eq(selfbeatUsersTable.id, user.id));
    sendTrialReminderEmail(user.email, user.displayName, hoursLeft).catch(() => {});
  }
}

// Register fingerprint + get/refresh user state — called after sign-in
router.post("/me", requireAuth, async (req: any, res) => {
  const { userId } = req;
  const { fingerprint } = req.body as { fingerprint?: string };

  try {
    const existing = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({ error: "User not found" });
    }

    let user = existing[0];
    let deviceCreditBlocked = false;

    if (fingerprint) {
      const otherAccounts = await db
        .select({ userId: selfbeatFingerprintsTable.userId })
        .from(selfbeatFingerprintsTable)
        .where(
          sql`${selfbeatFingerprintsTable.fingerprintId} = ${fingerprint}
              AND ${selfbeatFingerprintsTable.userId} != ${userId}`
        )
        .limit(1);

      if (otherAccounts.length > 0 && user.credits > 0) {
        await db
          .update(selfbeatUsersTable)
          .set({ credits: 0 })
          .where(eq(selfbeatUsersTable.id, userId));
        user = { ...user, credits: 0 };
        deviceCreditBlocked = true;
      }

      await db
        .insert(selfbeatFingerprintsTable)
        .values({ fingerprintId: fingerprint, userId })
        .onConflictDoNothing();
    }

    // Fire trial emails if needed (fire-and-forget)
    maybeFireTrialEmails(user).catch(() => {});

    const isUnlimited =
      user.hasUnlimited &&
      (!user.unlimitedUntil || user.unlimitedUntil > new Date());

    return res.json({
      ...user,
      isUnlimited,
      deviceCreditBlocked,
      ...computeTrialFields(user),
    });
  } catch (err) {
    console.error("Error in /users/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user's credit balance (also returns trial state)
router.get(
  "/me/credits",
  requireAuth,
  apiRateLimiter,
  async (req: any, res) => {
    const { userId } = req;
    try {
      const rows = await db
        .select()
        .from(selfbeatUsersTable)
        .where(eq(selfbeatUsersTable.id, userId))
        .limit(1);

      if (!rows.length) return res.json({ credits: 0, isUnlimited: false, isOnActiveTrial: false });
      const user = rows[0];

      // Fire trial emails opportunistically
      maybeFireTrialEmails(user).catch(() => {});

      const isUnlimited =
        user.hasUnlimited &&
        (!user.unlimitedUntil || user.unlimitedUntil > new Date());

      return res.json({
        credits: user.credits,
        isUnlimited,
        ...computeTrialFields(user),
      });
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get current user's comparison history
// Free users: last 5 entries  |  Pro/unlimited users: last 50
router.get("/me/history", requireAuth, apiRateLimiter, async (req: any, res) => {
  const { userId } = req;
  try {
    const userRows = await db
      .select({ hasUnlimited: selfbeatUsersTable.hasUnlimited, planType: selfbeatUsersTable.planType })
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    const isPro = userRows[0]?.hasUnlimited || !!userRows[0]?.planType;
    const limit = isPro ? 50 : 5;

    const rows = await db
      .select()
      .from(selfbeatUserHistoryTable)
      .where(eq(selfbeatUserHistoryTable.userId, userId))
      .orderBy(desc(selfbeatUserHistoryTable.createdAt))
      .limit(limit + 1); // fetch one extra to know if there's more

    const hasMore = rows.length > limit;
    const history = rows.slice(0, limit).map((r) => ({
      id: r.id,
      comparisonId: r.comparisonId,
      question: r.question,
      winner: r.winner,
      createdAt: r.createdAt,
    }));

    return res.json({ history, isPro, hasMore });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
