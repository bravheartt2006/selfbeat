import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatGiftsTable = pgTable("selfbeat_gifts", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverEmail: text("receiver_email").notNull(),
  receiverId: text("receiver_id"),
  credits: integer("credits").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'delivered' | 'claimed'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatGift = typeof selfbeatGiftsTable.$inferSelect;
export type InsertSelfbeatGift = typeof selfbeatGiftsTable.$inferInsert;
