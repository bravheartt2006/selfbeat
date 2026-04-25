import { pgTable, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const selfbeatVotesTable = pgTable("selfbeat_votes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  comparisonId: uuid("comparison_id").notNull(),
  votedForAi: text("voted_for_ai").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("selfbeat_votes_user_comparison_uniq").on(table.userId, table.comparisonId),
]);

export type SelfbeatVote = typeof selfbeatVotesTable.$inferSelect;
export type InsertSelfbeatVote = typeof selfbeatVotesTable.$inferInsert;
