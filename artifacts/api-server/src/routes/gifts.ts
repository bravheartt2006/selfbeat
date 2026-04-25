import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, selfbeatUsersTable, selfbeatGiftsTable } from "@workspace/db";
import { sendEmail } from "../services/emailService";

const router = Router();

const GIFT_AMOUNTS = [5, 10, 25];
const APP_URL = () => process.env.APP_URL ?? "https://selfbeat.ai";

function giftReceivedHtml(senderName: string, credits: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111827;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:36px 40px;text-align:center;border-bottom:1px solid #1e2c4a;">
          <div style="font-size:36px;margin-bottom:8px;">🎁</div>
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#f1f5f9;">You've Got a Gift!</div>
          <div style="color:#94a3b8;font-size:14px;margin-top:6px;">Selfbeat credits are waiting for you</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;color:#cbd5e1;font-size:16px;">Hi there 👋</p>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.7;">
            <strong style="color:#e2e8f0;">${senderName}</strong> just sent you
            <strong style="color:#c8b560;">${credits} Selfbeat credits</strong> as a gift!
            Sign in to claim them and start asking AI models the toughest questions.
          </p>
          <div style="background:#0f172a;border:1px solid #c8b560/30;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="color:#64748b;font-size:12px;text-transform:uppercase;margin-bottom:8px;">Your Gift</div>
            <div style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:#c8b560;">${credits}</div>
            <div style="color:#94a3b8;font-size:14px;">Selfbeat credits</div>
          </div>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;line-height:1.6;">
            Selfbeat is where 11 AI models answer your questions, self-critique each other, and deliver a verdict. It's wild — try it!
          </p>
          <div style="text-align:center;">
            <a href="${APP_URL()}" style="display:inline-block;background:linear-gradient(135deg,#c8b560,#a09040);color:#0b1120;text-decoration:none;font-weight:700;font-size:14px;padding:12px 32px;border-radius:999px;">Claim My Credits →</a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #1e2c4a;">
          <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Selfbeat · Physician-founded</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── POST /api/gifts — send gift credits ───────────────────────────────────────

router.post("/gifts", async (req, res) => {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ error: "Not signed in" });

  const { receiverEmail, credits } = req.body as { receiverEmail?: string; credits?: number };

  if (!receiverEmail || !receiverEmail.includes("@")) {
    return res.status(400).json({ error: "Valid receiver email is required" });
  }
  if (!credits || !GIFT_AMOUNTS.includes(credits)) {
    return res.status(400).json({ error: `Credits must be one of: ${GIFT_AMOUNTS.join(", ")}` });
  }

  const normalizedEmail = receiverEmail.trim().toLowerCase();

  try {
    // Get sender
    const [sender] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId));

    if (!sender) return res.status(404).json({ error: "Sender not found" });
    if (sender.email?.toLowerCase() === normalizedEmail) {
      return res.status(400).json({ error: "You cannot gift credits to yourself" });
    }
    if (!sender.hasUnlimited && sender.credits < credits) {
      return res.status(400).json({ error: `Insufficient credits. You have ${sender.credits} but tried to gift ${credits}.` });
    }

    // Deduct from sender
    await db
      .update(selfbeatUsersTable)
      .set({ credits: sender.credits - credits })
      .where(eq(selfbeatUsersTable.id, userId));

    // Check if receiver exists
    const [receiver] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.email, normalizedEmail));

    const senderName = sender.displayName ?? sender.email?.split("@")[0] ?? "A Selfbeat user";

    if (receiver) {
      // Deliver immediately
      await db
        .update(selfbeatUsersTable)
        .set({ credits: receiver.credits + credits })
        .where(eq(selfbeatUsersTable.id, receiver.id));

      await db.insert(selfbeatGiftsTable).values({
        senderId: userId,
        receiverEmail: normalizedEmail,
        receiverId: receiver.id,
        credits,
        status: "delivered",
      });

      // Email receiver
      await sendEmail({
        to: normalizedEmail,
        subject: `${senderName} gifted you ${credits} Selfbeat credits! 🎁`,
        html: giftReceivedHtml(senderName, credits),
        userId,
        emailType: "gift_delivered",
      });

      return res.json({ success: true, status: "delivered", newCredits: sender.credits - credits });
    } else {
      // Store pending gift
      await db.insert(selfbeatGiftsTable).values({
        senderId: userId,
        receiverEmail: normalizedEmail,
        credits,
        status: "pending",
      });

      // Email the future receiver
      await sendEmail({
        to: normalizedEmail,
        subject: `${senderName} gifted you ${credits} Selfbeat credits! 🎁`,
        html: giftReceivedHtml(senderName, credits),
        userId,
        emailType: "gift_pending",
      });

      return res.json({ success: true, status: "pending", newCredits: sender.credits - credits });
    }
  } catch (err) {
    console.error("[gifts] POST /gifts error:", err);
    return res.status(500).json({ error: "Failed to send gift" });
  }
});

// ── GET /api/gifts/pending/:email — check + apply pending gifts ────────────────

router.get("/gifts/pending/:email", async (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const pending = await db
      .select()
      .from(selfbeatGiftsTable)
      .where(eq(selfbeatGiftsTable.receiverEmail, email.toLowerCase()));

    const pendingGifts = pending.filter((g) => g.status === "pending");
    return res.json({ pendingGifts });
  } catch (err) {
    console.error("[gifts] GET /gifts/pending error:", err);
    return res.status(500).json({ error: "Failed to check pending gifts" });
  }
});

// ── Apply pending gifts for a newly registered user ───────────────────────────

export async function applyPendingGifts(userId: string, email: string): Promise<number> {
  try {
    const pendingGifts = await db
      .select()
      .from(selfbeatGiftsTable)
      .where(eq(selfbeatGiftsTable.receiverEmail, email.toLowerCase()));

    const toApply = pendingGifts.filter((g) => g.status === "pending");
    if (!toApply.length) return 0;

    let totalCredits = 0;
    for (const gift of toApply) {
      totalCredits += gift.credits;
      await db
        .update(selfbeatGiftsTable)
        .set({ status: "claimed", receiverId: userId })
        .where(eq(selfbeatGiftsTable.id, gift.id));
    }

    // Add all credits to new user in one update
    const [user] = await db.select({ credits: selfbeatUsersTable.credits }).from(selfbeatUsersTable).where(eq(selfbeatUsersTable.id, userId));
    if (user) {
      await db.update(selfbeatUsersTable).set({ credits: user.credits + totalCredits }).where(eq(selfbeatUsersTable.id, userId));
    }

    return totalCredits;
  } catch (err) {
    console.error("[gifts] applyPendingGifts error:", err);
    return 0;
  }
}

export default router;
