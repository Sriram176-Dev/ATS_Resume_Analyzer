import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const handler = (message) => (req, res) =>
  res.status(429).json({ error: message, code: "RATE_LIMITED", requestId: req.id });

const base = { standardHeaders: "draft-7", legacyHeaders: false };
const skipInTests = () => env.isTest;

/** Broad safety net for every API request. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  skip: skipInTests,
  handler: handler("Too many requests. Please slow down and try again shortly."),
});

/** Brute-force protection for sign-in / sign-up. Only failed attempts count for login. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  skip: skipInTests,
  handler: handler("Too many attempts. Please wait 15 minutes and try again."),
});

/** Every analysis calls a paid AI API, so cap it per user. */
export const analyzeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: env.ANALYSES_PER_HOUR,
  skip: skipInTests,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: handler(`You've reached the limit of ${env.ANALYSES_PER_HOUR} analyses per hour. Please try again later.`),
});

/** Public contact form: keep spam down. */
export const contactLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  skip: skipInTests,
  handler: handler("You've sent several messages already. Please try again later."),
});
