import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatUsersTable = pgTable("selfbeat_users", {
  id: text("id").primaryKey(),
  email: text("email"),
  credits: integer("credits").notNull().default(10),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  hasUnlimited: boolean("has_unlimited").notNull().default(false),
  unlimitedUntil: timestamp("unlimited_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatUser = typeof selfbeatUsersTable.$inferSelect;
export type InsertSelfbeatUser = typeof selfbeatUsersTable.$inferInsert;
