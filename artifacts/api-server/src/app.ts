import path from "path";
import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import PgSession from "connect-pg-simple";
import { passport } from "./routes/auth";
import { WebhookHandlers } from "./webhookHandlers";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgStore = PgSession(session);
const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing signature" });
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: err.message });
    }
  },
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgStore({ pool }),
    secret: process.env.SESSION_SECRET || "selfbeat-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "none",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());
app.use("/api", router);

const frontendDist = "/app/artifacts/selfbeat/dist/public";
app.use(express.static(frontendDist));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
