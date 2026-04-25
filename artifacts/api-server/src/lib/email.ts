import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = "Selfbeat <noreply@selfbeat.ai>";

function logIfNoKey(subject: string) {
  console.log(`[email] RESEND_API_KEY not set — skipping: "${subject}"`);
}

export async function sendTrialStartEmail(to: string, name: string | null): Promise<void> {
  const client = getResend();
  const firstName = name?.split(" ")[0] || "there";
  const subject = "Your Selfbeat Pro trial has started";
  if (!client) { logIfNoKey(subject); return; }

  await client.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
        <h2 style="color:#7c3aed;">Your Selfbeat Pro trial has started 🎉</h2>
        <p>Hi ${firstName},</p>
        <p>You now have <strong>3 days of unlimited Pro access</strong>. Here's what you can do:</p>
        <ul>
          <li>Ask unlimited questions — no credit limits</li>
          <li>See all 11 AIs critique each other in Round 2</li>
          <li>Get the full verdict with scores and rankings</li>
          <li>Access the leaderboard</li>
          <li>Save your full history</li>
        </ul>
        <p>Your trial expires in <strong>3 days</strong>. To keep access, subscribe anytime at <a href="https://selfbeat.ai/pricing" style="color:#7c3aed;">selfbeat.ai/pricing</a>.</p>
        <p>Enjoy exploring!</p>
        <p style="color:#666;font-size:12px;">— The Selfbeat team</p>
      </div>
    `,
  });
}

export async function sendTrialReminderEmail(to: string, name: string | null, hoursLeft: number): Promise<void> {
  const client = getResend();
  const firstName = name?.split(" ")[0] || "there";
  const subject = "Your Selfbeat Pro trial ends tomorrow";
  if (!client) { logIfNoKey(subject); return; }

  await client.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
        <h2 style="color:#7c3aed;">Your trial ends in about ${hoursLeft} hours ⏰</h2>
        <p>Hi ${firstName},</p>
        <p>Don't lose your unlimited access. Your Selfbeat Pro trial ends tomorrow.</p>
        <p>Subscribe today for just <strong>$9.99/month</strong> to keep:</p>
        <ul>
          <li>Unlimited questions</li>
          <li>Full Round 2 AI self-critiques</li>
          <li>Scores, rankings, and full verdicts</li>
        </ul>
        <p><a href="https://selfbeat.ai/pricing" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Subscribe now — $9.99/month</a></p>
        <p style="color:#666;font-size:12px;">— The Selfbeat team</p>
      </div>
    `,
  });
}

export async function sendTrialExpiryEmail(to: string, name: string | null, discountCode: string): Promise<void> {
  const client = getResend();
  const firstName = name?.split(" ")[0] || "there";
  const subject = "Your Selfbeat Pro trial has ended";
  if (!client) { logIfNoKey(subject); return; }

  await client.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
        <h2 style="color:#7c3aed;">Your Pro trial has ended</h2>
        <p>Hi ${firstName},</p>
        <p>Your 3-day free trial has ended and your account has been reverted to the free tier.</p>
        <p>But we have a special offer for you: <strong>Get your first month of Pro for just $7.99</strong> — that's $2 off. This offer expires in <strong>24 hours</strong>.</p>
        <p><a href="https://selfbeat.ai/pricing?welcome_back=1" style="background:#f59e0b;color:#1a1a2e;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">Get first month for $7.99 →</a></p>
        <p style="color:#666;font-size:12px;">Offer applied automatically at checkout. Expires 24 hours after your trial ended.</p>
        <p style="color:#666;font-size:12px;">— The Selfbeat team</p>
      </div>
    `,
  });
}
