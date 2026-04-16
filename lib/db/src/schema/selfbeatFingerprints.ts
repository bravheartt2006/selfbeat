import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { selfbeatUsersTable } from "./selfbeatUsers";

export const selfbeatFingerprintsTable = pgTable(
  "selfbeat_fingerprints",
  {
    fingerprintId: text("fingerprint_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => selfbeatUsersTable.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.fingerprintId, t.userId] })],
);

export type SelfbeatFingerprint = typeof selfbeatFingerprintsTable.$inferSelect;
