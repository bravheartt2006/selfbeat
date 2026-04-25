import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const selfbeatSettingsTable = pgTable("selfbeat_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SelfbeatSetting = typeof selfbeatSettingsTable.$inferSelect;
