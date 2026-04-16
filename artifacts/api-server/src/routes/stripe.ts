import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

// Create checkout session
router.post("/checkout", requireAuth, async (req: any, res) => {
  const { userId } = req;
  const { priceId } = req.body as { priceId?: string };

  if (!priceId) return res.status(400).json({ error: "priceId is required" });

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    // Get or create Stripe customer
    const [user] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, userId))
      .limit(1);

    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        metadata: { clerkUserId: userId },
      });
      customerId = customer.id;
      await db
        .update(selfbeatUsersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(selfbeatUsersTable.id, userId));
    }

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domain ? `https://${domain}` : "http://localhost:3000";

    // Determine if one-time or subscription
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === "recurring" ? "subscription" : "payment";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${base}/selfbeat/pricing?success=1`,
      cancel_url: `${base}/selfbeat/pricing?canceled=1`,
      metadata: { clerkUserId: userId },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
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
