import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, selfbeatFeaturedResultsTable, selfbeatComparisonsTable, selfbeatUsersTable } from "@workspace/db";

const router = Router();

// ── Admin helper ─────────────────────────────────────────────────────────────

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.session?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const user = await db.query.selfbeatUsersTable.findFirst({ where: eq(selfbeatUsersTable.id, userId) });
  if (!user || !user.email || user.email !== process.env.ADMIN_EMAIL) {
    res.status(403).json({ error: "Forbidden" }); return false;
  }
  return true;
}

// ── Build rich result (join comparison data) ──────────────────────────────────

async function enrichFeatured(rows: typeof selfbeatFeaturedResultsTable.$inferSelect[]) {
  const results = await Promise.all(rows.map(async (row) => {
    const comparison = await db.query.selfbeatComparisonsTable.findFirst({
      where: eq(selfbeatComparisonsTable.id, row.comparisonId),
    });
    if (!comparison) return null;
    const result = comparison.result as any;
    const responses: any[] = result?.responses ?? [];
    const winner = result?.verdictDetails?.overallWinner ?? null;

    // Most surprising = biggest gap between round1 base and self-critique score
    let highlightQuote = row.highlightQuote;
    if (!highlightQuote) {
      const best = responses
        .filter((r: any) => r.selfCriticism && !r.declined)
        .sort((a: any, b: any) => (b.selfAwarenessScore ?? 0) - (a.selfAwarenessScore ?? 0))[0];
      if (best?.selfCriticism) {
        const sentences = best.selfCriticism.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
        highlightQuote = sentences[0]?.trim() ?? null;
      }
    }

    // Vote count from result metadata or selfbeat_votes
    const voteCount = (result?.voteCount ?? 0) as number;

    // Surprise score: avg gap between accuracyScore and selfAwarenessScore
    const scoredResponses = responses.filter((r: any) => r.accuracyScore != null && r.selfAwarenessScore != null);
    const surpriseScore = scoredResponses.length
      ? scoredResponses.reduce((acc: number, r: any) => acc + Math.abs((r.accuracyScore ?? 0) - (r.selfAwarenessScore ?? 0)), 0) / scoredResponses.length
      : 0;

    return {
      id: row.id,
      comparisonId: row.comparisonId,
      question: comparison.question,
      winner,
      highlightQuote: highlightQuote ?? null,
      voteCount,
      surpriseScore,
      status: row.status,
      isTodayFeatured: row.isTodayFeatured,
      viewCount: row.viewCount,
      createdAt: row.createdAt.toISOString(),
      featuredAt: row.featuredAt?.toISOString() ?? null,
      submittedBy: row.submittedBy,
      adminNote: row.adminNote,
    };
  }));
  return results.filter(Boolean);
}

// ── GET /api/featured — list approved (public) ────────────────────────────────

router.get("/featured", async (req, res) => {
  try {
    const sort = (req.query.sort as string) || "voted";
    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = 12;
    const offset = (page - 1) * limit;

    // Filter by today's featured
    if (sort === "today") {
      const rows = await db.query.selfbeatFeaturedResultsTable.findMany({
        where: and(
          eq(selfbeatFeaturedResultsTable.status, "approved"),
          eq(selfbeatFeaturedResultsTable.isTodayFeatured, true),
        ),
        orderBy: [desc(selfbeatFeaturedResultsTable.featuredAt)],
        limit,
        offset,
      });
      const enriched = await enrichFeatured(rows);
      return res.json({ results: enriched, page, hasMore: enriched.length === limit });
    }

    let rows = await db.query.selfbeatFeaturedResultsTable.findMany({
      where: eq(selfbeatFeaturedResultsTable.status, "approved"),
      orderBy: [desc(selfbeatFeaturedResultsTable.featuredAt)],
      limit: 200,
    });
    let enriched = (await enrichFeatured(rows)) as any[];

    // Apply search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter((r: any) =>
        r.question?.toLowerCase().includes(q) ||
        r.winner?.toLowerCase().includes(q) ||
        r.highlightQuote?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sort === "voted") {
      enriched.sort((a: any, b: any) => b.voteCount - a.voteCount);
    } else if (sort === "recent") {
      enriched.sort((a: any, b: any) => new Date(b.featuredAt ?? b.createdAt).getTime() - new Date(a.featuredAt ?? a.createdAt).getTime());
    } else if (sort === "surprising") {
      enriched.sort((a: any, b: any) => b.surpriseScore - a.surpriseScore);
    }

    const paged = enriched.slice(offset, offset + limit);
    return res.json({ results: paged, page, hasMore: enriched.length > offset + limit });
  } catch (err) {
    console.error("[featured] GET /featured:", err);
    res.status(500).json({ error: "Failed to fetch featured results" });
  }
});

