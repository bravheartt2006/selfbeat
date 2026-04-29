import { createStripeClient } from "./stripeClient.js";

const PRODUCTS = [
  {
    planId: "starter",
    name: "Selfbeat Starter Credits",
    description: "25 additional AI comparison credits — one-time purchase",
    mode: "payment" as const,
    currency: "usd",
    unitAmount: 499,
    interval: null,
  },
  {
    planId: "pro_monthly",
    name: "Selfbeat Pro Monthly",
    description: "Unlimited AI comparisons, self-critiques, and full verdict — billed monthly",
    mode: "subscription" as const,
    currency: "usd",
    unitAmount: 999,
    interval: "month" as const,
  },
  {
    planId: "pro_annual",
    name: "Selfbeat Pro Annual",
    description: "Unlimited AI comparisons, self-critiques, and full verdict — billed annually",
    mode: "subscription" as const,
    currency: "usd",
    unitAmount: 7900,
    interval: "year" as const,
  },
  {
    planId: "team",
    name: "Selfbeat Team",
    description: "Unlimited comparisons for up to 5 team members — billed monthly",
    mode: "subscription" as const,
    currency: "usd",
    unitAmount: 3900,
    interval: "month" as const,
  },
];

async function seedProducts() {
  const stripe = createStripeClient();

  console.log("Fetching existing Stripe products...");
  const { data: existing } = await stripe.products.list({ active: true, limit: 100 });
  const existingByPlanId = new Map(
    existing
      .filter((p) => p.metadata?.plan_id)
      .map((p) => [p.metadata.plan_id, p])
  );

  const priceIds: Record<string, string> = {};

  for (const def of PRODUCTS) {
    const existingProduct = existingByPlanId.get(def.planId);

    if (existingProduct) {
      console.log(`✓ Product "${def.name}" already exists (${existingProduct.id})`);
      const { data: prices } = await stripe.prices.list({
        product: existingProduct.id,
        active: true,
        limit: 1,
      });
      if (prices.length > 0) {
        priceIds[def.planId] = prices[0].id;
        console.log(`  Price: ${prices[0].id} (${prices[0].unit_amount! / 100} ${prices[0].currency.toUpperCase()})`);
      }
      continue;
    }

    console.log(`Creating product "${def.name}"...`);
    const product = await stripe.products.create({
      name: def.name,
      description: def.description,
      metadata: { plan_id: def.planId },
    });

    const priceParams: Parameters<typeof stripe.prices.create>[0] = {
      product: product.id,
      currency: def.currency,
      unit_amount: def.unitAmount,
      metadata: { plan_id: def.planId },
    };

    if (def.interval) {
      priceParams.recurring = { interval: def.interval };
    }

    const price = await stripe.prices.create(priceParams);
    priceIds[def.planId] = price.id;
    console.log(`  Created: product=${product.id}, price=${price.id}`);
  }

  console.log("\n=== Price IDs ===");
  for (const [planId, priceId] of Object.entries(priceIds)) {
    console.log(`  ${planId}: ${priceId}`);
  }
  console.log("\nDone! Update your pricing page if these IDs are new.");
}

seedProducts().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
