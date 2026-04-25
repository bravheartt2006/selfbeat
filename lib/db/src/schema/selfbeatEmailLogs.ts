import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatEmailLogsTable = pgTable("selfbeat_email_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  emailType: text("email_type").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(),
  error: text("error"),
  recipientEmail: text("recipient_email"),
});

export type SelfbeatEmailLog = typeof selfbeatEmailLogsTable.$inferSelect;
export type InsertSelfbeatEmailLog = typeof selfbeatEmailLogsTable.$inferInsert;
