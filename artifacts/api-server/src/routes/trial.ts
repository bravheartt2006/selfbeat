import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { requireAuth } from "./users";
import { sendTrialStartEmail } from "../lib/email";

const router = Router();

router.post("/start", requireAuth, async (req: any, res) => {
  const { userId } = req;

  try {
    const [user] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.trialUsed) {
      return res.status(409).json({ error: "Trial already used" });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    await db
      .update(selfbeatUsersTable)
      .set({
        trialUsed: true,
        trialStartDate: now,
        trialEndDate: trialEnd,
      })
      .where(eq(selfbeatUsersTable.id, userId));

    // Send start email (fire and forget)
    if (user.email) {
      sendTrialStartEmail(user.email, user.displayName).catch(() => {});
    }

    return res.json({
      ok: true,
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
    });
  } catch (err: any) {
    console.error("Trial start error:", err);
    return res.status(500).json({ error: "Failed to start trial" });
  }
});

export default router;
