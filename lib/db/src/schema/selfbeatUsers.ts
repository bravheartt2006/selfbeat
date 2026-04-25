import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatUsersTable = pgTable("selfbeat_users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  pictureUrl: text("picture_url"),
  credits: integer("credits").notNull().default(10),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  hasUnlimited: boolean("has_unlimited").notNull().default(false),
  unlimitedUntil: timestamp("unlimited_until", { withTimezone: true }),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // ── Free trial ────────────────────────────────────────────────────────────
  trialUsed: boolean("trial_used").notNull().default(false),
  trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
  trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
  convertedAfterTrial: boolean("converted_after_trial").notNull().default(false),
  trialReminderSent: boolean("trial_reminder_sent").notNull().default(false),
  trialExpirySent: boolean("trial_expiry_sent").notNull().default(false),
});

export type SelfbeatUser = typeof selfbeatUsersTable.$inferSelect;
export type InsertSelfbeatUser = typeof selfbeatUsersTable.$inferInsert;
