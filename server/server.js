import mongoose from "mongoose";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { createApp } from "./app.js";

async function main() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info("MongoDB connected");

  if (!env.aiEnabled) logger.warn("GEMINI_API_KEY is not set: analyses will use rule-based recommendations only");

  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`Server listening on port ${env.PORT}`, { env: env.NODE_ENV }));

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received: shutting down`);
    // Give in-flight requests a few seconds, then force exit.
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      logger.info("Shutdown complete");
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled promise rejection", { err });
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { err });
  process.exit(1);
});

main().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
