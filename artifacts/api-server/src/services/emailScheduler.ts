import cron from "node-cron";
import { db, selfbeatUsersTable, selfbeatEmailPreferencesTable, selfbeatDailyRunsTable, selfbeatDailyQuestionsTable, selfbeatVotesTable } from "@workspace/db";
import { eq, gte, and, count, sql } from "drizzle-orm";
import { sendEmail, generateUnsubscribeToken, buildUnsubscribeUrl } from "./emailService";
import { renderWeeklyDigest } from "../templates/weeklyDigest";

const MODEL_COLORS: Record<string, string> = {
  "GPT-4o": "#74aa9c",
  "Claude 3.5": "#d97757",
  "Gemini 1.5": "#4285f4",
  "Llama 3": "#7c3aed",
};

function modelColor(name: string): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (name.includes(key)) return color;
  }
  return "#818cf8";
}

async function ensureUnsubscribeToken(userId: string): Promise<string> {
  const [existing] = await db
    .select({ token: selfbeatEmailPreferencesTable.unsubscribeToken })
    .from(selfbeatEmailPreferencesTable)
    .where(eq(selfbeatEmailPreferencesTable.userId, userId));

  if (existing?.token) return existing.token;

  const token = generateUnsubscribeToken();
  await db
    .insert(selfbeatEmailPreferencesTable)
    .values({ userId, unsubscribeToken: token })
    .onConflictDoUpdate({
      target: selfbeatEmailPreferencesTable.userId,
      set: { unsubscribeToken: token },
    });
  return token;
}

async function getUserStreak(userId: string): Promise<number> {
  const runs = await db
    .select({ runDate: selfbeatDailyRunsTable.runDate })
    .from(selfbeatDailyRunsTable)
    .where(eq(selfbeatDailyRunsTable.userId, userId))
    .orderBy(sql`run_date DESC`);

  if (!runs.length) return 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let streak = 0;
  let expected = new Date(today);
  for (const { runDate } of runs) {
    const d = new Date(runDate as string);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() === expected.getTime()) {
      streak++;
      expected.setUTCDate(expected.getUTCDate() - 1);
    } else if (d < expected) break;
  }
  return streak;
}

async function getWeeklyQuestionCount(userId: string): Promise<number> {
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const [row] = await db
    .select({ cnt: count() })
    .from(selfbeatDailyRunsTable)
    .where(
      and(
        eq(selfbeatDailyRunsTable.userId, userId),
        gte(selfbeatDailyRunsTable.runDate, weekAgo.toISOString().slice(0, 10))
      )
    );
  return Number(row?.cnt ?? 0);
}

async function getLeaderboard(): Promise<{ rank: number; model: string; wins: number }[]> {
  try {
    const rows = await db
      .select({
        model: selfbeatVotesTable.selectedModel,
        wins: count(),
      })
      .from(selfbeatVotesTable)
      .groupBy(selfbeatVotesTable.selectedModel)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    return rows.map((r, i) => ({
      rank: i + 1,
      model: r.model as string,
      wins: Number(r.wins),
    }));
  } catch {
    return [];
  }
}

async function getTopQuestionsThisWeek(): Promise<{ question: string; winner: string; winnerColor: string }[]> {
  try {
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const rows = await db
      .select({
        question: selfbeatDailyQuestionsTable.question,
        model: selfbeatVotesTable.selectedModel,
        cnt: count(),
      })
      .from(selfbeatVotesTable)
      .innerJoin(selfbeatDailyQuestionsTable, eq(selfbeatVotesTable.questionId, selfbeatDailyQuestionsTable.id))
      .where(gte(selfbeatVotesTable.createdAt, weekAgo))
      .groupBy(selfbeatDailyQuestionsTable.question, selfbeatVotesTable.selectedModel)
      .orderBy(sql`count(*) DESC`)
      .limit(3);

    return rows.map((r) => ({
      question: r.question as string,
      winner: r.model as string,
      winnerColor: modelColor(r.model as string),
    }));
  } catch {
    return [];
  }
}

