import type { PrismaClient } from "@prisma/client";

export async function seedDefaultUserData(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.account.createMany({
    data: [
      {
        userId,
        name: "Conta Corrente",
        type: "CHECKING",
        initialBalanceCents: 0,
        color: "#10b981",
        icon: "landmark",
      },
      {
        userId,
        name: "Carteira",
        type: "WALLET",
        initialBalanceCents: 0,
        color: "#f59e0b",
        icon: "wallet",
      },
    ],
  });

  await prisma.category.createMany({
    data: [
      { userId, name: "Salário", type: "INCOME", color: "#10b981", icon: "briefcase" },
      { userId, name: "Freelance", type: "INCOME", color: "#06b6d4", icon: "laptop" },
      { userId, name: "Rendimentos", type: "INCOME", color: "#8b5cf6", icon: "trending-up" },
      { userId, name: "Moradia", type: "EXPENSE", color: "#ef4444", icon: "home" },
      { userId, name: "Alimentação", type: "EXPENSE", color: "#f97316", icon: "utensils" },
      { userId, name: "Transporte", type: "EXPENSE", color: "#3b82f6", icon: "car" },
      { userId, name: "Assinaturas", type: "EXPENSE", color: "#ec4899", icon: "repeat" },
      { userId, name: "Saúde", type: "EXPENSE", color: "#14b8a6", icon: "heart-pulse" },
      { userId, name: "Lazer", type: "EXPENSE", color: "#a855f7", icon: "gamepad-2" },
    ],
  });
}
