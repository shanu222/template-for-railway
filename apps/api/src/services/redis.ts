import { Redis } from "ioredis";
import { env } from "../config/env.js";

let redis: Redis | null = null;
let connectionAttempted = false;
let isAvailable = false;

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redis && !connectionAttempted) {
    connectionAttempted = true;
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    redis.on("connect", () => {
      isAvailable = true;
    });

    redis.on("ready", () => {
      isAvailable = true;
    });

    redis.on("error", () => {
      isAvailable = false;
    });

    redis.on("end", () => {
      isAvailable = false;
    });
  }

  return redis;
}

export async function ensureRedisConnected(): Promise<boolean> {
  const client = getRedis();
  if (!client) {
    return false;
  }

  try {
    if (client.status === "wait" || client.status === "end") {
      await client.connect();
    }
    await client.ping();
    isAvailable = true;
    return true;
  } catch {
    isAvailable = false;
    return false;
  }
}

export async function checkRedis(): Promise<{
  status: "up" | "down" | "skipped";
  latencyMs?: number;
  message?: string;
}> {
  if (!isRedisConfigured()) {
    return { status: "skipped", message: "REDIS_URL not configured" };
  }

  const started = Date.now();
  const ok = await ensureRedisConnected();
  if (!ok) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      message: "Redis unavailable",
    };
  }

  return { status: "up", latencyMs: Date.now() - started };
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client || !isAvailable) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 60,
): Promise<boolean> {
  const client = getRedis();
  if (!client || !isAvailable) {
    return false;
  }

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client || !isAvailable) {
    return;
  }

  try {
    await client.del(key);
  } catch {
    // ignore
  }
}

/** Simple fire-and-forget job queue example using Redis lists. */
export async function enqueueJob(
  queue: string,
  payload: unknown,
): Promise<boolean> {
  const client = getRedis();
  if (!client) {
    return false;
  }

  const connected = await ensureRedisConnected();
  if (!connected) {
    return false;
  }

  try {
    await client.lpush(
      `queue:${queue}`,
      JSON.stringify({ payload, enqueuedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    } finally {
      redis = null;
      connectionAttempted = false;
      isAvailable = false;
    }
  }
}
