import { Router } from "express";
import { randomBytes } from "crypto";
import { eq, and, count } from "drizzle-orm";
import { db, selfbeatUsersTable, selfbeatReferralsTable } from "@workspace/db";
import { sendEmail } from "../services/emailService";

const router = Router();

export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "SELF-";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const [user] = await db
    .select({ referralCode: selfbeatUsersTable.referralCode })
    .from(selfbeatUsersTable)
    .where(eq(selfbeatUsersTable.id, userId));

  if (user?.referralCode) return user.referralCode;

  // Generate unique code
  let code = generateReferralCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db
      .select({ id: selfbeatUsersTable.id })
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.referralCode, code));
    if (!existing.length) break;
    code = generateReferralCode();
    attempts++;
  }

  await db
    .update(selfbeatUsersTable)
    .set({ referralCode: code })
    .where(eq(selfbeatUsersTable.id, userId));

  return code;
}

// ── GET /api/referral — get code + stats ──────────────────────────────────────

router.get("/referral", async (req, res) => {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ error: "Not signed in" });

  try {
    const code = await ensureReferralCode(userId);
    const appUrl = process.env.APP_URL ?? "https://selfbeat.ai";
    const referralLink = `${appUrl}/?ref=${code}`;

    // Count referrals
    const allReferrals = await db
      .select()
      .from(selfbeatReferralsTable)
      .where(eq(selfbeatReferralsTable.referrerId, userId));

    const totalReferred = allReferrals.length;
    const completed = allReferrals.filter((r) => r.completed).length;
    const creditsEarned = completed * 10;

    return res.json({ code, referralLink, totalReferred, completed, creditsEarned });
  } catch (err) {
    console.error("[referral] /referral GET error:", err);
    return res.status(500).json({ error: "Failed to get referral info" });
  }
});

// ── POST /api/referral/claim — called by frontend after auth with stored ref code

router.post("/referral/claim", async (req, res) => {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ error: "Not signed in" });

  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: "code required" });

  try {
    // Find referrer by code
    const [referrer] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.referralCode, code));

    if (!referrer) return res.status(404).json({ error: "Invalid referral code" });
    if (referrer.id === userId) return res.status(400).json({ error: "Cannot refer yourself" });

    // Check if referral already exists for this user
    const existing = await db
      .select()
      .from(selfbeatReferralsTable)
      .where(eq(selfbeatReferralsTable.referredUserId, userId));

    if (existing.length > 0) return res.json({ success: true, alreadyClaimed: true });

    // Create referral record
    await db.insert(selfbeatReferralsTable).values({
      referrerId: referrer.id,
      referredUserId: userId,
      referralCode: code,
    });

    // Award 5 bonus credits to the new user
    const [currentUser] = await db
      .select({ credits: selfbeatUsersTable.credits })
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId));

    if (currentUser) {
      await db
        .update(selfbeatUsersTable)
        .set({ credits: currentUser.credits + 5 })
        .where(eq(selfbeatUsersTable.id, userId));
    }

    return res.json({ success: true, bonusCredits: 5 });
  } catch (err) {
    console.error("[referral] /referral/claim error:", err);
    return res.status(500).json({ error: "Failed to claim referral" });
  }
});

// ── Trigger referral completion on first question ─────────────────────────────

export async function handleFirstQuestionReferral(userId: string): Promise<void> {
  try {
    // Find incomplete referral for this user
    const [referral] = await db
      .select()
      .from(selfbeatReferralsTable)
      .where(
        and(
          eq(selfbeatReferralsTable.referredUserId, userId),
          eq(selfbeatReferralsTable.completed, false),
        )
      );

    if (!referral) return;

    // Mark as completed + credits awarded
    await db
      .update(selfbeatReferralsTable)
      .set({ completed: true, creditsAwarded: true })
      .where(eq(selfbeatReferralsTable.id, referral.id));

    // Award 10 credits to referrer
    const [referrer] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, referral.referrerId));

    if (!referrer) return;

    await db
      .update(selfbeatUsersTable)
      .set({ credits: referrer.credits + 10 })
      .where(eq(selfbeatUsersTable.id, referral.referrerId));

    // Send email to referrer
    if (referrer.email) {
      const appUrl = process.env.APP_URL ?? "https://selfbeat.ai";
      await sendEmail({
        to: referrer.email,
        subject: "Someone just joined Selfbeat using your referral link! 🎉",
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111827;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:36px 40px;text-align:center;border-bottom:1px solid #1e2c4a;">
          <div style="font-size:32px;margin-bottom:8px;">🎉</div>
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#f1f5f9;">Referral Success!</div>
          <div style="color:#94a3b8;font-size:14px;margin-top:6px;">Someone joined Selfbeat through your link</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;color:#cbd5e1;font-size:16px;">Hi ${referrer.displayName ?? "there"} 👋</p>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.7;">
            Great news! A friend just joined Selfbeat using your referral link and asked their first question.
            As promised, we've added <strong style="color:#c8b560;">10 bonus credits</strong> to your account.
          </p>
          <div style="background:#0f172a;border:1px solid #1e2c4a;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="color:#64748b;font-size:12px;text-transform:uppercase;margin-bottom:8px;">Credits Added</div>
            <div style="font-family:Georgia,serif;font-size:40px;font-weight:700;color:#c8b560;">+10</div>
          </div>
          <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.7;">
            Keep sharing your referral link to earn more credits for every friend who joins!
          </p>
          <div style="text-align:center;">
            <a href="${appUrl}/settings" style="display:inline-block;background:linear-gradient(135deg,#c8b560,#a09040);color:#0b1120;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;">View My Referral Link →</a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #1e2c4a;">
          <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Selfbeat</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        userId: referral.referrerId,
        emailType: "referral_complete",
      });
    }
  } catch (err) {
    console.error("[referral] handleFirstQuestionReferral error:", err);
  }
}

export default router;
