import type { NextFunction, Request, Response } from "express";
import {
  getUserById,
  verifyAccessToken,
  type TokenPayload,
} from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/errors.js";
import { asyncHandler } from "../utils/async-handler.js";

export type AuthenticatedRequest = Request & {
  auth?: TokenPayload;
  user?: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
};

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export const requireAuth = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);

    req.auth = payload;
    req.user = user;
    next();
  },
);
