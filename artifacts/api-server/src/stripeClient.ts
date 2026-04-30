import Stripe from "stripe";
import { logger } from "./lib/logger";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const directKey = process.env.STRIPE_SECRET_KEY;
  if (directKey) {
    const prefix = directKey.substring(0, 12);
    const mode = directKey.startsWith("sk_test_") ? "TEST" : "LIVE";
    logger.info({ keyPrefix: prefix, mode }, "Stripe client initialised");
    return new Stripe(directKey);
  }
  try {
    const { getStripeSync } = await import("stripe-replit-sync");
    const sync = await getStripeSync();
    const credentials = sync.getCredentials();
    const key = credentials.secretKey;
    const prefix = key.substring(0, 12);
    const mode = key.startsWith("sk_test_") ? "TEST" : "LIVE";
    logger.warn({ keyPrefix: prefix, mode }, "Stripe client initialised via stripe-replit-sync (fallback)");
    return new Stripe(key);
  } catch {
    throw new Error(
      "Stripe not configured: set STRIPE_SECRET_KEY env var or connect the Stripe integration"
    );
  }
}

export function getStripeSync() {
  return import("stripe-replit-sync").then((m) => m.getStripeSync());
}
