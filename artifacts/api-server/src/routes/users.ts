import { Router } from "express";
import { eq, ne, sql } from "drizzle-orm";
import {
  db,
  selfbeatUsersTable,
  selfbeatFingerprintsTable,
} from "@workspace/db";
import { apiRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

export function requireAuth(req: any, res: any, next: any) {
  const userId = (req.session as any)?.userId || (req.user as any)?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
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
      // Check if another account already used credits from this device
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

      // Track fingerprint for this user (upsert)
      await db
        .insert(selfbeatFingerprintsTable)
        .values({ fingerprintId: fingerprint, userId })
        .onConflictDoNothing();
    }

    const isUnlimited =
      user.hasUnlimited &&
      (!user.unlimitedUntil || user.unlimitedUntil > new Date());

    return res.json({ ...user, isUnlimited, deviceCreditBlocked });
  } catch (err) {
    console.error("Error in /users/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user's credit balance
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

      if (!rows.length) return res.json({ credits: 0, isUnlimited: false });
      const user = rows[0];
      const isUnlimited =
        user.hasUnlimited &&
        (!user.unlimitedUntil || user.unlimitedUntil > new Date());
      return res.json({ credits: user.credits, isUnlimited });
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
