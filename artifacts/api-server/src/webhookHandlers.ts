import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable } from "@workspace/db";
import { getUncachableStripeClient, getStripeSync } from "./stripeClient";
import { logger } from "./lib/logger";

function planTypeFromProduct(product: Stripe.Product): string {
  const planId = product.metadata?.plan_id;
  if (planId === "pro_annual") return "annual";
  if (planId === "team") return "team";
  return "monthly";
}

async function applyBusinessLogic(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      if (session.mode === "payment") {
        await db
          .update(selfbeatUsersTable)
          .set({ credits: sql`${selfbeatUsersTable.credits} + 25` })
          .where(eq(selfbeatUsersTable.id, userId));
        logger.info({ userId }, "Added 25 credits for one-time payment");
      } else if (session.mode === "subscription" && session.subscription) {
        const stripe = await getUncachableStripeClient();
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const priceId = subscription.items.data[0]?.price.id;
        const price = await stripe.prices.retrieve(priceId);
        const product = await stripe.products.retrieve(price.product as string);
        const planType = planTypeFromProduct(product);

        await db
          .update(selfbeatUsersTable)
          .set({
            hasUnlimited: true,
            planType,
            stripeSubscriptionId: session.subscription as string,
          })
          .where(eq(selfbeatUsersTable.id, userId));
        logger.info({ userId, planType }, "Subscription activated");
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const [user] = await db
        .select()
        .from(selfbeatUsersTable)
        .where(
          eq(selfbeatUsersTable.stripeCustomerId, subscription.customer as string)
        )
        .limit(1);
      if (!user) break;

      const isActive =
        subscription.status === "active" || subscription.status === "trialing";
      if (isActive) {
        const priceId = subscription.items.data[0]?.price.id;
        const stripe = await getUncachableStripeClient();
        const price = await stripe.prices.retrieve(priceId);
        const product = await stripe.products.retrieve(price.product as string);
        const planType = planTypeFromProduct(product);

        await db
          .update(selfbeatUsersTable)
          .set({ hasUnlimited: true, planType, stripeSubscriptionId: subscription.id })
          .where(eq(selfbeatUsersTable.id, user.id));
        logger.info({ userId: user.id, planType, status: subscription.status }, "Subscription updated");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const [user] = await db
        .select()
        .from(selfbeatUsersTable)
        .where(
          eq(selfbeatUsersTable.stripeCustomerId, subscription.customer as string)
        )
        .limit(1);
      if (!user) break;

      await db
        .update(selfbeatUsersTable)
        .set({ hasUnlimited: false, planType: null, stripeSubscriptionId: null })
        .where(eq(selfbeatUsersTable.id, user.id));
      logger.info({ userId: user.id }, "Subscription cancelled — unlimited access revoked");

      if (user.email) {
        sendPaymentEmail(
          user.email,
          user.displayName,
          "subscription_cancelled"
        ).catch(() => {});
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const [user] = await db
        .select()
        .from(selfbeatUsersTable)
        .where(
          eq(selfbeatUsersTable.stripeCustomerId, invoice.customer as string)
        )
        .limit(1);
      if (!user?.email) break;

      sendPaymentEmail(user.email, user.displayName, "payment_failed").catch(() => {});
      logger.info({ userId: user.id }, "Payment failed — notification email queued");
      break;
    }

    default:
      break;
  }
}

async function sendPaymentEmail(
  email: string,
  name: string | null,
  type: "payment_failed" | "subscription_cancelled"
): Promise<void> {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const greeting = name ? `Hi ${name}` : "Hi there";

  if (type === "payment_failed") {
    await resend.emails.send({
      from: "Selfbeat <contact@seben.ai>",
      to: email,
      subject: "Action required: Payment failed for your Selfbeat subscription",
      html: `<p>${greeting},</p><p>We were unable to process your payment for your Selfbeat subscription. Please update your payment method to keep your unlimited access.</p><p><a href="https://selfbeat.ai/pricing">Manage your subscription →</a></p><p>— The Selfbeat Team</p>`,
    });
  } else if (type === "subscription_cancelled") {
    await resend.emails.send({
      from: "Selfbeat <contact@seben.ai>",
      to: email,
      subject: "Your Selfbeat subscription has ended",
      html: `<p>${greeting},</p><p>Your Selfbeat subscription has been cancelled and your unlimited access has ended. You can resubscribe any time from the <a href="https://selfbeat.ai/pricing">pricing page</a>.</p><p>— The Selfbeat Team</p>`,
    });
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
