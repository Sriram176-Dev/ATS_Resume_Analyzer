import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestId } from "./middleware/requestId.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Build the Express app (kept separate from `listen` so it can be tested without a network port). */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(requestId);
  if (!env.isTest) {
    morgan.token("id", (req) => req.id);
    app.use(morgan(":id :method :url :status :res[content-length] - :response-time ms", { stream: { write: (line) => logger.info(line.trim()) }, skip: (req) => req.path === "/api/health" }));
  }
  app.use(
    helmet({
      // Default CSP minus `upgrade-insecure-requests`, which breaks plain-HTTP deployments.
      // Terminate TLS at your proxy / platform (HSTS is still sent).
      contentSecurityPolicy: { useDefaults: true, directives: { "upgrade-insecure-requests": null } },
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // same-origin requests and non-browser clients
        if (env.allowedOrigins.includes(origin)) return cb(null, true);
        if (!env.isProd && /^https?:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
        cb(null, false);
      },
      exposedHeaders: ["X-Request-Id", "Content-Disposition"],
    })
  );
  app.use(express.json({ limit: "100kb" }));

  // ── API ────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? "ok" : "degraded",
      db: dbUp ? "up" : "down",
      ai: env.aiEnabled ? "configured" : "not configured",
      uptime: Math.round(process.uptime()),
    });
  });

  // Public, non-sensitive settings the web app needs to render accurate copy and limits.
  app.get("/api/config", (_req, res) => {
    res.json({ aiEnabled: env.aiEnabled, maxUploadMb: env.MAX_UPLOAD_MB, maxJobDescriptionChars: 10000 });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/resumes", resumeRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api", notFoundHandler);

  // ── Built web app (single-container deployments) ─────────────────────
  const distDir = env.CLIENT_DIST_DIR || path.resolve(__dirname, "../client/dist");
  if (env.SERVE_CLIENT && fs.existsSync(path.join(distDir, "index.html"))) {
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, filePath) {
          // Vite fingerprints everything in /assets, so it is safe to cache forever.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      })
    );
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => res.json({ name: "ATS Resume Analyzer API", health: "/api/health" }));
  }

  app.use(errorHandler);
  return app;
}
