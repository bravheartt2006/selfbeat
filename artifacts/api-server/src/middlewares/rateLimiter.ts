import { rateLimit, ipKeyGenerator } from "express-rate-limit";

/**
 * Per-user rate limiter: 10 requests per minute.
 * Falls back to IP (with IPv6 support) when no Clerk userId is present.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.userId) return req.userId;
    return ipKeyGenerator(req);
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many requests. Please wait a moment before trying again.",
    });
  },
  skip: (req) => req.method === "GET",
});

/**
 * Stricter limiter for the stream endpoint.
 */
export const streamRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    if (req.userId) return req.userId;
    return ipKeyGenerator(req);
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Rate limit reached. You can run up to 10 comparisons per minute.",
    });
  },
});
