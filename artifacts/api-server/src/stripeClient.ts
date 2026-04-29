import Stripe from "stripe";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const directKey = process.env.STRIPE_SECRET_KEY;
  if (directKey) {
    return new Stripe(directKey);
  }
  try {
    const { getStripeSync } = await import("stripe-replit-sync");
    const sync = await getStripeSync();
    const credentials = sync.getCredentials();
    return new Stripe(credentials.secretKey);
  } catch {
    throw new Error(
      "Stripe not configured: set STRIPE_SECRET_KEY env var or connect the Stripe integration"
    );
  }
}

export function getStripeSync() {
  return import("stripe-replit-sync").then((m) => m.getStripeSync());
}
