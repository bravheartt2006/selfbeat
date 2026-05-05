import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { logger } from "./logger";

export function planTypeFromProduct(product: Stripe.Product): string {
  const planId = product.metadata?.plan_id;
  if (planId === "pro_annual") return "annual";
  if (planId === "team") return "team";
  return "monthly";
}

export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<{ alreadyProcessed: boolean; creditsAdded: number }> {
  logger.info(
    {
      sessionId: session.id,
      mode: session.mode,
      paymentStatus: session.payment_status,
      status: session.status,
      metadataUserId: session.metadata?.userId,
      customerEmail: (session as any).customer_details?.email ?? null,
    },
    "fulfillCheckoutSession: received session"
  );

  const userId = session.metadata?.userId;
  if (!userId) {
    logger.error({ sessionId: session.id }, "fulfillCheckoutSession: no userId in session metadata — cannot credit");
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  const [user] = await db
    .select()
    .from(selfbeatUsersTable)
    .where(eq(selfbeatUsersTable.id, userId))
    .limit(1);

  logger.info(
    {
      userId,
      sessionId: session.id,
      userFound: !!user,
      currentCredits: user?.credits ?? null,
      stripeLastSessionId: user?.stripeLastSessionId ?? null,
    },
    "fulfillCheckoutSession: user lookup result"
  );

  if (!user) {
    logger.error({ userId, sessionId: session.id }, "fulfillCheckoutSession: user NOT FOUND in database");
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  if (user.stripeLastSessionId === session.id) {
    logger.info({ userId, sessionId: session.id, credits: user.credits }, "fulfillCheckoutSession: already processed, skipping");
    return { alreadyProcessed: true, creditsAdded: 0 };
  }

  if (session.payment_status !== "paid" && session.status !== "complete") {
    logger.error(
      { userId, sessionId: session.id, paymentStatus: session.payment_status, status: session.status },
      "fulfillCheckoutSession: session is NOT paid — refusing to credit"
    );
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  logger.info({ userId, sessionId: session.id }, "fulfillCheckoutSession: marking session as processed");
  await db
    .update(selfbeatUsersTable)
    .set({ stripeLastSessionId: session.id })
    .where(eq(selfbeatUsersTable.id, userId));

  if (session.mode === "payment") {
    logger.info({ userId, sessionId: session.id, creditsToAdd: 25 }, "fulfillCheckoutSession: adding 25 credits now");
    const updateResult = await db
      .update(selfbeatUsersTable)
      .set({ credits: sql`${selfbeatUsersTable.credits} + 25` })
      .where(eq(selfbeatUsersTable.id, userId))
      .returning({ newCredits: selfbeatUsersTable.credits });
    logger.info({ userId, sessionId: session.id, updateResult }, "fulfillCheckoutSession: credit update complete");
    return { alreadyProcessed: false, creditsAdded: 25 };
  }

  if (session.mode === "subscription" && session.subscription) {
    logger.info({ userId, sessionId: session.id, subscription: session.subscription }, "fulfillCheckoutSession: activating subscription");
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
    return { alreadyProcessed: false, creditsAdded: 0 };
  }

  logger.warn({ userId, sessionId: session.id, mode: session.mode }, "fulfillCheckoutSession: unhandled session mode");
  return { alreadyProcessed: false, creditsAdded: 0 };
}
