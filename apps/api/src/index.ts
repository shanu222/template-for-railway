import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabase, disconnectPrisma } from "./services/prisma.js";
import {
  disconnectRedis,
  ensureRedisConnected,
  isRedisConfigured,
} from "./services/redis.js";

const app = createApp();
const server = app.listen(env.PORT, env.API_HOST, async () => {
  console.log(`API listening on http://${env.API_HOST}:${env.PORT}`);

  const db = await checkDatabase();
  if (db.ok) {
    console.log(`Database: connected (${db.latencyMs}ms)`);
  } else {
    console.warn(`Database: unavailable — ${db.message}`);
    console.warn("API started; database-backed routes will fail until DATABASE_URL is reachable.");
  }

  if (isRedisConfigured()) {
    const redisOk = await ensureRedisConnected();
    console.log(redisOk ? "Redis: connected" : "Redis: unavailable (optional features disabled)");
  } else {
    console.log("Redis: not configured (optional)");
  }
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await Promise.all([disconnectPrisma(), disconnectRedis()]);
      console.log("Cleanup complete.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
