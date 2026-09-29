/**
 * Minimal structured logger.
 * - production: one JSON object per line (easy to ship to any log platform)
 * - development: readable single-line output
 * Never log secrets, tokens, passwords or resume contents.
 */
import { env } from "../config/env.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

function serializeError(err) {
  if (!(err instanceof Error)) return err;
  return { name: err.name, message: err.message, ...(env.isProd ? {} : { stack: err.stack }) };
}

function write(level, msg, meta = {}) {
  if (LEVELS[level] < threshold || env.isTest) return;
  const safeMeta = { ...meta };
  if (safeMeta.err) safeMeta.err = serializeError(safeMeta.err);

  if (env.isProd) {
    const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...safeMeta });
    (level === "error" ? process.stderr : process.stdout).write(line + "\n");
  } else {
    const extra = Object.keys(safeMeta).length ? " " + JSON.stringify(safeMeta) : "";
    const out = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${msg}${extra}`;
    (level === "error" ? console.error : console.log)(out);
  }
}

export const logger = {
  debug: (msg, meta) => write("debug", msg, meta),
  info: (msg, meta) => write("info", msg, meta),
  warn: (msg, meta) => write("warn", msg, meta),
  error: (msg, meta) => write("error", msg, meta),
};
