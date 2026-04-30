import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const selfbeatUserHistoryTable = pgTable("selfbeat_user_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  comparisonId: uuid("comparison_id").notNull(),
  question: text("question").notNull(),
  winner: text("winner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatUserHistory = typeof selfbeatUserHistoryTable.$inferSelect;
export type InsertSelfbeatUserHistory = typeof selfbeatUserHistoryTable.$inferInsert;
