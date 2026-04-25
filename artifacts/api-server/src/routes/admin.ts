import { Router } from "express";
import { count, eq, gte, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

async function requireAdminEmail(req: any, res: any, next: any) {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ── Stats dashboard ───────────────────────────────────────────────────────────

router.get("/stats", requireAuth, requireAdminEmail, async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalUsersRow, newTodayRow, proSubscribersRow] = await Promise.all([
      db.select({ cnt: count() }).from(selfbeatUsersTable),
      db
        .select({ cnt: count() })
        .from(selfbeatUsersTable)
        .where(gte(selfbeatUsersTable.createdAt, todayStart)),
      db
        .select({ cnt: count() })
        .from(selfbeatUsersTable)
        .where(
          sql`(${selfbeatUsersTable.hasUnlimited} = true AND (${selfbeatUsersTable.unlimitedUntil} IS NULL OR ${selfbeatUsersTable.unlimitedUntil} > now()))`
        ),
    ]);

    // Total questions asked today — count from selfbeat_comparisons if exists, else null
    let questionsToday: number | null = null;
    try {
      const qRow = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM selfbeat_comparisons WHERE created_at >= ${todayStart.toISOString()}`
      );
      questionsToday = Number((qRow.rows[0] as any)?.cnt ?? 0);
    } catch {
      questionsToday = null;
    }

    // Stripe revenue — sum from selfbeat_stripe_events or estimate from users
    let totalRevenueCents: number | null = null;
    try {
      const revRow = await db.execute(
        sql`SELECT COALESCE(SUM(amount_cents),0) as total FROM selfbeat_payments`
      );
      totalRevenueCents = Number((revRow.rows[0] as any)?.total ?? 0);
    } catch {
      totalRevenueCents = null;
    }

    res.json({
      totalUsers: Number(totalUsersRow[0]?.cnt ?? 0),
      newSignupsToday: Number(newTodayRow[0]?.cnt ?? 0),
      activeProSubscribers: Number(proSubscribersRow[0]?.cnt ?? 0),
      questionsToday,
      totalRevenueCents,
    });
  } catch (err) {
    console.error("GET /admin/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── User search ───────────────────────────────────────────────────────────────

router.get("/user-search", requireAuth, requireAdminEmail, async (req: any, res) => {
  const { email } = req.query as { email?: string };
  if (!email?.trim()) return res.status(400).json({ error: "email is required" });

  try {
    const users = await db
      .select()
      .from(selfbeatUsersTable)
      .where(sql`LOWER(${selfbeatUsersTable.email}) = LOWER(${email.trim()})`)
      .limit(5);

    if (users.length === 0) return res.json({ user: null });

    const u = users[0];
    const now = new Date();
    const isUnlimited =
      u.hasUnlimited && (!u.unlimitedUntil || u.unlimitedUntil > now);

    const subscriptionStatus = isUnlimited
      ? u.unlimitedUntil
        ? `Pro until ${u.unlimitedUntil.toISOString().slice(0, 10)}`
        : "Pro (lifetime)"
      : u.trialUsed && u.trialEndDate && u.trialEndDate > now
        ? `Trial (until ${u.trialEndDate.toISOString().slice(0, 10)})`
        : "Free";

    res.json({
      user: {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        pictureUrl: u.pictureUrl,
        credits: u.credits,
        isUnlimited,
        subscriptionStatus,
        stripeCustomerId: u.stripeCustomerId,
        stripeSubscriptionId: u.stripeSubscriptionId,
        createdAt: u.createdAt,
        lastSignInAt: u.lastSignInAt,
      },
    });
  } catch (err) {
    console.error("GET /admin/user-search error:", err);
    res.status(500).json({ error: "Failed to search user" });
  }
});

// ── Adjust credits ────────────────────────────────────────────────────────────

router.post("/adjust-credits", requireAuth, requireAdminEmail, async (req: any, res) => {
  const { userId, delta } = req.body as { userId?: string; delta?: number };
  if (!userId || typeof delta !== "number") {
    return res.status(400).json({ error: "userId and delta are required" });
  }

  try {
    const [user] = await db
      .select({ credits: selfbeatUsersTable.credits })
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    const newCredits = Math.max(0, user.credits + delta);
    await db
      .update(selfbeatUsersTable)
      .set({ credits: newCredits })
      .where(eq(selfbeatUsersTable.id, userId));

    res.json({ ok: true, newCredits });
  } catch (err) {
    console.error("POST /admin/adjust-credits error:", err);
    res.status(500).json({ error: "Failed to adjust credits" });
  }
});

// ── Check if current user is admin ───────────────────────────────────────────

router.get("/check", requireAuth, async (req: any, res) => {
  const user = req.user as any;
  const isAdmin = !!ADMIN_EMAIL && user?.email === ADMIN_EMAIL;
  res.json({ isAdmin });
});

export default router;