// ── GET /api/featured/:id — single result (increments view) ───────────────────

router.get("/featured/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.query.selfbeatFeaturedResultsTable.findFirst({
      where: and(
        eq(selfbeatFeaturedResultsTable.id, id),
        eq(selfbeatFeaturedResultsTable.status, "approved"),
      ),
    });
    if (!row) return res.status(404).json({ error: "Not found" });

    // Increment view count
    await db.update(selfbeatFeaturedResultsTable)
      .set({ viewCount: sql`${selfbeatFeaturedResultsTable.viewCount} + 1` })
      .where(eq(selfbeatFeaturedResultsTable.id, id));

    const comparison = await db.query.selfbeatComparisonsTable.findFirst({
      where: eq(selfbeatComparisonsTable.id, row.comparisonId),
    });
    if (!comparison) return res.status(404).json({ error: "Comparison not found" });

    const result = comparison.result as any;
    const responses: any[] = result?.responses ?? [];
    const winner = result?.verdictDetails?.overallWinner ?? null;

    let highlightQuote = row.highlightQuote;
    if (!highlightQuote) {
      const best = responses
        .filter((r: any) => r.selfCriticism && !r.declined)
        .sort((a: any, b: any) => (b.selfAwarenessScore ?? 0) - (a.selfAwarenessScore ?? 0))[0];
      if (best?.selfCriticism) {
        const sentences = best.selfCriticism.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
        highlightQuote = sentences[0]?.trim() ?? null;
      }
    }

    return res.json({
      id: row.id,
      comparisonId: row.comparisonId,
      question: comparison.question,
      winner,
      highlightQuote: highlightQuote ?? null,
      voteCount: (result?.voteCount ?? 0) as number,
      isTodayFeatured: row.isTodayFeatured,
      viewCount: (row.viewCount ?? 0) + 1,
      createdAt: row.createdAt.toISOString(),
      featuredAt: row.featuredAt?.toISOString() ?? null,
      result: comparison.result,
    });
  } catch (err) {
    console.error("[featured] GET /featured/:id:", err);
    res.status(500).json({ error: "Failed to fetch result" });
  }
});

// ── POST /api/featured/submit — user submits a comparison ────────────────────

