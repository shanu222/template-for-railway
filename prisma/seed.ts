import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * DEVELOPMENT / DEMO SEED ONLY
 *
 * Creates a convenience user for local demos.
 * Do NOT run this against a real production database unless you
 * explicitly set ALLOW_PROD_SEED=true and understand the risk.
 */
const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    console.error(
      "Refusing to seed: NODE_ENV=production without ALLOW_PROD_SEED=true.",
    );
    console.error(
      "Seed data is for local/demo use only. Register real users through the API.",
    );
    process.exit(1);
  }

  const email = (process.env.SEED_USER_EMAIL || "demo@example.com").toLowerCase().trim();
  const password = process.env.SEED_USER_PASSWORD || "DemoPassword123!";
  const name = process.env.SEED_USER_NAME || "Demo User";
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
    },
    create: {
      email,
      name,
      passwordHash,
    },
  });

  console.log("Demo seed complete (development/demo data only).");
  console.log(`Demo user email: ${user.email}`);
  console.log(
    "Demo password comes from SEED_USER_PASSWORD (local default in .env.example).",
  );
  console.log("Do not reuse demo credentials in production.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
