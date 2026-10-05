import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pgData = path.join(root, ".pg-data-test");
const pgPort = 55432;
const apiPort = 4010 + Math.floor(Math.random() * 200);

const jwtSecret = "integration-test-secret-key-32chars-min";

function canConnect(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitForHealth(baseUrl, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.status === "ok") return;
      }
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error("API health check timed out");
}

async function run(cmd, args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed with ${code}`));
    });
  });
}

const pg = new EmbeddedPostgres({
  databaseDir: pgData,
  user: "postgres",
  password: "postgres",
  port: pgPort,
  persistent: false,
});

let apiProcess;

try {
  console.log("Starting embedded PostgreSQL...");
  await pg.initialise();
  await pg.start();

  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/postgres?schema=public`;
  const localRedisUp = await canConnect("127.0.0.1", 6379);
  // Only enable Redis in this test when a local Redis is actually reachable.
  // Avoid inheriting a stale REDIS_URL from a developer .env when Redis is down.
  const redisUrl = localRedisUp
    ? process.env.REDIS_URL || "redis://127.0.0.1:6379"
    : "";

  if (redisUrl) {
    console.log(`Redis available for test: ${redisUrl}`);
  } else {
    console.log("Redis not available locally — expecting diagnostics status skipped.");
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
    CORS_ORIGIN: "http://localhost:3000",
    NODE_ENV: "development",
    PORT: String(apiPort),
    BCRYPT_SALT_ROUNDS: "10",
  };

  // Force blank when Redis is unavailable so dotenv/.env cannot reintroduce a stale REDIS_URL.
  env.REDIS_URL = redisUrl || "";

  console.log("Running migrations...");
  await run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);

  console.log("Seeding demo data (development only)...");
  await run("npx", ["tsx", "prisma/seed.ts"], env);

  console.log("Building shared + API...");
  await run("npm", ["run", "build", "-w", "@repo/shared"], env);
  await run("npm", ["run", "build", "-w", "@app/api"], env);

  console.log("Starting API...");
  apiProcess = spawn("node", ["apps/api/dist/index.js"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  apiProcess.stdout.on("data", (d) => process.stdout.write(d));
  apiProcess.stderr.on("data", (d) => process.stderr.write(d));

  const baseUrl = `http://127.0.0.1:${apiPort}`;
  await waitForHealth(baseUrl);

  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  if (health.status !== "ok") throw new Error("Health failed");
  console.log("API health: OK");

  const diagnostics = await (await fetch(`${baseUrl}/api/health/diagnostics`)).json();
  if (diagnostics.checks.database.status !== "up") {
    throw new Error(`Database check failed: ${JSON.stringify(diagnostics)}`);
  }
  console.log("PostgreSQL connection: OK");

  if (redisUrl) {
    if (diagnostics.checks.redis.status !== "up") {
      throw new Error(`Redis check failed: ${JSON.stringify(diagnostics)}`);
    }
    console.log("Redis connection: OK");
  } else {
    if (diagnostics.checks.redis.status !== "skipped") {
      throw new Error(`Expected Redis skipped when unset, got ${diagnostics.checks.redis.status}`);
    }
    console.log("Redis: skipped (no local Redis). Start docker compose redis to exercise Redis.");
  }

  const email = `user-${Date.now()}@example.com`;
  const password = "TestPass123!";

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Integration User",
      email,
      password,
    }),
  });
  const registerBody = await registerRes.json();
  if (!registerRes.ok) throw new Error(`Register failed: ${JSON.stringify(registerBody)}`);
  if (!registerBody.accessToken || !registerBody.refreshToken) {
    throw new Error("Missing tokens on register");
  }
  console.log("Register: OK");

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${registerBody.accessToken}` },
  });
  const meBody = await meRes.json();
  if (!meRes.ok || meBody.user?.email !== email) {
    throw new Error(`Protected /me failed: ${JSON.stringify(meBody)}`);
  }
  console.log("Protected route / dashboard auth: OK");

  const statusRes = await fetch(`${baseUrl}/api/status`, {
    headers: { Authorization: `Bearer ${registerBody.accessToken}` },
  });
  const statusBody = await statusRes.json();
  if (!statusRes.ok || statusBody.database?.status !== "up") {
    throw new Error(`Status failed: ${JSON.stringify(statusBody)}`);
  }
  console.log("Dashboard status endpoint: OK");

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok || !loginBody.accessToken || !loginBody.refreshToken) {
    throw new Error(`Login failed: ${JSON.stringify(loginBody)}`);
  }
  console.log("Login: OK");

  const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
  });
  const refreshBody = await refreshRes.json();
  if (!refreshRes.ok || !refreshBody.accessToken || !refreshBody.refreshToken) {
    throw new Error(`Refresh failed: ${JSON.stringify(refreshBody)}`);
  }
  console.log("Refresh token: OK");

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshBody.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: refreshBody.refreshToken }),
  });
  const logoutBody = await logoutRes.json();
  if (!logoutRes.ok) throw new Error(`Logout failed: ${JSON.stringify(logoutBody)}`);
  console.log("Logout: OK");

  const apiInfo = await (await fetch(`${baseUrl}/api`)).json();
  if (!apiInfo.name) throw new Error("API info endpoint failed");
  console.log("Frontend-to-API style JSON communication: OK");

  console.log("All integration checks passed.");
} finally {
  // Stop the API process fully before stopping Postgres.
  // Killing Postgres first (or while the API is still exiting) causes Prisma to
  // log Windows WSAECONNRESET / 10054 — not a runtime P1001 during requests.
  if (apiProcess) {
    await new Promise((resolve) => {
      if (apiProcess.exitCode !== null || apiProcess.signalCode !== null) {
        resolve();
        return;
      }
      apiProcess.once("exit", () => resolve());
      apiProcess.kill("SIGTERM");
    });
  }
  try {
    await pg.stop();
  } catch {
    // ignore
  }
}
