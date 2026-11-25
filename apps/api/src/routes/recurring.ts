import type { FastifyInstance } from "fastify";
import {
  computeNextOccurrenceDate,
  createRecurringRuleSchema,
  updateRecurringRuleSchema,
  type RecurrenceFrequency,
} from "@finflow/shared";
import { parseDateInput } from "../lib/date.js";
import { serializeTransaction } from "./transactions.js";

function serializeRule(rule: {
  id: string;
  accountId: string;
  categoryId: string | null;
  title: string;
  type: string;
  amountCents: number;
  frequency: string;
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  nextRunDate: Date;
  isActive: boolean;
  notes: string | null;
  account?: { id: string; name: string; color: string } | null;
  category?: { id: string; name: string; color: string; icon: string } | null;
}) {
  return {
    id: rule.id,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    title: rule.title,
    type: rule.type,
    amountCents: rule.amountCents,
    frequency: rule.frequency,
    dayOfMonth: rule.dayOfMonth,
    startDate: rule.startDate.toISOString(),
    endDate: rule.endDate ? rule.endDate.toISOString() : null,
    nextRunDate: rule.nextRunDate.toISOString(),
    isActive: rule.isActive,
    notes: rule.notes,
    account: rule.account ?? null,
    category: rule.category ?? null,
  };
}

export { serializeRule };

export async function registerRecurringRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/recurring",
    { preHandler: [app.authenticate] },
    async (request) => {
      const rules = await app.prisma.recurringRule.findMany({
        where: { userId: request.user.sub },
        include: {
          account: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
        orderBy: [{ isActive: "desc" }, { nextRunDate: "asc" }],
      });

      return rules.map(serializeRule);
    }
  );

  app.post(
    "/api/v1/recurring",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createRecurringRuleSchema.safeParse(request.body);
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

      const startDate = parseDateInput(parsed.data.startDate);
      const created = await app.prisma.recurringRule.create({
        data: {
          userId: request.user.sub,
          accountId: parsed.data.accountId,
          categoryId: parsed.data.categoryId ?? null,
          title: parsed.data.title,
          type: parsed.data.type,
          amountCents: parsed.data.amountCents,
          frequency: parsed.data.frequency,
          dayOfMonth: parsed.data.dayOfMonth ?? startDate.getUTCDate(),
          startDate,
          endDate: parsed.data.endDate ? parseDateInput(parsed.data.endDate) : null,
          nextRunDate: startDate,
          notes: parsed.data.notes ?? null,
        },
        include: {
          account: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
      });

      return reply.status(201).send(serializeRule(created));
    }
  );

  app.patch(
    "/api/v1/recurring/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateRecurringRuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.recurringRule.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Recorrência não encontrada" });
      }

      const updated = await app.prisma.recurringRule.update({
        where: { id },
        data: {
          ...(parsed.data.accountId !== undefined && { accountId: parsed.data.accountId }),
          ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
          ...(parsed.data.title !== undefined && { title: parsed.data.title }),
          ...(parsed.data.type !== undefined && { type: parsed.data.type }),
          ...(parsed.data.amountCents !== undefined && { amountCents: parsed.data.amountCents }),
          ...(parsed.data.frequency !== undefined && { frequency: parsed.data.frequency }),
          ...(parsed.data.dayOfMonth !== undefined && { dayOfMonth: parsed.data.dayOfMonth }),
          ...(parsed.data.startDate !== undefined && {
            startDate: parseDateInput(parsed.data.startDate),
          }),
          ...(parsed.data.endDate !== undefined && {
            endDate: parsed.data.endDate ? parseDateInput(parsed.data.endDate) : null,
          }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
          ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        },
        include: {
          account: { select: { id: true, name: true, color: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
      });

      return reply.send(serializeRule(updated));
    }
  );

  app.post(
    "/api/v1/recurring/:id/materialize",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { status?: "PAID" | "PENDING" };

      const rule = await app.prisma.recurringRule.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!rule) {
        return reply.status(404).send({ error: "NotFound", message: "Recorrência não encontrada" });
      }

      const nextRunDate = computeNextOccurrenceDate(
        rule.frequency as RecurrenceFrequency,
        rule.nextRunDate,
        rule.dayOfMonth
      );

      const [transaction, updatedRule] = await app.prisma.$transaction([
        app.prisma.transaction.create({
          data: {
            userId: request.user.sub,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            recurringRuleId: rule.id,
            title: rule.title,
            type: rule.type,
            amountCents: rule.amountCents,
            date: rule.nextRunDate,
            status: body.status ?? "PAID",
            notes: rule.notes,
            tags: JSON.stringify(["recorrente"]),
          },
          include: {
            account: { select: { id: true, name: true, color: true } },
            destinationAccount: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        }),
        app.prisma.recurringRule.update({
          where: { id: rule.id },
          data: {
            nextRunDate,
            isActive: rule.endDate && nextRunDate > rule.endDate ? false : rule.isActive,
          },
          include: {
            account: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        }),
      ]);

      return reply.status(201).send({
        transaction: serializeTransaction(transaction),
        rule: serializeRule(updatedRule),
      });
    }
  );

  app.post(
    "/api/v1/recurring/process-due",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const now = new Date();
      const dueRules = await app.prisma.recurringRule.findMany({
        where: {
          userId: request.user.sub,
          isActive: true,
          nextRunDate: { lte: now },
        },
      });

      let generatedCount = 0;
      for (const rule of dueRules) {
        const nextRunDate = computeNextOccurrenceDate(
          rule.frequency as RecurrenceFrequency,
          rule.nextRunDate,
          rule.dayOfMonth
        );

        await app.prisma.$transaction([
          app.prisma.transaction.create({
            data: {
              userId: request.user.sub,
              accountId: rule.accountId,
              categoryId: rule.categoryId,
              recurringRuleId: rule.id,
              title: rule.title,
              type: rule.type,
              amountCents: rule.amountCents,
              date: rule.nextRunDate,
              status: "PENDING",
              notes: rule.notes,
              tags: JSON.stringify(["recorrente"]),
            },
          }),
          app.prisma.recurringRule.update({
            where: { id: rule.id },
            data: {
              nextRunDate,
              isActive: rule.endDate && nextRunDate > rule.endDate ? false : rule.isActive,
            },
          }),
        ]);
        generatedCount += 1;
      }

      return reply.send({ processed: generatedCount });
    }
  );

  app.delete(
    "/api/v1/recurring/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.recurringRule.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Recorrência não encontrada" });
      }

      await app.prisma.recurringRule.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
