import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const selfbeatFeaturedResultsTable = pgTable("selfbeat_featured_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  comparisonId: uuid("comparison_id").notNull(),
  submittedBy: text("submitted_by"),
  status: text("status").notNull().default("pending"),
  isTodayFeatured: boolean("is_today_featured").notNull().default(false),
  highlightQuote: text("highlight_quote"),
  adminNote: text("admin_note"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  featuredAt: timestamp("featured_at", { withTimezone: true }),
});

export const insertSelfbeatFeaturedResultSchema = createInsertSchema(
  selfbeatFeaturedResultsTable,
).omit({ id: true, createdAt: true, viewCount: true });

export type InsertSelfbeatFeaturedResult = z.infer<typeof insertSelfbeatFeaturedResultSchema>;
export type SelfbeatFeaturedResult = typeof selfbeatFeaturedResultsTable.$inferSelect;
