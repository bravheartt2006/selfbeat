import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const selfbeatComparisonsTable = pgTable("selfbeat_comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionKey: text("question_key").notNull().unique(),
  question: text("question").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSelfbeatComparisonSchema = createInsertSchema(
  selfbeatComparisonsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertSelfbeatComparison = z.infer<
  typeof insertSelfbeatComparisonSchema
>;
export type SelfbeatComparison = typeof selfbeatComparisonsTable.$inferSelect;