export async function sendWeeklyDigestToAll(triggerEmail?: string): Promise<{ sent: number; failed: number; skipped: number }> {
  const results = { sent: 0, failed: 0, skipped: 0 };

  const [leaderboard, topQuestions] = await Promise.all([getLeaderboard(), getTopQuestionsThisWeek()]);

  // Fetch today's QOTD for CTA
  let featuredQuestion = "What is the nature of intelligence?";
  let dailyQuestionUrl = process.env.APP_URL ?? "https://selfbeat.ai";
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [q] = await db.select({ question: selfbeatDailyQuestionsTable.question })
      .from(selfbeatDailyQuestionsTable)
      .limit(1);
    if (q) featuredQuestion = q.question;
    dailyQuestionUrl = `${process.env.APP_URL ?? "https://selfbeat.ai"}/?qotd=today`;
  } catch {}

  const highlight = {
    model: leaderboard[0]?.model ?? "GPT-4o",
    quote: "I must concede that my reasoning was flawed here — a rare moment of clarity in a sea of overconfidence.",
  };

  // Get all users (or just the one if test)
  const users = triggerEmail
    ? await db.select().from(selfbeatUsersTable).where(eq(selfbeatUsersTable.email, triggerEmail))
    : await db.select().from(selfbeatUsersTable).where(eq(selfbeatUsersTable.isBanned, false));

  for (const user of users) {
    if (!user.email) { results.skipped++; continue; }

    // Check preferences unless it's a test
    if (!triggerEmail) {
      const [prefs] = await db
        .select()
        .from(selfbeatEmailPreferencesTable)
        .where(eq(selfbeatEmailPreferencesTable.userId, user.id));

      if (prefs?.unsubscribedAt || prefs?.weeklyDigest === false) {
        results.skipped++;
        continue;
      }
    }

    try {
      const [streakDays, questionsThisWeek, unsubToken] = await Promise.all([
        getUserStreak(user.id),
        getWeeklyQuestionCount(user.id),
        ensureUnsubscribeToken(user.id),
      ]);

      const isUnlimited = user.hasUnlimited && (!user.unlimitedUntil || new Date(user.unlimitedUntil) > new Date());
      const subscriptionStatus = isUnlimited
        ? user.planType ? `Pro ${user.planType.charAt(0).toUpperCase() + user.planType.slice(1)}` : "Pro"
        : "Free";

      const html = renderWeeklyDigest({
        userName: user.displayName ?? user.email.split("@")[0],
        unsubscribeUrl: buildUnsubscribeUrl(unsubToken),
        topQuestions,
        highlight,
        leaderboard,
        personalStats: {
          questionsThisWeek,
          streakDays,
          creditsRemaining: isUnlimited ? -1 : user.credits,
          subscriptionStatus,
        },
        dailyQuestionUrl,
        featuredQuestion,
      });

      const result = await sendEmail({
        to: user.email,
        subject: "Your Selfbeat Weekly: The most interesting AI self-critiques this week",
        html,
        userId: user.id,
        emailType: "weekly_digest",
      });

      if (result.success) results.sent++;
      else results.failed++;
    } catch (err) {
      console.error(`[EmailScheduler] Failed for user ${user.id}:`, err);
      results.failed++;
    }
  }

  return results;
}

export function startEmailScheduler() {
  // Every Monday at 9am UTC
  cron.schedule("0 9 * * 1", async () => {
    console.log("[EmailScheduler] Starting weekly digest job...");
    const results = await sendWeeklyDigestToAll();
    console.log(`[EmailScheduler] Weekly digest complete:`, results);
  }, { timezone: "UTC" });

  console.log("[EmailScheduler] Weekly digest scheduled for every Monday at 9am UTC");
}
