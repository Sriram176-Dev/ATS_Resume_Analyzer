/**
 * Environment configuration.
 *
 * All configuration is read and validated once, at startup. The process fails
 * fast with a readable message if something required is missing or unsafe,
 * instead of failing later at request time.
 */
import "dotenv/config";
import { z } from "zod";

const PLACEHOLDER_SECRET = /^(replace|change|your|example|secret|test-only)/i;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  MONGODB_URI: z.string().min(1, "is required"),

  JWT_SECRET: z.string().min(1, "is required"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // AI is optional: without a key the app still returns rule-based analysis.
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),

  // Comma-separated list of allowed browser origins. Leave empty when the
  // API and the web app are served from the same origin.
  FRONTEND_URL: z.string().default(""),
  // Number of reverse proxies in front of the app (0 = none). Needed for
  // correct client IPs, and therefore correct rate limiting, behind a proxy.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  MAX_UPLOAD_MB: z.coerce.number().min(0.1).max(25).default(5),
  ANALYSES_PER_HOUR: z.coerce.number().int().min(1).default(20),

  // Serve the built React app from this process (single-container deploys).
  SERVE_CLIENT: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  CLIENT_DIST_DIR: z.string().default(""),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

function load(source = process.env) {
  const parsed = schema.safeParse(source);

  const problems = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`${issue.path.join(".") || "env"}: ${issue.message}`);
    }
  }

  // Judge the raw values so every problem is reported in one go, not one restart at a time.
  const secret = source.JWT_SECRET || "";
  if (source.NODE_ENV === "production" && secret && (secret.length < 32 || PLACEHOLDER_SECRET.test(secret))) {
    problems.push(
      "JWT_SECRET: must be a random string of at least 32 characters in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  if (problems.length > 0) {
    const message = `Invalid environment configuration:\n  - ${problems.join("\n  - ")}\nSee server/.env.example`;
    if (source.NODE_ENV === "test") throw new Error(message);
    console.error(message);
    process.exit(1);
  }

  const cfg = parsed.data;
  return {
    ...cfg,
    isProd: cfg.NODE_ENV === "production",
    isTest: cfg.NODE_ENV === "test",
    aiEnabled: cfg.GEMINI_API_KEY.trim().length > 0 && !PLACEHOLDER_SECRET.test(cfg.GEMINI_API_KEY),
    maxUploadBytes: Math.round(cfg.MAX_UPLOAD_MB * 1024 * 1024),
    allowedOrigins: cfg.FRONTEND_URL.split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean),
  };
}

export const env = load();
export { load as loadEnv };
