import { hashPassword } from "./lib/auth.js";
import { seedDefaultUserData } from "./lib/defaults.js";
import { createPrismaClient } from "./lib/prisma.js";

async function seed(): Promise<void> {
  const prisma = createPrismaClient();
  const email = "demo@finflow.app";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists:", email);
    await prisma.$disconnect();
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: "Demo FinFlow",
      email,
      passwordHash: await hashPassword("123456"),
      currency: "BRL",
    },
  });

  await seedDefaultUserData(prisma, user.id);
  console.log("Seeded demo user:", email);
  await prisma.$disconnect();
}

void seed();
