import { Router } from "express";
import { and, count, eq } from "drizzle-orm";
import { db, selfbeatVotesTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

router.get("/votes/:comparisonId", async (req: any, res: any) => {
  const { comparisonId } = req.params;
  const userId = (req.session as any)?.userId || (req.user as any)?.id || null;

  try {
    const rows = await db
      .select({ model: selfbeatVotesTable.votedForAi, cnt: count() })
      .from(selfbeatVotesTable)
      .where(eq(selfbeatVotesTable.comparisonId, comparisonId))
      .groupBy(selfbeatVotesTable.votedForAi);

    const counts: Record<string, number> = {};
    let totalVotes = 0;
    for (const row of rows) {
      counts[row.model] = Number(row.cnt);
      totalVotes += Number(row.cnt);
    }

    let myVote: string | null = null;
    if (userId) {
      const voteRow = await db
        .select({ votedForAi: selfbeatVotesTable.votedForAi })
        .from(selfbeatVotesTable)
        .where(
          and(
            eq(selfbeatVotesTable.userId, userId),
            eq(selfbeatVotesTable.comparisonId, comparisonId),
          ),
        )
        .limit(1);
      if (voteRow.length > 0) myVote = voteRow[0].votedForAi;
    }

    res.json({ counts, totalVotes, myVote });
  } catch (err) {
    console.error("GET /votes error:", err);
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

router.post("/votes", requireAuth, async (req: any, res: any) => {
  const { comparisonId, votedForAi } = req.body;
  const userId = req.userId as string;

  if (!comparisonId || !votedForAi) {
    return res.status(400).json({ error: "comparisonId and votedForAi are required" });
  }

  try {
    const existing = await db
      .select()
      .from(selfbeatVotesTable)
      .where(
        and(
          eq(selfbeatVotesTable.userId, userId),
          eq(selfbeatVotesTable.comparisonId, comparisonId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].votedForAi === votedForAi) {
        await db
          .delete(selfbeatVotesTable)
          .where(eq(selfbeatVotesTable.id, existing[0].id));
      } else {
        await db
          .update(selfbeatVotesTable)
          .set({ votedForAi })
          .where(eq(selfbeatVotesTable.id, existing[0].id));
      }
    } else {
      await db
        .insert(selfbeatVotesTable)
        .values({ userId, comparisonId, votedForAi });
    }

    const rows = await db
      .select({ model: selfbeatVotesTable.votedForAi, cnt: count() })
      .from(selfbeatVotesTable)
      .where(eq(selfbeatVotesTable.comparisonId, comparisonId))
      .groupBy(selfbeatVotesTable.votedForAi);

    const counts: Record<string, number> = {};
    let totalVotes = 0;
    for (const row of rows) {
      counts[row.model] = Number(row.cnt);
      totalVotes += Number(row.cnt);
    }

    const myVoteRow = await db
      .select({ votedForAi: selfbeatVotesTable.votedForAi })
      .from(selfbeatVotesTable)
      .where(
        and(
          eq(selfbeatVotesTable.userId, userId),
          eq(selfbeatVotesTable.comparisonId, comparisonId),
        ),
      )
      .limit(1);

    const myVote = myVoteRow.length > 0 ? myVoteRow[0].votedForAi : null;

    res.json({ counts, totalVotes, myVote });
  } catch (err) {
    console.error("POST /votes error:", err);
    res.status(500).json({ error: "Failed to submit vote" });
  }
});

export default router;
