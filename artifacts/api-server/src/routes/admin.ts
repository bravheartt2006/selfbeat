import { Router } from "express";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { db, selfbeatUsersTable, selfbeatSettingsTable, selfbeatDailyRunsTable, selfbeatEmailPreferencesTable, selfbeatEmailLogsTable } from "@workspace/db";
import { sendWeeklyDigestToAll } from "../services/emailScheduler";
import { sendEmail } from "../services/emailService";

const router = Router();

console.log("ADMIN_EMAIL is set to:", process.env.ADMIN_EMAIL);

// ── Helper: get the current user ──────────────────────────────────────────────
async function getCurrentUser(req: any) {
  if (req.user) return req.user;
  const userId = (req.session as any)?.userId;
  if (!userId) return null;
  const [row] = await db
    .select()
    .from(selfbeatUsersTable)
    .where(eq(selfbeatUsersTable.id, userId))
    .limit(1);
  return row ?? null;
}

function isAdminUser(user: any): boolean {
  return !!user?.email && !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const user = await getCurrentUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

// ── /check ────────────────────────────────────────────────────────────────────
router.get("/check", async (req: any, res) => {
  try {
    const user = await getCurrentUser(req);
    const adminEmail = process.env.ADMIN_EMAIL;
    console.log("Visiting user email:", user?.email);
    if (!user) return res.json({ isAdmin: false, reason: "not_signed_in", userEmail: null });
    const isAdmin = !!user.email && !!adminEmail && user.email === adminEmail;
    console.log("Is admin?", isAdmin);
    res.json({ isAdmin, reason: isAdmin ? "granted" : "wrong_email", userEmail: user.email ?? null });
  } catch (err) {
    console.error("[admin] /check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── /debug ────────────────────────────────────────────────────────────────────
router.get("/debug", async (req: any, res) => {
  try {
    const user = await getCurrentUser(req);
    const userEmail = user?.email ?? null;
    const adminEmail = process.env.ADMIN_EMAIL ?? null;
    const match = !!userEmail && !!adminEmail && userEmail === adminEmail;
    res.json({
      loggedIn: !!user, userEmail, adminEmailConfigured: adminEmail ?? "(not set)",
      exactMatch: match,
      verdict: !user ? "NOT LOGGED IN" : !adminEmail ? "ADMIN_EMAIL not set" : !match ? `NO MATCH: "${userEmail}" vs "${adminEmail}"` : "ACCESS GRANTED",
      sessionUserId: (req.session as any)?.userId ?? null,
      passportUser: req.user ? { id: req.user.id, email: req.user.email } : null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── /stats ────────────────────────────────────────────────────────────────────
router.get("/stats", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      totalUsersRow,
      newTodayRow,
      newWeekRow,
      proMonthlyRow,
      proAnnualRow,
      teamRow,
    ] = await Promise.all([
      db.select({ cnt: count() }).from(selfbeatUsersTable),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(gte(selfbeatUsersTable.createdAt, todayStart)),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(gte(selfbeatUsersTable.createdAt, weekStart)),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(
        sql`${selfbeatUsersTable.hasUnlimited} = true AND ${selfbeatUsersTable.planType} = 'monthly' AND (${selfbeatUsersTable.unlimitedUntil} IS NULL OR ${selfbeatUsersTable.unlimitedUntil} > now())`
      ),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(
        sql`${selfbeatUsersTable.hasUnlimited} = true AND ${selfbeatUsersTable.planType} = 'annual' AND (${selfbeatUsersTable.unlimitedUntil} IS NULL OR ${selfbeatUsersTable.unlimitedUntil} > now())`
      ),
      db.select({ cnt: count() }).from(selfbeatUsersTable).where(
        sql`${selfbeatUsersTable.planType} = 'team'`
      ),
    ]);

    // Questions (comparisons table — graceful fallback)
    let totalQuestionsAllTime: number | null = null;
    let questionsToday: number | null = null;
    try {
      const [allQ, todayQ] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as cnt FROM selfbeat_comparisons`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM selfbeat_comparisons WHERE created_at >= ${todayStart.toISOString()}`),
      ]);
      totalQuestionsAllTime = Number((allQ.rows[0] as any)?.cnt ?? 0);
      questionsToday = Number((todayQ.rows[0] as any)?.cnt ?? 0);
    } catch { /* table may not exist */ }

    // Revenue (selfbeat_payments table — graceful fallback)
    let totalRevenueCents: number | null = null;
    let revenueTodayCents: number | null = null;
    let revenueThisMonthCents: number | null = null;
    try {
      const [allRev, todayRev, monthRev] = await Promise.all([
        db.execute(sql`SELECT COALESCE(SUM(amount_cents),0) as total FROM selfbeat_payments`),
        db.execute(sql`SELECT COALESCE(SUM(amount_cents),0) as total FROM selfbeat_payments WHERE created_at >= ${todayStart.toISOString()}`),
        db.execute(sql`SELECT COALESCE(SUM(amount_cents),0) as total FROM selfbeat_payments WHERE created_at >= ${monthStart.toISOString()}`),
      ]);
      totalRevenueCents = Number((allRev.rows[0] as any)?.total ?? 0);
      revenueTodayCents = Number((todayRev.rows[0] as any)?.total ?? 0);
      revenueThisMonthCents = Number((monthRev.rows[0] as any)?.total ?? 0);
    } catch { /* no payments table yet */ }

    res.json({
      totalUsers: Number(totalUsersRow[0]?.cnt ?? 0),
      newSignupsToday: Number(newTodayRow[0]?.cnt ?? 0),
      newSignupsThisWeek: Number(newWeekRow[0]?.cnt ?? 0),
      activeProMonthly: Number(proMonthlyRow[0]?.cnt ?? 0),
      activeProAnnual: Number(proAnnualRow[0]?.cnt ?? 0),
      activeTeam: Number(teamRow[0]?.cnt ?? 0),
      totalQuestionsAllTime,
      questionsToday,
      totalRevenueCents,
      revenueTodayCents,
      revenueThisMonthCents,
    });
  } catch (err) {
    console.error("[admin] /stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── /user-search ──────────────────────────────────────────────────────────────
router.get("/user-search", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;

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

    let subscriptionStatus = "Free";
    if (isUnlimited) {
      if (u.planType === "annual") subscriptionStatus = u.unlimitedUntil ? `Pro Annual (until ${u.unlimitedUntil.toISOString().slice(0, 10)})` : "Pro Annual";
      else if (u.planType === "team") subscriptionStatus = "Team";
      else subscriptionStatus = u.unlimitedUntil ? `Pro Monthly (until ${u.unlimitedUntil.toISOString().slice(0, 10)})` : "Pro";
    } else if (u.trialUsed && u.trialEndDate && u.trialEndDate > now) {
      subscriptionStatus = `Trial (until ${u.trialEndDate.toISOString().slice(0, 10)})`;
    }

    // Compute streak from daily_runs
    const runs = await db
      .select({ runDate: selfbeatDailyRunsTable.runDate })
      .from(selfbeatDailyRunsTable)
      .where(eq(selfbeatDailyRunsTable.userId, u.id))
      .orderBy(desc(selfbeatDailyRunsTable.runDate));

    const totalQotdRuns = runs.length;
    const sortedDates = runs.map((r) => r.runDate).sort().reverse();
    let streakCount = 0;
    if (sortedDates.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

      if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
        streakCount = 1;
        let prev = sortedDates[0];
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(prev);
          prevDate.setUTCDate(prevDate.getUTCDate() - 1);
          const expected = prevDate.toISOString().slice(0, 10);
          if (sortedDates[i] === expected) {
            streakCount++;
            prev = sortedDates[i];
          } else break;
        }
      }
    }

    res.json({
      user: {
        id: u.id, email: u.email, displayName: u.displayName, pictureUrl: u.pictureUrl,
        credits: u.credits, isUnlimited, isBanned: u.isBanned, planType: u.planType ?? null,
        subscriptionStatus, stripeCustomerId: u.stripeCustomerId, stripeSubscriptionId: u.stripeSubscriptionId,
        createdAt: u.createdAt, lastSignInAt: u.lastSignInAt,
        streakCount, totalQotdRuns,
        trialUsed: u.trialUsed, trialEndDate: u.trialEndDate,
      },
    });
  } catch (err) {
    console.error("[admin] /user-search error:", err);
    res.status(500).json({ error: "Failed to search user" });
  }
});

// ── /adjust-credits ───────────────────────────────────────────────────────────
router.post("/adjust-credits", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
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

// ── /ban-user ─────────────────────────────────────────────────────────────────
router.post("/ban-user", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { userId, ban } = req.body as { userId?: string; ban?: boolean };
  if (!userId || typeof ban !== "boolean") return res.status(400).json({ error: "userId and ban are required" });
  try {
    await db.update(selfbeatUsersTable).set({ isBanned: ban }).where(eq(selfbeatUsersTable.id, userId));
    res.json({ ok: true, isBanned: ban });
  } catch (err) {
    console.error("[admin] /ban-user error:", err);
    res.status(500).json({ error: "Failed to update ban status" });
  }
});

// ── /email-stats ──────────────────────────────────────────────────────────────

router.get("/email-stats", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const totalUsers = await db.select({ cnt: count() }).from(selfbeatUsersTable);
    const totalCount = Number(totalUsers[0]?.cnt ?? 0);

    const prefs = await db.select().from(selfbeatEmailPreferencesTable);
    const unsubscribed = prefs.filter(p => !!p.unsubscribedAt).length;
    const subscribed = totalCount - unsubscribed;

    const weeklyDigestOn = prefs.filter(p => !p.unsubscribedAt && p.weeklyDigest !== false).length
      + (totalCount - prefs.length); // users with no prefs row = default true
    const streakOn = prefs.filter(p => !p.unsubscribedAt && p.streakReminders !== false).length
      + (totalCount - prefs.length);
    const creditOn = prefs.filter(p => !p.unsubscribedAt && p.creditWarnings !== false).length
      + (totalCount - prefs.length);
    const promoOn = prefs.filter(p => !p.unsubscribedAt && p.promotional !== false).length
      + (totalCount - prefs.length);

    // Last 50 logs
    const logs = await db
      .select()
      .from(selfbeatEmailLogsTable)
      .orderBy(desc(selfbeatEmailLogsTable.sentAt))
      .limit(50);

    const sentCount = logs.filter(l => l.status === "sent").length;
    const failCount = logs.filter(l => l.status === "failed").length;
    const successRate = logs.length > 0 ? Math.round((sentCount / logs.length) * 100) : null;

    res.json({
      totalUsers: totalCount,
      subscribed,
      unsubscribed,
      weeklyDigest: weeklyDigestOn,
      streakReminders: streakOn,
      creditWarnings: creditOn,
      promotional: promoOn,
      recentLogs: logs,
      successRate,
    });
  } catch (err) {
    console.error("[admin] /email-stats error:", err);
    res.status(500).json({ error: "Failed to load email stats" });
  }
});

// ── /send-test-email ──────────────────────────────────────────────────────────

router.post("/send-test-email", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return res.status(400).json({ error: "ADMIN_EMAIL not configured" });
    const result = await sendWeeklyDigestToAll(adminEmail);
    res.json({ success: true, result });
  } catch (err) {
    console.error("[admin] /send-test-email error:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// ── /trigger-weekly-digest ────────────────────────────────────────────────────

router.post("/trigger-weekly-digest", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    res.json({ success: true, message: "Weekly digest is being sent in the background. Check email logs." });
    // Fire and forget
    sendWeeklyDigestToAll().catch(err => console.error("[admin] trigger-weekly-digest error:", err));
  } catch (err) {
    console.error("[admin] /trigger-weekly-digest error:", err);
    res.status(500).json({ error: "Failed to trigger digest" });
  }
});

// ── /email-logs ───────────────────────────────────────────────────────────────

router.get("/email-logs", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const logs = await db
      .select()
      .from(selfbeatEmailLogsTable)
      .orderBy(desc(selfbeatEmailLogsTable.sentAt))
      .limit(100);
    res.json({ logs });
  } catch (err) {
    console.error("[admin] /email-logs error:", err);
    res.status(500).json({ error: "Failed to load email logs" });
  }
});

// ── /set-qotd-override ────────────────────────────────────────────────────────
// Stores an override so a specific question is shown on a given date.
// Key format in selfbeat_settings: qotd_override_YYYY-MM-DD → questionId (as string)
router.post("/set-qotd-override", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { date, questionId } = req.body as { date?: string; questionId?: number | null };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date (YYYY-MM-DD) required" });
  try {
    const key = `qotd_override_${date}`;
    if (questionId == null) {
      // Remove override
      await db.delete(selfbeatSettingsTable).where(eq(selfbeatSettingsTable.key, key));
    } else {
      await db
        .insert(selfbeatSettingsTable)
        .values({ key, value: String(questionId), updatedAt: new Date() })
        .onConflictDoUpdate({ target: selfbeatSettingsTable.key, set: { value: String(questionId), updatedAt: new Date() } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin] /set-qotd-override error:", err);
    res.status(500).json({ error: "Failed to set override" });
  }
});

export default router;
