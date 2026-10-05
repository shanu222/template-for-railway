import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { normalizeEmail } from "@repo/shared";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "../utils/errors.js";
import { cacheDel, cacheGet, cacheSet } from "./redis.js";

export type TokenPayload = {
  sub: string;
  email: string;
  type: "access";
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] ?? multipliers.d);
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name || name.length < 2) {
    throw new ValidationError("Name must be at least 2 characters");
  }

  if (!email.includes("@")) {
    throw new ValidationError("A valid email is required");
  }

  if (input.password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  const tokens = await issueTokens(user.id, user.email);
  return { user: toPublicUser(user), ...tokens };
}

export async function loginUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = await issueTokens(user.id, user.email);
  return { user: toPublicUser(user), ...tokens };
}

async function issueTokens(userId: string, email: string): Promise<AuthTokens> {
  const accessToken = jwt.sign(
    { sub: userId, email, type: "access" } satisfies TokenPayload,
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(
    Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_EXPIRES_IN,
  };
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    if (payload.type !== "access" || !payload.sub) {
      throw new UnauthorizedError("Invalid access token");
    }
    return payload;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

export async function getUserById(userId: string) {
  const cacheKey = `user:${userId}`;
  const cached = await cacheGet<ReturnType<typeof toPublicUser>>(cacheKey);
  if (cached) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  const publicUser = toPublicUser(user);
  await cacheSet(cacheKey, publicUser, 60);
  return publicUser;
}

export async function logoutUser(refreshToken?: string, userId?: string) {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (userId) {
    await cacheDel(`user:${userId}`);
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(stored.user.id, stored.user.email);
  return {
    user: toPublicUser(stored.user),
    ...tokens,
  };
}
