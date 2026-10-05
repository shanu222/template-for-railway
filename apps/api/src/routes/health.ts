import { Router } from "express";
import { checkDatabase } from "../services/prisma.js";
import { checkRedis } from "../services/redis.js";
import { asyncHandler } from "../utils/async-handler.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.status(200).json({
      status: "ok",
    });
  }),
);

healthRouter.get(
  "/diagnostics",
  asyncHandler(async (_req, res) => {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const degraded = !database.ok || redis.status === "down";

    res.status(200).json({
      status: degraded ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      checks: {
        api: { status: "up" },
        database: {
          status: database.ok ? "up" : "down",
          latencyMs: database.latencyMs,
          message: database.message,
        },
        redis: {
          status: redis.status,
          latencyMs: redis.latencyMs,
          message: redis.message,
        },
      },
    });
  }),
);
