import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

const TRIAL_DISCOUNT_COUPON_ID = process.env.STRIPE_TRIAL_DISCOUNT_COUPON || "";

// List price IDs for all active plans (used by the frontend pricing page)
router.get("/price-ids", async (_req, res) => {
  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const { data: products } = await stripe.products.list({ active: true, limit: 100 });
    const priceIds: Record<string, string> = {};

    for (const product of products) {
      const planId = product.metadata?.plan_id;
      if (!planId) continue;

      const { data: prices } = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 1,
      });

      if (prices.length > 0) {
        priceIds[planId] = prices[0].id;
      }
    }

    return res.json(priceIds);
  } catch {
    return res.json({});
  }
});

// Create checkout session
router.post("/checkout", requireAuth, async (req: any, res) => {
  const { userId } = req;
  const { priceId, applyTrialDiscount } = req.body as {
    priceId?: string;
    applyTrialDiscount?: boolean;
  };

  if (!priceId) return res.status(400).json({ error: "priceId is required" });

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const [user] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db
        .update(selfbeatUsersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(selfbeatUsersTable.id, userId));
    }

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domain ? `https://${domain}` : "http://localhost:3000";

    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === "recurring" ? "subscription" : "payment";

    const now = new Date();
    const isWithin24hOfTrialExpiry =
      user?.trialUsed &&
      user.trialEndDate &&
      user.trialEndDate <= now &&
      now.getTime() - user.trialEndDate.getTime() < 24 * 60 * 60 * 1000;

    const shouldApplyDiscount =
      (applyTrialDiscount || isWithin24hOfTrialExpiry) &&
      mode === "subscription" &&
      !!TRIAL_DISCOUNT_COUPON_ID;

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${base}/selfbeat/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/selfbeat/pricing?canceled=1`,
      metadata: { userId },
    };

    if (shouldApplyDiscount) {
      (sessionParams as any).discounts = [{ coupon: TRIAL_DISCOUNT_COUPON_ID }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (shouldApplyDiscount) {
      await db
        .update(selfbeatUsersTable)
        .set({ convertedAfterTrial: true })
        .where(eq(selfbeatUsersTable.id, userId));
    }

    return res.json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Checkout failed" });
  }
});

// Customer portal
router.post("/portal", requireAuth, async (req: any, res) => {
  const { userId } = req;
  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    const [user] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    if (!user?.stripeCustomerId)
      return res.status(400).json({ error: "No Stripe customer" });

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domain ? `https://${domain}` : "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/selfbeat/pricing`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
