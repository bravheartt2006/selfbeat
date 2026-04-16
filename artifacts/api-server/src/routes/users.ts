import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";

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

  try {
    const existing = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      const isUnlimited =
        user.hasUnlimited &&
        (!user.unlimitedUntil || user.unlimitedUntil > new Date());
      return res.json({ ...user, isUnlimited });
    }

    // New user — check if fingerprint already used credits on another account
    let startingCredits = 10;
    if (fingerprint) {
      const fingerprintUser = await db.execute(
        sql`SELECT credits, has_unlimited FROM selfbeat_users WHERE id != ${userId} AND id IN (
          SELECT DISTINCT user_id FROM selfbeat_fingerprints WHERE fingerprint_id = ${fingerprint}
        ) ORDER BY created_at ASC LIMIT 1`
      );
      if (fingerprintUser.rows.length > 0) {
        const row = fingerprintUser.rows[0] as any;
        if (row.has_unlimited) {
          startingCredits = 0;
        } else {
          startingCredits = Math.min(
            Math.max(0, Number(row.credits ?? 0)),
            10
          );
        }
      }
    }

    const [created] = await db
      .insert(selfbeatUsersTable)
      .values({ id: userId, email: email || null, credits: startingCredits })
      .returning();

    // Track fingerprint
    if (fingerprint) {
      await db.execute(
        sql`INSERT INTO selfbeat_fingerprints (fingerprint_id, user_id)
            VALUES (${fingerprint}, ${userId})
            ON CONFLICT (fingerprint_id, user_id) DO NOTHING`
      );
    }

    const isUnlimited =
      created.hasUnlimited &&
      (!created.unlimitedUntil || created.unlimitedUntil > new Date());
    return res.json({ ...created, isUnlimited });
  } catch (err) {
    console.error("Error in /users/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user's credit balance
router.get("/me/credits", requireAuth, async (req: any, res) => {
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
