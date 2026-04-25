import { Router } from "express";
import { db, selfbeatEmailPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateUnsubscribeToken } from "../services/emailService";

const router = Router();

// ── GET /api/email-preferences ───────────────────────────────────────────────

router.get("/email-preferences", async (req, res) => {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ error: "Not signed in" });

  let [prefs] = await db
    .select()
    .from(selfbeatEmailPreferencesTable)
    .where(eq(selfbeatEmailPreferencesTable.userId, userId));

  if (!prefs) {
    // Return defaults without persisting
    return res.json({
      weeklyDigest: true,
      streakReminders: true,
      creditWarnings: true,
      promotional: true,
      unsubscribedAt: null,
    });
  }

  return res.json({
    weeklyDigest: prefs.weeklyDigest,
    streakReminders: prefs.streakReminders,
    creditWarnings: prefs.creditWarnings,
    promotional: prefs.promotional,
    unsubscribedAt: prefs.unsubscribedAt,
  });
});

// ── PUT /api/email-preferences ───────────────────────────────────────────────

router.put("/email-preferences", async (req, res) => {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ error: "Not signed in" });

  const { weeklyDigest, streakReminders, creditWarnings, promotional } = req.body;

  // Ensure token exists
  const [existing] = await db
    .select({ token: selfbeatEmailPreferencesTable.unsubscribeToken })
    .from(selfbeatEmailPreferencesTable)
    .where(eq(selfbeatEmailPreferencesTable.userId, userId));

  const token = existing?.token ?? generateUnsubscribeToken();

  await db
    .insert(selfbeatEmailPreferencesTable)
    .values({
      userId,
      weeklyDigest: weeklyDigest ?? true,
      streakReminders: streakReminders ?? true,
      creditWarnings: creditWarnings ?? true,
      promotional: promotional ?? true,
      unsubscribeToken: token,
      unsubscribedAt: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: selfbeatEmailPreferencesTable.userId,
      set: {
        weeklyDigest: weeklyDigest ?? true,
        streakReminders: streakReminders ?? true,
        creditWarnings: creditWarnings ?? true,
        promotional: promotional ?? true,
        unsubscribedAt: null,
        updatedAt: new Date(),
      },
    });

  return res.json({ success: true });
});

// ── GET /api/unsubscribe/:token ───────────────────────────────────────────────

router.get("/unsubscribe/:token", async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: "Invalid token" });

  const [prefs] = await db
    .select()
    .from(selfbeatEmailPreferencesTable)
    .where(eq(selfbeatEmailPreferencesTable.unsubscribeToken, token));

  if (!prefs) return res.status(404).json({ error: "Token not found" });
  if (prefs.unsubscribedAt) return res.json({ success: true, alreadyUnsubscribed: true });

  await db
    .update(selfbeatEmailPreferencesTable)
    .set({
      unsubscribedAt: new Date(),
      weeklyDigest: false,
      streakReminders: false,
      creditWarnings: false,
      promotional: false,
      updatedAt: new Date(),
    })
    .where(eq(selfbeatEmailPreferencesTable.unsubscribeToken, token));

  return res.json({ success: true, alreadyUnsubscribed: false });
});

// ── POST /api/resubscribe/:token ─────────────────────────────────────────────

router.post("/resubscribe/:token", async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: "Invalid token" });

  const [prefs] = await db
    .select()
    .from(selfbeatEmailPreferencesTable)
    .where(eq(selfbeatEmailPreferencesTable.unsubscribeToken, token));

  if (!prefs) return res.status(404).json({ error: "Token not found" });

  await db
    .update(selfbeatEmailPreferencesTable)
    .set({
      unsubscribedAt: null,
      weeklyDigest: true,
      streakReminders: true,
      creditWarnings: true,
      promotional: true,
      updatedAt: new Date(),
    })
    .where(eq(selfbeatEmailPreferencesTable.unsubscribeToken, token));

  return res.json({ success: true });
});

export default router;
