import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const selfbeatDailyRunsTable = pgTable("selfbeat_daily_runs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  questionId: integer("question_id").notNull(),
  runDate: text("run_date").notNull(), // YYYY-MM-DD in UTC
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("selfbeat_daily_runs_user_date_uniq").on(table.userId, table.runDate),
]);

export type SelfbeatDailyRun = typeof selfbeatDailyRunsTable.$inferSelect;
