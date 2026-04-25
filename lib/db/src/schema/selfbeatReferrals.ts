import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatReferralsTable = pgTable("selfbeat_referrals", {
  id: serial("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredUserId: text("referred_user_id"),
  referralCode: text("referral_code").notNull(),
  completed: boolean("completed").notNull().default(false),
  creditsAwarded: boolean("credits_awarded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatReferral = typeof selfbeatReferralsTable.$inferSelect;
export type InsertSelfbeatReferral = typeof selfbeatReferralsTable.$inferInsert;
