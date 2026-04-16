import Stripe from "stripe";

let _stripeClient: Stripe | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { getStripeSync } = await import("stripe-replit-sync");
  const sync = await getStripeSync();
  const credentials = sync.getCredentials();
  return new Stripe(credentials.secretKey, { apiVersion: "2025-02-24.acacia" as any });
}

export function getStripeSync() {
  return import("stripe-replit-sync").then((m) => m.getStripeSync());
}
