import { Router } from "express";
import { count, eq, gte, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";

const router = Router();

// ── Step 1: Log ADMIN_EMAIL on startup ───────────────────────────────────────
console.log("ADMIN_EMAIL is set to:", process.env.ADMIN_EMAIL);

// ── Helper: get the current user (Passport sets req.user; fallback to DB) ────
async function getCurrentUser(req: any) {
  // Passport populates req.user from the session via deserializeUser
  if (req.user) return req.user;

  // Fallback: if session has userId but passport didn't hydrate req.user
  const userId = (req.session as any)?.userId;
  if (!userId) return null;

  const [row] = await db
    .select()
    .from(selfbeatUsersTable)
    .where(eq(selfbeatUsersTable.id, userId))
    .limit(1);

  return row ?? null;
}

// ── /check — is the current user the admin? ──────────────────────────────────
router.get("/check", async (req: any, res) => {
  try {
    const user = await getCurrentUser(req);

    // Step 2: Log what email the visiting user has
    console.log("Visiting user email:", user?.email);

    // Step 3: Log the exact comparison result
    console.log("Is admin?", user?.email === process.env.ADMIN_EMAIL);

    const isAdmin =
      !!user &&
      !!user.email &&
      !!process.env.ADMIN_EMAIL &&
      user.email === process.env.ADMIN_EMAIL;

    res.json({ isAdmin });
  } catch (err) {
    console.error("[admin] /check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── /debug — shows exact values being compared ────────────────────────────────
router.get("/debug", async (req: any, res) => {
  try {
    const user = await getCurrentUser(req);
    const userEmail = user?.email ?? null;
    const adminEmail = process.env.ADMIN_EMAIL ?? null;
    const match = !!userEmail && !!adminEmail && userEmail === adminEmail;

    console.log("[admin] /debug — userEmail:", userEmail, "| adminEmail:", adminEmail, "| match:", match);

    res.json({
      loggedIn: !!user,
      userEmail,
      adminEmailConfigured: adminEmail ?? "(not set)",
      exactMatch: match,
      verdict: !user
        ? "NOT LOGGED IN"
        : !adminEmail
          ? "ADMIN_EMAIL env var is not set"
          : !match
            ? `NO MATCH: "${userEmail}" vs "${adminEmail}"`
            : "ACCESS GRANTED",
      sessionUserId: (req.session as any)?.userId ?? null,
      passportUser: req.user ? { id: req.user.id, email: req.user.email } : null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── /stats — admin-only stats dashboard ──────────────────────────────────────
router.get("/stats", async (req: any, res) => {
  const user = await getCurrentUser(req);
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalUsersRow, newTodayRow, proSubscribersRow] = await Promise.all([
      db.select({ cnt: count() }).from(selfbeatUsersTable),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(gte(selfbeatUsersTable.createdAt, todayStart)),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(
        sql`(${selfbeatUsersTable.hasUnlimited} = true AND (${selfbeatUsersTable.unlimitedUntil} IS NULL OR ${selfbeatUsersTable.unlimitedUntil} > now()))`
      ),
    ]);

    let questionsToday: number | null = null;
    try {
      const r = await db.execute(sql`SELECT COUNT(*) as cnt FROM selfbeat_comparisons WHERE created_at >= ${todayStart.toISOString()}`);
      questionsToday = Number((r.rows[0] as any)?.cnt ?? 0);
    } catch { questionsToday = null; }

    let totalRevenueCents: number | null = null;
    try {
      const r = await db.execute(sql`SELECT COALESCE(SUM(amount_cents),0) as total FROM selfbeat_payments`);
      totalRevenueCents = Number((r.rows[0] as any)?.total ?? 0);
    } catch { totalRevenueCents = null; }

    res.json({
      totalUsers: Number(totalUsersRow[0]?.cnt ?? 0),
      newSignupsToday: Number(newTodayRow[0]?.cnt ?? 0),
      activeProSubscribers: Number(proSubscribersRow[0]?.cnt ?? 0),
      questionsToday,
      totalRevenueCents,
    });
  } catch (err) {
    console.error("[admin] /stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── /user-search ──────────────────────────────────────────────────────────────
router.get("/user-search", async (req: any, res) => {
  const user = await getCurrentUser(req);
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { email } = req.query as { email?: string };
  if (!email?.trim()) return res.status(400).json({ error: "email is required" });

  try {
    const rows = await db
      .select()
      .from(selfbeatUsersTable)
      .where(sql`LOWER(${selfbeatUsersTable.email}) = LOWER(${email.trim()})`)
      .limit(5);

    if (!rows.length) return res.json({ user: null });

    const u = rows[0];
    const now = new Date();
    const isUnlimited = u.hasUnlimited && (!u.unlimitedUntil || u.unlimitedUntil > now);
    const subscriptionStatus = isUnlimited
      ? u.unlimitedUntil ? `Pro until ${u.unlimitedUntil.toISOString().slice(0, 10)}` : "Pro (lifetime)"
      : u.trialUsed && u.trialEndDate && u.trialEndDate > now
        ? `Trial (until ${u.trialEndDate.toISOString().slice(0, 10)})`
        : "Free";

    res.json({
      user: {
        id: u.id, email: u.email, displayName: u.displayName, pictureUrl: u.pictureUrl,
        credits: u.credits, isUnlimited, subscriptionStatus,
        stripeCustomerId: u.stripeCustomerId, stripeSubscriptionId: u.stripeSubscriptionId,
        createdAt: u.createdAt, lastSignInAt: u.lastSignInAt,
      },
    });
  } catch (err) {
    console.error("[admin] /user-search error:", err);
    res.status(500).json({ error: "Failed to search user" });
  }
});

// ── /adjust-credits ───────────────────────────────────────────────────────────
router.post("/adjust-credits", async (req: any, res) => {
  const user = await getCurrentUser(req);
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { userId, delta } = req.body as { userId?: string; delta?: number };
  if (!userId || typeof delta !== "number") return res.status(400).json({ error: "userId and delta are required" });

  try {
    const [target] = await db.select({ credits: selfbeatUsersTable.credits }).from(selfbeatUsersTable).where(eq(selfbeatUsersTable.id, userId)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    const newCredits = Math.max(0, target.credits + delta);
    await db.update(selfbeatUsersTable).set({ credits: newCredits }).where(eq(selfbeatUsersTable.id, userId));
    res.json({ ok: true, newCredits });
  } catch (err) {
    console.error("[admin] /adjust-credits error:", err);
    res.status(500).json({ error: "Failed to adjust credits" });
  }
});

export default router;
