import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { logger } from "./logger";

function planTypeFromProduct(product: Stripe.Product): string {
  const planId = product.metadata?.plan_id;
  if (planId === "pro_annual") return "annual";
  if (planId === "team") return "team";
  return "monthly";
}

export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<{ alreadyProcessed: boolean; creditsAdded: number }> {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.warn({ sessionId: session.id }, "fulfillCheckoutSession: no userId in metadata");
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  const [user] = await db
    .select()
    .from(selfbeatUsersTable)
    .where(eq(selfbeatUsersTable.id, userId))
    .limit(1);

  if (!user) {
    logger.warn({ userId, sessionId: session.id }, "fulfillCheckoutSession: user not found");
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  if (user.stripeLastSessionId === session.id) {
    logger.info({ userId, sessionId: session.id }, "fulfillCheckoutSession: already processed, skipping");
    return { alreadyProcessed: true, creditsAdded: 0 };
  }

  if (session.payment_status !== "paid" && session.status !== "complete") {
    logger.warn({ userId, sessionId: session.id, paymentStatus: session.payment_status }, "fulfillCheckoutSession: session not paid");
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  await db
    .update(selfbeatUsersTable)
    .set({ stripeLastSessionId: session.id })
    .where(eq(selfbeatUsersTable.id, userId));

  if (session.mode === "payment") {
    await db
      .update(selfbeatUsersTable)
      .set({ credits: sql`${selfbeatUsersTable.credits} + 25` })
      .where(eq(selfbeatUsersTable.id, userId));
    logger.info({ userId, sessionId: session.id }, "fulfillCheckoutSession: added 25 credits");
    return { alreadyProcessed: false, creditsAdded: 25 };
  }

  if (session.mode === "subscription" && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const priceId = subscription.items.data[0]?.price.id;
    const price = await stripe.prices.retrieve(priceId);
    const product = await stripe.products.retrieve(price.product as string);
    const planType = planTypeFromProduct(product as Stripe.Product);

    await db
      .update(selfbeatUsersTable)
      .set({
        hasUnlimited: true,
        stripeSubscriptionId: subscription.id,
        planType,
      })
      .where(eq(selfbeatUsersTable.id, userId));
    logger.info({ userId, sessionId: session.id, planType }, "fulfillCheckoutSession: subscription activated");
  }

  return { alreadyProcessed: false, creditsAdded: 0 };
}
