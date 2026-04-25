import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatEmailPreferencesTable = pgTable("selfbeat_email_preferences", {
  userId: text("user_id").primaryKey(),
  weeklyDigest: boolean("weekly_digest").notNull().default(true),
  streakReminders: boolean("streak_reminders").notNull().default(true),
  creditWarnings: boolean("credit_warnings").notNull().default(true),
  promotional: boolean("promotional").notNull().default(true),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  unsubscribeToken: text("unsubscribe_token").unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatEmailPreferences = typeof selfbeatEmailPreferencesTable.$inferSelect;
export type InsertSelfbeatEmailPreferences = typeof selfbeatEmailPreferencesTable.$inferInsert;
