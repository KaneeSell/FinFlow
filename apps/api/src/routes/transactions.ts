import type { FastifyInstance } from "fastify";
import { createTransactionSchema, updateTransactionSchema } from "@finflow/shared";
import { getMonthBounds, parseDateInput } from "../lib/date.js";

function serializeTransaction(tx: {
  id: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  recurringRuleId: string | null;
  title: string;
  type: string;
  amountCents: number;
  date: Date;
  status: string;
  notes: string | null;
  tags: string;
  createdAt: Date;
  account?: { id: string; name: string; color: string } | null;
  destinationAccount?: { id: string; name: string; color: string } | null;
  category?: { id: string; name: string; color: string; icon: string } | null;
}) {
  let parsedTags: string[] = [];
  try {
    parsedTags = JSON.parse(tx.tags) as string[];
  } catch {
    parsedTags = [];
  }

  return {
    id: tx.id,
    accountId: tx.accountId,
    destinationAccountId: tx.destinationAccountId,
    categoryId: tx.categoryId,
    recurringRuleId: tx.recurringRuleId,
    title: tx.title,
    type: tx.type,
    amountCents: tx.amountCents,
    date: tx.date.toISOString(),
    status: tx.status,
    notes: tx.notes,
    tags: parsedTags,
    createdAt: tx.createdAt.toISOString(),
    account: tx.account ?? null,
    destinationAccount: tx.destinationAccount ?? null,
    category: tx.category ?? null,
  };
}

export { serializeTransaction };

export async function registerTransactionRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/transactions",
    { preHandler: [app.authenticate] },
    async (request) => {
      const query = request.query as {
        month?: string;
        type?: string;
        accountId?: string;
        categoryId?: string;
        status?: string;
        search?: string;
      };

      const where: Record<string, unknown> = {
        userId: request.user.sub,
      };

      if (query.month) {
        const { start, end } = getMonthBounds(query.month);
        where.date = { gte: start, lt: end };
      }
      if (query.type) where.type = query.type;
      if (query.accountId) where.accountId = query.accountId;
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.status) where.status = query.status;
      if (query.search) {
        where.title = { contains: query.search };
      }

      const txs = await app.prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, color: true } },
          destinationAccount: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      });

      return txs.map(serializeTransaction);
    }
  );

  app.post(
    "/api/v1/transactions",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createTransactionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const account = await app.prisma.account.findFirst({
        where: { id: parsed.data.accountId, userId: request.user.sub },
      });
      if (!account) {
        return reply.status(404).send({ error: "NotFound", message: "Conta não encontrada" });
      }

      if (parsed.data.destinationAccountId) {
        const dest = await app.prisma.account.findFirst({
          where: { id: parsed.data.destinationAccountId, userId: request.user.sub },
        });
        if (!dest) {
          return reply
            .status(404)
            .send({ error: "NotFound", message: "Conta de destino não encontrada" });
        }
      }

      const created = await app.prisma.transaction.create({
        data: {
          userId: request.user.sub,
          accountId: parsed.data.accountId,
          destinationAccountId: parsed.data.destinationAccountId ?? null,
          categoryId: parsed.data.categoryId ?? null,
          title: parsed.data.title,
          type: parsed.data.type,
          amountCents: parsed.data.amountCents,
          date: parseDateInput(parsed.data.date),
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
          tags: JSON.stringify(parsed.data.tags ?? []),
        },
        include: {
          account: { select: { id: true, name: true, color: true } },
          destinationAccount: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
      });

      return reply.status(201).send(serializeTransaction(created));
    }
  );

  app.patch(
    "/api/v1/transactions/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateTransactionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.transaction.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Lançamento não encontrado" });
      }

      const updated = await app.prisma.transaction.update({
        where: { id },
        data: {
          ...(parsed.data.accountId !== undefined && { accountId: parsed.data.accountId }),
          ...(parsed.data.destinationAccountId !== undefined && {
            destinationAccountId: parsed.data.destinationAccountId,
          }),
          ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
          ...(parsed.data.title !== undefined && { title: parsed.data.title }),
          ...(parsed.data.type !== undefined && { type: parsed.data.type }),
          ...(parsed.data.amountCents !== undefined && { amountCents: parsed.data.amountCents }),
          ...(parsed.data.date !== undefined && { date: parseDateInput(parsed.data.date) }),
          ...(parsed.data.status !== undefined && { status: parsed.data.status }),
          ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
          ...(parsed.data.tags !== undefined && { tags: JSON.stringify(parsed.data.tags) }),
        },
        include: {
          account: { select: { id: true, name: true, color: true } },
          destinationAccount: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
      });

      return reply.send(serializeTransaction(updated));
    }
  );

  app.patch(
    "/api/v1/transactions/:id/toggle-status",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.transaction.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Lançamento não encontrado" });
      }

      const nextStatus = existing.status === "PAID" ? "PENDING" : "PAID";
      const updated = await app.prisma.transaction.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          account: { select: { id: true, name: true, color: true } },
          destinationAccount: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
      });

      return reply.send(serializeTransaction(updated));
    }
  );

  app.delete(
    "/api/v1/transactions/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.transaction.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Lançamento não encontrado" });
      }

      await app.prisma.transaction.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
