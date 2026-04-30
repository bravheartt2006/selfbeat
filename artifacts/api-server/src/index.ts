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

// Start listening immediately so Railway's healthcheck can reach the server.
// DB setup runs after — if it fails the process exits, but the port is already bound.
const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripeMode = stripeKey.startsWith("sk_test_") ? "TEST" : stripeKey.startsWith("sk_live_") ? "LIVE" : "UNKNOWN";
logger.info({ stripeKeyPrefix: stripeKey.substring(0, 12), stripeMode }, "Stripe startup mode");

ensureSessionTable()
  .then(() => {
    startEmailScheduler();
    seedStripeProducts().catch(() => {});
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table — check DATABASE_URL");
    server.close(() => process.exit(1));
  });
