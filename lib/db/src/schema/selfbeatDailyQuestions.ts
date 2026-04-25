import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatDailyQuestionsTable = pgTable("selfbeat_daily_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatDailyQuestion = typeof selfbeatDailyQuestionsTable.$inferSelect;
