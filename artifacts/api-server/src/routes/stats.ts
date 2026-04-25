import { Router } from "express";
import { count } from "drizzle-orm";
import { gte } from "drizzle-orm";
import { db, selfbeatSettingsTable, selfbeatComparisonsTable, selfbeatUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── 30-second in-memory cache ────────────────────────────────────────────────
let cachedStats: {
  totalQuestions: number;
  questionsToday: number;
  totalUsers: number;
  comparisonsCompleted: number;
} | null = null;
let cacheExpiry = 0;

const DEFAULT_OFFSETS: Record<string, number> = {
  counter_offset_questions: 1000,
  counter_offset_today: 50,
  counter_offset_users: 500,
  counter_offset_comparisons: 800,
};

async function getOffsets(): Promise<Record<string, number>> {
  const offsets = { ...DEFAULT_OFFSETS };
  try {
    const rows = await db.select().from(selfbeatSettingsTable);
    for (const row of rows) {
      if (row.key in offsets) {
        offsets[row.key] = parseInt(row.value, 10) || 0;
      }
    }
  } catch {
    // use defaults
  }
  return offsets;
}

async function computeStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalQRows,
    todayQRows,
    totalURows,
    offsets,
  ] = await Promise.all([
    db.select({ total: count() }).from(selfbeatComparisonsTable),
    db.select({ total: count() }).from(selfbeatComparisonsTable).where(
      gte(selfbeatComparisonsTable.createdAt, todayStart)
    ),
    db.select({ total: count() }).from(selfbeatUsersTable),
    getOffsets(),
  ]);

  const totalQn = totalQRows[0]?.total ?? 0;
  const todayQn = todayQRows[0]?.total ?? 0;
  const totalUn = totalURows[0]?.total ?? 0;

  return {
    totalQuestions: totalQn + offsets.counter_offset_questions,
    questionsToday: todayQn + offsets.counter_offset_today,
    totalUsers: totalUn + offsets.counter_offset_users,
    comparisonsCompleted: totalQn + offsets.counter_offset_comparisons,
  };
}

router.get("/stats", async (_req, res) => {
  const now = Date.now();
  if (cachedStats && now < cacheExpiry) {
    return res.json(cachedStats);
  }

  try {
    const stats = await computeStats();
    cachedStats = stats;
    cacheExpiry = now + 30_000;
    return res.json(stats);
  } catch (err) {
    console.error("Stats error:", err);
    if (cachedStats) return res.json(cachedStats);
    return res.status(500).json({ error: "Stats unavailable" });
  }
});

export default router;
