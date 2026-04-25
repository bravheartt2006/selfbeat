import { Router } from "express";
import { and, count, eq } from "drizzle-orm";
import { db, selfbeatDailyQuestionsTable, selfbeatDailyRunsTable, selfbeatSettingsTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

const EPOCH_START = new Date("2025-01-01T00:00:00Z");
const ADMIN_KEY = process.env.ADMIN_KEY ?? "selfbeat-admin-2025";
const RUN_COUNT_OFFSET = 120;

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDayIndex(): number {
  const now = new Date();
  return Math.floor((now.getTime() - EPOCH_START.getTime()) / (1000 * 60 * 60 * 24));
}

function getNextResetMs(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

async function getTodayQuestion() {
  const today = getTodayUTC();
  const overrideKey = `qotd_override_${today}`;
  const [questions, overrideRow] = await Promise.all([
    db.select().from(selfbeatDailyQuestionsTable)
      .where(eq(selfbeatDailyQuestionsTable.isActive, true))
      .orderBy(selfbeatDailyQuestionsTable.sortOrder, selfbeatDailyQuestionsTable.id),
    db.select().from(selfbeatSettingsTable)
      .where(eq(selfbeatSettingsTable.key, overrideKey))
      .limit(1),
  ]);

  if (questions.length === 0) return null;

  if (overrideRow.length > 0) {
    const overrideId = parseInt(overrideRow[0].value, 10);
    const overrideQ = questions.find((q) => q.id === overrideId);
    if (overrideQ) return overrideQ;
  }

  return questions[getDayIndex() % questions.length];
}

function requireAdmin(req: any, res: any, next: any) {
  const key = (req.headers["x-admin-key"] as string) || (req.query.adminKey as string);
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Public: get today's question ─────────────────────────────────────────────

router.get("/daily-question", async (req: any, res: any) => {
  try {
    const todayQ = await getTodayQuestion();
    if (!todayQ) return res.status(404).json({ error: "No questions available" });

    const today = getTodayUTC();
    const userId = (req.session as any)?.userId || (req.user as any)?.id || null;

    const [runCountRow, userRunRow] = await Promise.all([
      db
        .select({ cnt: count() })
        .from(selfbeatDailyRunsTable)
        .where(
          and(
            eq(selfbeatDailyRunsTable.questionId, todayQ.id),
            eq(selfbeatDailyRunsTable.runDate, today),
          ),
        ),
      userId
        ? db
            .select({ id: selfbeatDailyRunsTable.id })
            .from(selfbeatDailyRunsTable)
            .where(
              and(
                eq(selfbeatDailyRunsTable.userId, userId),
                eq(selfbeatDailyRunsTable.runDate, today),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    res.json({
      questionId: todayQ.id,
      question: todayQ.question,
      runCount: Number(runCountRow[0]?.cnt ?? 0) + RUN_COUNT_OFFSET,
      userHasRunToday: (userRunRow as { id: number }[]).length > 0,
      nextResetMs: getNextResetMs(),
    });
  } catch (err) {
    console.error("GET /daily-question error:", err);
    res.status(500).json({ error: "Failed to fetch daily question" });
  }
});

// ── Auth: mark run ────────────────────────────────────────────────────────────

router.post("/daily-question/run", requireAuth, async (req: any, res: any) => {
  const userId = req.userId as string;
  const today = getTodayUTC();

  try {
    const todayQ = await getTodayQuestion();
    if (!todayQ) return res.status(404).json({ error: "No questions available" });

    const existing = await db
      .select({ id: selfbeatDailyRunsTable.id })
      .from(selfbeatDailyRunsTable)
      .where(
        and(
          eq(selfbeatDailyRunsTable.userId, userId),
          eq(selfbeatDailyRunsTable.runDate, today),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ alreadyRun: true, question: todayQ.question });
    }

    await db.insert(selfbeatDailyRunsTable).values({
      userId,
      questionId: todayQ.id,
      runDate: today,
    });

    res.json({ ok: true, question: todayQ.question });
  } catch (err) {
    console.error("POST /daily-question/run error:", err);
    res.status(500).json({ error: "Failed to record run" });
  }
});

// ── Admin: manage question pool ───────────────────────────────────────────────

router.get("/admin/daily-questions", requireAdmin, async (_req: any, res: any) => {
  try {
    const questions = await db
      .select()
      .from(selfbeatDailyQuestionsTable)
      .orderBy(selfbeatDailyQuestionsTable.sortOrder, selfbeatDailyQuestionsTable.id);

    const activeQs = questions.filter((q) => q.isActive);
    const todayIdx = getDayIndex();
    const todayQ = activeQs.length > 0 ? activeQs[todayIdx % activeQs.length] : null;
    const tomorrowQ = activeQs.length > 0 ? activeQs[(todayIdx + 1) % activeQs.length] : null;

    res.json({
      questions,
      todayQuestionId: todayQ?.id ?? null,
      tomorrowQuestionId: tomorrowQ?.id ?? null,
    });
  } catch (err) {
    console.error("GET /admin/daily-questions error:", err);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

router.post("/admin/daily-questions", requireAdmin, async (req: any, res: any) => {
  const { question, sortOrder } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: "question is required" });
  try {
    const [row] = await db
      .insert(selfbeatDailyQuestionsTable)
      .values({ question: question.trim(), sortOrder: sortOrder ?? 0 })
      .returning();
    res.json(row);
  } catch (err) {
    console.error("POST /admin/daily-questions error:", err);
    res.status(500).json({ error: "Failed to add question" });
  }
});

router.patch("/admin/daily-questions/:id", requireAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { isActive, sortOrder } = req.body;
  try {
    const updates: Record<string, unknown> = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    await db
      .update(selfbeatDailyQuestionsTable)
      .set(updates)
      .where(eq(selfbeatDailyQuestionsTable.id, parseInt(id, 10)));
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/daily-questions/:id error:", err);
    res.status(500).json({ error: "Failed to update question" });
  }
});

export default router;
