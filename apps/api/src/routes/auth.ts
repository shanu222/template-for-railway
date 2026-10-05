import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { validate } from "../middleware/validate.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "../services/auth.service.js";
import { enqueueJob } from "../services/redis.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many authentication attempts. Please try again later.",
      code: "RATE_LIMITED",
    },
  },
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

function setRefreshCookie(res: import("express").Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

function clearRefreshCookie(res: import("express").Response) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/api/auth",
  });
}

authRouter.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.body);
    setRefreshCookie(res, result.refreshToken);
    void enqueueJob("auth-events", {
      type: "user.registered",
      userId: result.user.id,
    });

    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      refreshToken: result.refreshToken,
    });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.body);
    setRefreshCookie(res, result.refreshToken);
    void enqueueJob("auth-events", {
      type: "user.logged_in",
      userId: result.user.id,
    });

    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      refreshToken: result.refreshToken,
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.status(200).json({ user: req.user });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const refreshToken =
      (req.body?.refreshToken as string | undefined) ||
      (req.cookies?.refreshToken as string | undefined);

    let userId: string | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const { verifyAccessToken } = await import("../services/auth.service.js");
        userId = verifyAccessToken(header.slice(7)).sub;
      } catch {
        // ignore invalid access token on logout
      }
    }

    await logoutUser(refreshToken, userId);
    clearRefreshCookie(res);
    res.status(200).json({ message: "Logged out" });
  }),
);

authRouter.post(
  "/refresh",
  authLimiter,
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await refreshAccessToken(req.body.refreshToken);
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      refreshToken: result.refreshToken,
    });
  }),
);
