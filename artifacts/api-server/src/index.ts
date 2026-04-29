import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { startEmailScheduler } from "./services/emailScheduler";
import { seedStripeProducts } from "./lib/seedStripeProducts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Create the session table directly (avoids connect-pg-simple's table.sql
// file-read which breaks when bundled with esbuild).
async function ensureSessionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    varchar     NOT NULL,
      "sess"   json        NOT NULL,
      "expire" timestamp(6) NOT NULL,
      PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
  logger.info("Session table ready");
}

ensureSessionTable()
  .then(() => {
    startEmailScheduler();
    seedStripeProducts().catch(() => {});
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table — aborting");
    process.exit(1);
  });
