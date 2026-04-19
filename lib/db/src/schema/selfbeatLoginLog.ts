import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatLoginLogTable = pgTable("selfbeat_login_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  googleId: text("google_id"),
  fingerprintId: text("fingerprint_id"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatLoginLog = typeof selfbeatLoginLogTable.$inferSelect;
