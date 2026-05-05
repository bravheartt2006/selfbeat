import type Stripe from "stripe";
import { sendEmail } from "./emailService";

const APP_URL = process.env.APP_URL?.replace(/\/$/, "") ?? "https://selfbeat.ai";
const FROM = "contact@selfbeat.ai";
const SUPPORT_EMAIL = "contact@selfbeat.ai";

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function planLabel(planType: string | null): string {
  if (planType === "annual") return "Selfbeat Pro (Annual)";
  if (planType === "team") return "Selfbeat Team";
  return "Selfbeat Pro (Monthly)";
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Selfbeat</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background:#7c3aed;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Selfbeat</span>
              <p style="margin:6px 0 0;color:#ddd6fe;font-size:13px;">11 AIs. One verdict.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:40px;border-radius:0 0 12px 12px;">
              ${content}

              <!-- Footer -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 24px;" />
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Questions? Reply to this email or contact us at
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                Selfbeat &bull; <a href="${APP_URL}/privacy" style="color:#9ca3af;">Privacy</a> &bull; <a href="${APP_URL}/terms" style="color:#9ca3af;">Terms</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="background:#7c3aed;border-radius:8px;">
        <a href="${url}" style="display:inline-block;padding:14px 32px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">${value}</td>
  </tr>`;
}

// ─── Payment Confirmation ────────────────────────────────────────────────────

export async function sendPaymentConfirmationEmail(opts: {
  userId: string;
  email: string;
  name: string | null;
  planType: string | null;
  amountCents: number;
  currency: string;
  creditsAdded: number;
  nextBillingDate: number | null;
  isSubscription: boolean;
}): Promise<void> {
  const firstName = opts.name?.split(" ")[0] || "there";
  const subject = "Welcome to Selfbeat Pro! Your subscription is active 🎉";
  const plan = planLabel(opts.planType);
  const amount = formatCurrency(opts.amountCents, opts.currency);

  const rows = [
    infoRow("Plan", plan),
    infoRow("Amount charged", amount),
    ...(opts.nextBillingDate
      ? [infoRow("Next billing date", formatDate(opts.nextBillingDate))]
      : []),
    ...(opts.creditsAdded > 0
      ? [infoRow("Credits added", `+${opts.creditsAdded} credits`)]
      : []),
  ];

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Payment confirmed 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hi ${firstName}, thank you for subscribing to Selfbeat!</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:8px;">
      ${rows.join("")}
    </table>

    <p style="margin:24px 0 8px;font-size:15px;color:#374151;">
      ${opts.isSubscription
        ? "You now have <strong>unlimited access</strong> to all 11 AI models, full Round 2 critiques, verdicts, scores, and rankings."
        : `<strong>${opts.creditsAdded} credits</strong> have been added to your account. Each credit lets you run one full AI comparison.`
      }
    </p>

    ${ctaButton("Start asking questions →", `${APP_URL}/selfbeat/`)}

    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Need help? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>
    </p>
  `;

  await sendEmail({
    to: opts.email,
    subject,
    html: emailWrapper(content),
    userId: opts.userId,
    emailType: "payment_confirmation",
  });
}

// ─── Subscription Renewed ────────────────────────────────────────────────────

export async function sendSubscriptionRenewedEmail(opts: {
  userId: string;
  email: string;
  name: string | null;
  planType: string | null;
  amountCents: number;
  currency: string;
  nextBillingDate: number | null;
}): Promise<void> {
  const firstName = opts.name?.split(" ")[0] || "there";
  const subject = "Your Selfbeat subscription has been renewed";
  const plan = planLabel(opts.planType);
  const amount = formatCurrency(opts.amountCents, opts.currency);

  const rows = [
    infoRow("Plan", plan),
    infoRow("Amount charged", amount),
    ...(opts.nextBillingDate
      ? [infoRow("Next renewal date", formatDate(opts.nextBillingDate))]
      : []),
  ];

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Subscription renewed ✓</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hi ${firstName}, your Selfbeat subscription has been successfully renewed.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:8px;">
      ${rows.join("")}
    </table>

    <p style="margin:24px 0 8px;font-size:15px;color:#374151;">
      Your <strong>unlimited access</strong> continues uninterrupted. Keep exploring what the world's best AI models think.
    </p>

    ${ctaButton("Go to Selfbeat →", `${APP_URL}/selfbeat/`)}

    <p style="font-size:13px;color:#9ca3af;margin:0;">
      To manage your subscription, visit <a href="${APP_URL}/selfbeat/pricing" style="color:#7c3aed;">your account</a>.
      Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>
    </p>
  `;

  await sendEmail({
    to: opts.email,
    subject,
    html: emailWrapper(content),
    userId: opts.userId,
    emailType: "subscription_renewed",
  });
}

// ─── Subscription Cancelled ──────────────────────────────────────────────────

export async function sendSubscriptionCancelledEmail(opts: {
  userId: string;
  email: string;
  name: string | null;
  planType: string | null;
}): Promise<void> {
  const firstName = opts.name?.split(" ")[0] || "there";
  const subject = "Your Selfbeat subscription has ended";
  const plan = planLabel(opts.planType);

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Subscription cancelled</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hi ${firstName}, your <strong>${plan}</strong> subscription has been cancelled.</p>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#92400e;">
        Your unlimited access has ended. You can still use Selfbeat with the free tier (limited credits).
      </p>
    </div>

    <p style="font-size:15px;color:#374151;margin:0 0 8px;">
      Changed your mind? You can resubscribe any time and pick up right where you left off.
    </p>

    ${ctaButton("Resubscribe →", `${APP_URL}/selfbeat/pricing`)}

    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>
    </p>
  `;

  await sendEmail({
    to: opts.email,
    subject,
    html: emailWrapper(content),
    userId: opts.userId,
    emailType: "subscription_cancelled",
  });
}

// ─── Payment Failed ──────────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(opts: {
  userId: string;
  email: string;
  name: string | null;
  amountCents: number;
  currency: string;
}): Promise<void> {
  const firstName = opts.name?.split(" ")[0] || "there";
  const subject = "Action required: Payment failed for your Selfbeat subscription";
  const amount = formatCurrency(opts.amountCents, opts.currency);

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Payment failed</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hi ${firstName}, we were unable to process your payment of <strong>${amount}</strong>.</p>

    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#991b1b;">
        Your subscription may be paused if we can't collect payment. Please update your payment method to avoid losing access.
      </p>
    </div>

    ${ctaButton("Update payment method →", `${APP_URL}/selfbeat/pricing`)}

    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>
    </p>
  `;

  await sendEmail({
    to: opts.email,
    subject,
    html: emailWrapper(content),
    userId: opts.userId,
    emailType: "payment_failed",
  });
}
