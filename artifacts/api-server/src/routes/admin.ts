import { Router } from "express";
import { count, eq, gte, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

// Log on startup so the server console confirms what value is loaded
if (ADMIN_EMAIL) {
  console.log(`[admin] ADMIN_EMAIL loaded: ${ADMIN_EMAIL.slice(0, 3)}***${ADMIN_EMAIL.slice(ADMIN_EMAIL.indexOf("@"))}`);
} else {
  console.warn("[admin] WARNING: ADMIN_EMAIL is not set — admin panel will be inaccessible");
}

// Resolve the authenticated user's email from req.user (Passport) or fallback
// to a DB lookup using req.userId (set by requireAuth).  This guards against
// cases where Passport didn't fully hydrate req.user yet the session is valid.
async function resolveUserEmail(req: any): Promise<string | null> {
  const passportEmail = (req.user as any)?.email as string | undefined;
  if (passportEmail) return passportEmail.trim().toLowerCase();

  const userId = req.userId as string | undefined;
  if (!userId) return null;

  try {
    const [row] = await db
      .select({ email: selfbeatUsersTable.email })
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);
    return row?.email ? row.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

async function requireAdminEmail(req: any, res: any, next: any) {
  if (!ADMIN_EMAIL) return res.status(403).json({ error: "Admin not configured" });
  const email = await resolveUserEmail(req);
  if (!email) return res.status(401).json({ error: "Unauthorized" });
  if (email !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden" });
  next();
}

// ── Check if current user is admin ───────────────────────────────────────────

router.get("/check", requireAuth, async (req: any, res) => {
  try {
    const email = await resolveUserEmail(req);
    const isAdmin = !!ADMIN_EMAIL && !!email && email === ADMIN_EMAIL;
    console.log(`[admin] /check — resolved email: "${email}", ADMIN_EMAIL: "${ADMIN_EMAIL}", isAdmin: ${isAdmin}`);
    res.json({ isAdmin });
  } catch (err) {
    console.error("[admin] /check error:", err);
    res.status(500).json({ error: "Failed to check admin status" });
  }
});

// ── Debug route — shows exactly what is being compared ───────────────────────

router.get("/debug", requireAuth, async (req: any, res) => {
  try {
    const email = await resolveUserEmail(req);
    const adminEmailConfigured = ADMIN_EMAIL || "(not set)";
    const resolvedEmail = email || "(none)";
    const match = !!email && !!ADMIN_EMAIL && email === ADMIN_EMAIL;

    res.json({
      loggedInEmail: resolvedEmail,
      adminEmailConfigured,
      match,
      verdict: match
        ? "ACCESS GRANTED — emails match"
        : !ADMIN_EMAIL
          ? "ACCESS DENIED — ADMIN_EMAIL environment variable is not set"
          : !email
            ? "ACCESS DENIED — could not resolve logged-in user email"
            : `ACCESS DENIED — "${resolvedEmail}" does not match "${adminEmailConfigured}"`,
      note: "All comparisons are case-insensitive and whitespace-trimmed",
      passportUserEmail: (req.user as any)?.email ?? "(Passport req.user is null)",
      sessionUserId: (req.session as any)?.userId ?? "(no session userId)",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

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

    let questionsToday: number | null = null;
    try {
      const qRow = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM selfbeat_comparisons WHERE created_at >= ${todayStart.toISOString()}`
      );
      questionsToday = Number((qRow.rows[0] as any)?.cnt ?? 0);
    } catch {
      questionsToday = null;
    }

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
    const isUnlimited = u.hasUnlimited && (!u.unlimitedUntil || u.unlimitedUntil > now);

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

export default router;
