import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pgData = path.join(root, ".pg-data-test");
const pgPort = 55432;

const jwtSecret = "integration-test-secret-key-32chars-min";
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/postgres?schema=public`;

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

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
    CORS_ORIGIN: "http://localhost:3000",
    NODE_ENV: "development",
    PORT: "4010",
    BCRYPT_SALT_ROUNDS: "10",
  };

  console.log("Running migrations...");
  await run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"], env);

  console.log("Seeding...");
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

  const baseUrl = "http://127.0.0.1:4010";
  await waitForHealth(baseUrl);

  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  if (health.status !== "ok") throw new Error("Health failed");

  const diagnostics = await (await fetch(`${baseUrl}/api/health/diagnostics`)).json();
  if (diagnostics.checks.database.status !== "up") {
    throw new Error(`Database check failed: ${JSON.stringify(diagnostics)}`);
  }
  console.log("Database connection: OK");
  console.log(`Redis status: ${diagnostics.checks.redis.status}`);

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
  if (!registerBody.accessToken) throw new Error("Missing access token on register");
  console.log("Register: OK");

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${registerBody.accessToken}` },
  });
  const meBody = await meRes.json();
  if (!meRes.ok || meBody.user?.email !== email) {
    throw new Error(`Protected /me failed: ${JSON.stringify(meBody)}`);
  }
  console.log("Protected route: OK");

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok || !loginBody.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(loginBody)}`);
  }
  console.log("Login: OK");

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${loginBody.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
  });
  const logoutBody = await logoutRes.json();
  if (!logoutRes.ok) throw new Error(`Logout failed: ${JSON.stringify(logoutBody)}`);
  console.log("Logout: OK");

  console.log("All integration checks passed.");
} finally {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
  }
  try {
    await pg.stop();
  } catch {
    // ignore
  }
}