router.post("/featured/submit", async (req, res) => {
  try {
    const userId = (req as any).session?.userId as string | undefined;
    if (!userId) return res.status(401).json({ error: "Sign in to submit" });

    const { comparisonId, highlightQuote } = req.body as { comparisonId?: string; highlightQuote?: string };
    if (!comparisonId) return res.status(400).json({ error: "comparisonId required" });

    // Check comparison exists
    const comparison = await db.query.selfbeatComparisonsTable.findFirst({
      where: eq(selfbeatComparisonsTable.id, comparisonId),
    });
    if (!comparison) return res.status(404).json({ error: "Comparison not found" });

    // Prevent duplicate submissions
    const existing = await db.query.selfbeatFeaturedResultsTable.findFirst({
      where: eq(selfbeatFeaturedResultsTable.comparisonId, comparisonId),
    });
    if (existing) {
      return res.json({ success: true, alreadySubmitted: true, status: existing.status });
    }

    const [inserted] = await db.insert(selfbeatFeaturedResultsTable).values({
      comparisonId,
      submittedBy: userId,
      status: "pending",
      highlightQuote: highlightQuote || null,
    }).returning();

    return res.json({ success: true, id: inserted.id, status: "pending" });
  } catch (err) {
    console.error("[featured] POST /featured/submit:", err);
    res.status(500).json({ error: "Failed to submit" });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /api/featured/admin/pending — all pending submissions
router.get("/featured/admin/pending", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const rows = await db.query.selfbeatFeaturedResultsTable.findMany({
      where: eq(selfbeatFeaturedResultsTable.status, "pending"),
      orderBy: [desc(selfbeatFeaturedResultsTable.createdAt)],
    });
    const enriched = await enrichFeatured(rows);
    res.json({ results: enriched });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// GET /api/featured/admin/all — all featured results (any status)
router.get("/featured/admin/all", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const rows = await db.query.selfbeatFeaturedResultsTable.findMany({
      orderBy: [desc(selfbeatFeaturedResultsTable.createdAt)],
      limit: 100,
    });
    const enriched = await enrichFeatured(rows);
    res.json({ results: enriched });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// PUT /api/featured/:id/approve
router.put("/featured/:id/approve", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { highlightQuote, adminNote } = req.body ?? {};
    await db.update(selfbeatFeaturedResultsTable)
      .set({
        status: "approved",
        featuredAt: new Date(),
        ...(highlightQuote ? { highlightQuote } : {}),
        ...(adminNote ? { adminNote } : {}),
      })
      .where(eq(selfbeatFeaturedResultsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve" });
  }
});

// PUT /api/featured/:id/reject
router.put("/featured/:id/reject", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { adminNote } = req.body ?? {};
    await db.update(selfbeatFeaturedResultsTable)
      .set({ status: "rejected", ...(adminNote ? { adminNote } : {}) })
      .where(eq(selfbeatFeaturedResultsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject" });
  }
});

// POST /api/featured/admin/feature — manually feature a comparison by ID
router.post("/featured/admin/feature", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const { comparisonId, highlightQuote } = req.body ?? {};
    if (!comparisonId) return res.status(400).json({ error: "comparisonId required" });

    const comparison = await db.query.selfbeatComparisonsTable.findFirst({
      where: eq(selfbeatComparisonsTable.id, comparisonId),
    });
    if (!comparison) return res.status(404).json({ error: "Comparison not found" });

    const existing = await db.query.selfbeatFeaturedResultsTable.findFirst({
      where: eq(selfbeatFeaturedResultsTable.comparisonId, comparisonId),
    });
    if (existing) {
      await db.update(selfbeatFeaturedResultsTable)
        .set({ status: "approved", featuredAt: new Date(), ...(highlightQuote ? { highlightQuote } : {}) })
        .where(eq(selfbeatFeaturedResultsTable.comparisonId, comparisonId));
    } else {
      await db.insert(selfbeatFeaturedResultsTable).values({
        comparisonId,
        status: "approved",
        featuredAt: new Date(),
        highlightQuote: highlightQuote || null,
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to feature" });
  }
});

// DELETE /api/featured/:id — remove from featured
router.delete("/featured/:id", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    await db.delete(selfbeatFeaturedResultsTable)
      .where(eq(selfbeatFeaturedResultsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// PUT /api/featured/:id/set-today — set as today's featured
router.put("/featured/:id/set-today", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    // Clear all current today flags
    await db.update(selfbeatFeaturedResultsTable)
      .set({ isTodayFeatured: false })
      .where(eq(selfbeatFeaturedResultsTable.isTodayFeatured, true));
    // Set the new one
    await db.update(selfbeatFeaturedResultsTable)
      .set({ isTodayFeatured: true, status: "approved", featuredAt: new Date() })
      .where(eq(selfbeatFeaturedResultsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to set today's featured" });
  }
});

export default router;
