import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable, selfbeatLoginLogTable } from "@workspace/db";
import { apiRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

export function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  next();
}

// Get or create user — called on every sign-in from the frontend
router.post("/me", requireAuth, async (req: any, res) => {
  const { userId } = req;
  const { email, fingerprint } = req.body as { email?: string; fingerprint?: string };

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  try {
    // Fetch Clerk profile for display name and avatar
    let displayName: string | null = null;
    let pictureUrl: string | null = null;
    try {
      const clerkUser = await clerkClient().users.getUser(userId);
      displayName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
        null;
      pictureUrl = clerkUser.imageUrl || null;
    } catch {
      // non-fatal
    }

    const existing = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];

      // Update last sign-in and profile fields
      await db
        .update(selfbeatUsersTable)
        .set({
          lastSignInAt: new Date(),
          ...(displayName && { displayName }),
          ...(pictureUrl && { pictureUrl }),
          ...(email && !user.email && { email }),
        })
        .where(eq(selfbeatUsersTable.id, userId));

      // Track fingerprint for existing user (new device)
      if (fingerprint) {
        await db.execute(
          sql`INSERT INTO selfbeat_fingerprints (fingerprint_id, user_id)
              VALUES (${fingerprint}, ${userId})
              ON CONFLICT (fingerprint_id, user_id) DO NOTHING`
        );
      }

      // Log sign-in
      await db.insert(selfbeatLoginLogTable).values({
        userId,
        fingerprintId: fingerprint ?? null,
        ipAddress: ip,
      }).catch(() => {});

      const isUnlimited =
        user.hasUnlimited &&
        (!user.unlimitedUntil || user.unlimitedUntil > new Date());
      return res.json({ ...user, isUnlimited, deviceCreditBlocked: false });
    }

    // ── New user ──────────────────────────────────────────────────────────────
    // Check if fingerprint already received credits on a different account
    let startingCredits = 10;
    let deviceCreditBlocked = false;
    if (fingerprint) {
      const fingerprintUser = await db.execute(
        sql`SELECT credits, has_unlimited FROM selfbeat_users WHERE id != ${userId} AND id IN (
          SELECT DISTINCT user_id FROM selfbeat_fingerprints WHERE fingerprint_id = ${fingerprint}
        ) ORDER BY created_at ASC LIMIT 1`
      );
      if (fingerprintUser.rows.length > 0) {
        startingCredits = 0;
        deviceCreditBlocked = true;
      }
    }

    const [created] = await db
      .insert(selfbeatUsersTable)
      .values({
        id: userId,
        email: email || null,
        displayName,
        pictureUrl,
        credits: startingCredits,
        lastSignInAt: new Date(),
      })
      .returning();

    // Track fingerprint
    if (fingerprint) {
      await db.execute(
        sql`INSERT INTO selfbeat_fingerprints (fingerprint_id, user_id)
            VALUES (${fingerprint}, ${userId})
            ON CONFLICT (fingerprint_id, user_id) DO NOTHING`
      );
    }

    // Log sign-in
    await db.insert(selfbeatLoginLogTable).values({
      userId,
      fingerprintId: fingerprint ?? null,
      ipAddress: ip,
    }).catch(() => {});

    const isUnlimited =
      created.hasUnlimited &&
      (!created.unlimitedUntil || created.unlimitedUntil > new Date());
    return res.json({ ...created, isUnlimited, deviceCreditBlocked });
  } catch (err) {
    console.error("Error in /users/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user's credit balance
router.get("/me/credits", requireAuth, apiRateLimiter, async (req: any, res) => {
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
});

export default router;
