import type { FastifyInstance } from "fastify";
import { createAccountSchema, updateAccountSchema } from "@finflow/shared";
import type { PrismaClient } from "@prisma/client";

export async function computeAccountBalances(
  prisma: PrismaClient,
  userId: string
): Promise<Map<string, number>> {
  const paidTxs = await prisma.transaction.findMany({
    where: { userId, status: "PAID" },
    select: {
      accountId: true,
      destinationAccountId: true,
      type: true,
      amountCents: true,
    },
  });

  const deltaMap = new Map<string, number>();
  const addDelta = (accountId: string, delta: number) => {
    deltaMap.set(accountId, (deltaMap.get(accountId) ?? 0) + delta);
  };

  for (const tx of paidTxs) {
    if (tx.type === "INCOME") {
      addDelta(tx.accountId, tx.amountCents);
    } else if (tx.type === "EXPENSE") {
      addDelta(tx.accountId, -tx.amountCents);
    } else if (tx.type === "TRANSFER") {
      addDelta(tx.accountId, -tx.amountCents);
      if (tx.destinationAccountId) {
        addDelta(tx.destinationAccountId, tx.amountCents);
      }
    }
  }

  return deltaMap;
}

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/accounts",
    { preHandler: [app.authenticate] },
    async (request) => {
      const accounts = await app.prisma.account.findMany({
        where: { userId: request.user.sub },
        orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
      });
      const deltas = await computeAccountBalances(app.prisma, request.user.sub);

      return accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        initialBalanceCents: acc.initialBalanceCents,
        currentBalanceCents: acc.initialBalanceCents + (deltas.get(acc.id) ?? 0),
        color: acc.color,
        icon: acc.icon,
        isArchived: acc.isArchived,
        createdAt: acc.createdAt.toISOString(),
      }));
    }
  );

  app.post(
    "/api/v1/accounts",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const acc = await app.prisma.account.create({
        data: {
          userId: request.user.sub,
          ...parsed.data,
        },
      });

      return reply.status(201).send({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        initialBalanceCents: acc.initialBalanceCents,
        currentBalanceCents: acc.initialBalanceCents,
        color: acc.color,
        icon: acc.icon,
        isArchived: acc.isArchived,
        createdAt: acc.createdAt.toISOString(),
      });
    }
  );

  app.patch(
    "/api/v1/accounts/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.account.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Conta não encontrada" });
      }

      const updated = await app.prisma.account.update({
        where: { id },
        data: parsed.data,
      });
      const deltas = await computeAccountBalances(app.prisma, request.user.sub);

      return reply.send({
        id: updated.id,
        name: updated.name,
        type: updated.type,
        initialBalanceCents: updated.initialBalanceCents,
        currentBalanceCents: updated.initialBalanceCents + (deltas.get(updated.id) ?? 0),
        color: updated.color,
        icon: updated.icon,
        isArchived: updated.isArchived,
        createdAt: updated.createdAt.toISOString(),
      });
    }
  );

  app.delete(
    "/api/v1/accounts/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.account.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Conta não encontrada" });
      }

      await app.prisma.account.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
