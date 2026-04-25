import { Resend } from "resend";
import { db, selfbeatEmailLogsTable } from "@workspace/db";
import { randomBytes } from "crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? "Selfbeat <hello@selfbeat.ai>";
const APP_URL = process.env.APP_URL ?? "https://selfbeat.ai";

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn("[EmailService] RESEND_API_KEY not set — emails will be logged but not sent.");
}

export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("hex");
}

export function buildUnsubscribeUrl(token: string): string {
  return `${APP_URL}/unsubscribe/${token}`;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  userId,
  emailType,
}: {
  to: string;
  subject: string;
  html: string;
  userId: string;
  emailType: string;
}): Promise<SendResult> {
  let status = "sent";
  let error: string | undefined;
  let messageId: string | undefined;

  if (!resend) {
    console.log(`[EmailService] MOCK SEND to=${to} subject="${subject}" type=${emailType}`);
    status = "skipped_no_key";
  } else {
    try {
      const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      if (result.error) {
        status = "failed";
        error = result.error.message;
      } else {
        messageId = result.data?.id;
      }
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }
  }

  try {
    await db.insert(selfbeatEmailLogsTable).values({
      userId,
      emailType,
      status,
      error: error ?? null,
      recipientEmail: to,
    });
  } catch (logErr) {
    console.error("[EmailService] Failed to write email log:", logErr);
  }

  return { success: status === "sent" || status === "skipped_no_key", messageId, error };
}
