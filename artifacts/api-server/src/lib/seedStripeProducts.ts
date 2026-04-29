import { logger } from "./logger";
import { getUncachableStripeClient } from "../stripeClient";

const PRODUCTS_TO_SEED = [
  {
    planId: "starter",
    name: "Selfbeat Starter Credits",
    description: "25 additional AI comparison credits — one-time purchase",
    unitAmount: 499,
    currency: "usd",
    interval: null as null,
  },
  {
    planId: "pro_monthly",
    name: "Selfbeat Pro Monthly",
    description: "Unlimited AI comparisons, self-critiques, and full verdict — billed monthly",
    unitAmount: 999,
    currency: "usd",
    interval: "month" as const,
  },
  {
    planId: "pro_annual",
    name: "Selfbeat Pro Annual",
    description: "Unlimited AI comparisons, self-critiques, and full verdict — billed annually",
    unitAmount: 7900,
    currency: "usd",
    interval: "year" as const,
  },
  {
    planId: "team",
    name: "Selfbeat Team",
    description: "Unlimited comparisons for up to 5 team members — billed monthly",
    unitAmount: 3900,
    currency: "usd",
    interval: "month" as const,
  },
];

export async function seedStripeProducts(): Promise<void> {
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    logger.warn("Stripe not configured — skipping product seed");
    return;
  }

  try {
    const { data: existing } = await stripe.products.list({ active: true, limit: 100 });
    const existingPlanIds = new Set(
      existing.filter((p) => p.metadata?.plan_id).map((p) => p.metadata.plan_id)
    );

    const missing = PRODUCTS_TO_SEED.filter((p) => !existingPlanIds.has(p.planId));

    if (missing.length === 0) {
      logger.info("Stripe products already seeded");
      return;
    }

    for (const def of missing) {
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
      logger.info(
        { planId: def.planId, productId: product.id, priceId: price.id },
        "Stripe product seeded"
      );
    }

    logger.info({ count: missing.length }, "Stripe product seeding complete");
  } catch (err) {
    logger.warn({ err }, "Stripe product seeding failed — will retry on next startup");
  }
}
