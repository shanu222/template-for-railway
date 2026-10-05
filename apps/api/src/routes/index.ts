import { Router } from "express";
import { authRouter } from "./auth.js";
import { healthRouter } from "./health.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { checkDatabase } from "../services/prisma.js";
import { checkRedis, isRedisConfigured } from "../services/redis.js";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.status(200).json({
    name: "Production Full-Stack SaaS Starter API",
    version: "1.0.0",
    description:
      "Generic Express REST API with authentication, PostgreSQL, and optional Redis.",
    docs: "See README.md for endpoint documentation.",
    endpoints: {
      health: "GET /api/health",
      diagnostics: "GET /api/health/diagnostics",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      me: "GET /api/auth/me",
      logout: "POST /api/auth/logout",
      refresh: "POST /api/auth/refresh",
      status: "GET /api/status",
    },
  });
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);

apiRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    res.status(200).json({
      api: { status: "up" },
      database: {
        status: database.ok ? "up" : "down",
        latencyMs: database.latencyMs,
      },
      redis: {
        configured: isRedisConfigured(),
        status: redis.status,
        latencyMs: redis.latencyMs,
      },
      timestamp: new Date().toISOString(),
    });
  }),
);
