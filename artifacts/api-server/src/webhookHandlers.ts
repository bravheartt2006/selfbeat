import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { getUncachableStripeClient, getStripeSync } from "./stripeClient";
import { logger } from "./lib/logger";
import { fulfillCheckoutSession, planTypeFromProduct } from "./lib/fulfillCheckoutSession";
import {
  sendPaymentConfirmationEmail,
  sendSubscriptionRenewedEmail,
  sendSubscriptionCancelledEmail,
  sendPaymentFailedEmail,
} from "./services/paymentEmailService";

async function getUserByCustomerId(customerId: string) {
  const [user] = await db
    .select()
    .from(selfbeatUsersTable)
    .where(eq(selfbeatUsersTable.stripeCustomerId, customerId))
    .limit(1);
  return user ?? null;
}

async function applyBusinessLogic(event: Stripe.Event): Promise<void> {
  switch (event.type) {

    // ── New payment / subscription start ──────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const stripe = await getUncachableStripeClient();
      const result = await fulfillCheckoutSession(session, stripe);

      if (result.alreadyProcessed) {
        logger.info({ sessionId: session.id }, "Webhook: session already fulfilled via verify-session, skipping");
        break;
      }

      const userId = session.metadata?.userId;
      if (!userId) break;

      const [user] = await db
        .select()
        .from(selfbeatUsersTable)
        .where(eq(selfbeatUsersTable.id, userId))
        .limit(1);
      if (!user?.email) break;

      let nextBillingDate: number | null = null;
      if (session.mode === "subscription" && session.subscription) {
        try {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          nextBillingDate = (sub as any).current_period_end ?? null;
        } catch { /* non-fatal */ }
      }

      sendPaymentConfirmationEmail({
        userId: user.id,
        email: user.email,
        name: user.displayName,
        planType: user.planType,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        creditsAdded: result.creditsAdded,
        nextBillingDate,
        isSubscription: session.mode === "subscription",
      }).catch((err) =>
        logger.error({ err, userId }, "Failed to send payment confirmation email")
      );
      break;
    }

    // ── Recurring subscription renewal ────────────────────────────────────
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;

      // Only send renewal emails for recurring charges, not the initial payment
      if ((invoice as any).billing_reason !== "subscription_cycle") break;
      if (!invoice.customer) break;

      const user = await getUserByCustomerId(invoice.customer as string);
      if (!user?.email) break;

      let nextBillingDate: number | null = null;
      const invoiceSubscriptionId = (invoice as any).subscription as string | null;
      if (invoiceSubscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          const sub = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
          nextBillingDate = (sub as any).current_period_end ?? null;
        } catch { /* non-fatal */ }
      }

      sendSubscriptionRenewedEmail({
        userId: user.id,
        email: user.email,
        name: user.displayName,
        planType: user.planType,
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? "usd",
        nextBillingDate,
      }).catch((err) =>
        logger.error({ err, userId: user.id }, "Failed to send renewal email")
      );

      logger.info({ userId: user.id }, "Subscription renewed — renewal email queued");
      break;
    }

    // ── Subscription changes (upgrade/downgrade/reactivation) ─────────────
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await getUserByCustomerId(subscription.customer as string);
      if (!user) break;

      const isActive =
        subscription.status === "active" || subscription.status === "trialing";

      if (isActive) {
        const stripe = await getUncachableStripeClient();
        const priceId = subscription.items.data[0]?.price.id;
        const price = await stripe.prices.retrieve(priceId);
        const product = await stripe.products.retrieve(price.product as string);
        const planType = planTypeFromProduct(product as Stripe.Product);

        await db
          .update(selfbeatUsersTable)
          .set({ hasUnlimited: true, planType, stripeSubscriptionId: subscription.id })
          .where(eq(selfbeatUsersTable.id, user.id));
        logger.info({ userId: user.id, planType, status: subscription.status }, "Subscription updated");
      }
      break;
    }

    // ── Subscription cancelled ─────────────────────────────────────────────
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await getUserByCustomerId(subscription.customer as string);
      if (!user) break;

      const previousPlanType = user.planType;

      await db
        .update(selfbeatUsersTable)
        .set({ hasUnlimited: false, planType: null, stripeSubscriptionId: null })
        .where(eq(selfbeatUsersTable.id, user.id));
      logger.info({ userId: user.id }, "Subscription cancelled — unlimited access revoked");

      if (user.email) {
        sendSubscriptionCancelledEmail({
          userId: user.id,
          email: user.email,
          name: user.displayName,
          planType: previousPlanType,
        }).catch((err) =>
          logger.error({ err, userId: user.id }, "Failed to send cancellation email")
        );
      }
      break;
    }

    // ── Payment failed ─────────────────────────────────────────────────────
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.customer) break;

      const user = await getUserByCustomerId(invoice.customer as string);
      if (!user?.email) break;

      sendPaymentFailedEmail({
        userId: user.id,
        email: user.email,
        name: user.displayName,
        amountCents: invoice.amount_due ?? 0,
        currency: invoice.currency ?? "usd",
      }).catch((err) =>
        logger.error({ err, userId: user.id }, "Failed to send payment failed email")
      );

      logger.info({ userId: user.id }, "Payment failed — email queued");
      break;
    }

    default:
      break;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    let event: Stripe.Event;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      try {
        const sync = await getStripeSync();
        await sync.processWebhook(payload, signature);
        event = JSON.parse(payload.toString()) as Stripe.Event;
      } catch {
        event = JSON.parse(payload.toString()) as Stripe.Event;
      }
    }

    await applyBusinessLogic(event).catch((err) => {
      logger.error({ err, eventType: event.type }, "Webhook business logic error");
    });
  }
}
