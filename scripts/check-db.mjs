/**
 * Single PostgreSQL connectivity check (Prisma SELECT 1).
 * Usage: DATABASE_URL=... node scripts/check-db.mjs
 */
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const parsed = new URL(databaseUrl);
console.log("Checking PostgreSQL via Prisma...");
console.log(
  `host=${parsed.hostname} port=${parsed.port || "5432"} db=${parsed.pathname} sslmode=${parsed.searchParams.get("sslmode") || "(unset)"}`,
);

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
  log: ["error"],
});

try {
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log(`Database connectivity OK (${Date.now() - started}ms)`);
  process.exitCode = 0;
} catch (error) {
  console.error("Database connectivity FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
