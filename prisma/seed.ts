import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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

  console.log("Seed complete.");
  console.log(`Demo user: ${user.email}`);
  console.log("Use the password from SEED_USER_PASSWORD (default: DemoPassword123!).");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
