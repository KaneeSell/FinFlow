import type { FastifyInstance } from "fastify";
import {
  calculateGoalProjection,
  contributeGoalSchema,
  createGoalSchema,
  updateGoalSchema,
} from "@finflow/shared";
import { getMonthBounds, parseDateInput } from "../lib/date.js";

function serializeGoal(g: {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  deadline: Date | null;
  color: string;
  icon: string;
  notes: string | null;
  createdAt: Date;
}) {
  const proj = calculateGoalProjection(g.targetAmountCents, g.currentAmountCents, 0);
  return {
    id: g.id,
    name: g.name,
    targetAmountCents: g.targetAmountCents,
    currentAmountCents: g.currentAmountCents,
    deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
    color: g.color,
    icon: g.icon,
    notes: g.notes,
    percent: proj.percent,
    remainingCents: proj.remainingCents,
    createdAt: g.createdAt.toISOString(),
  };
}

export async function registerBudgetsGoalsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/budgets",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { month: queryMonth } = request.query as { month?: string };
      const { start, end } = getMonthBounds(queryMonth);
      const userId = request.user.sub;

      const [categories, expenses] = await Promise.all([
        app.prisma.category.findMany({
          where: { userId, type: "EXPENSE", budgetLimitCents: { not: null } },
          orderBy: { name: "asc" },
        }),
        app.prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            userId,
            type: "EXPENSE",
            date: { gte: start, lt: end },
            categoryId: { not: null },
          },
          _sum: { amountCents: true },
        }),
      ]);

      const spentMap = new Map<string, number>();
      for (const row of expenses) {
        if (row.categoryId) {
          spentMap.set(row.categoryId, row._sum.amountCents ?? 0);
        }
      }

      return categories.map((cat) => {
        const limit = cat.budgetLimitCents ?? 0;
        const spent = spentMap.get(cat.id) ?? 0;
        const percent = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;
        const alertLevel = percent >= 100 ? "exceeded" : percent >= 80 ? "warning" : "ok";
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          color: cat.color,
          budgetLimitCents: limit,
          spentCents: spent,
          percent,
          alertLevel,
        };
      });
    }
  );

  app.get(
    "/api/v1/goals",
    { preHandler: [app.authenticate] },
    async (request) => {
      const goals = await app.prisma.goal.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: "asc" },
      });
      return goals.map(serializeGoal);
    }
  );

  app.post(
    "/api/v1/goals",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createGoalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const goal = await app.prisma.goal.create({
        data: {
          userId: request.user.sub,
          name: parsed.data.name,
          targetAmountCents: parsed.data.targetAmountCents,
          currentAmountCents: parsed.data.currentAmountCents,
          deadline: parsed.data.deadline ? parseDateInput(parsed.data.deadline) : null,
          color: parsed.data.color,
          icon: parsed.data.icon,
          notes: parsed.data.notes ?? null,
        },
      });
      return reply.status(201).send(serializeGoal(goal));
    }
  );

  app.patch(
    "/api/v1/goals/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateGoalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.goal.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Meta não encontrada" });
      }

      const updated = await app.prisma.goal.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.targetAmountCents !== undefined && {
            targetAmountCents: parsed.data.targetAmountCents,
          }),
          ...(parsed.data.currentAmountCents !== undefined && {
            currentAmountCents: parsed.data.currentAmountCents,
          }),
          ...(parsed.data.deadline !== undefined && {
            deadline: parsed.data.deadline ? parseDateInput(parsed.data.deadline) : null,
          }),
          ...(parsed.data.color !== undefined && { color: parsed.data.color }),
          ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        },
      });

      return reply.send(serializeGoal(updated));
    }
  );

  app.post(
    "/api/v1/goals/:id/contribute",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = contributeGoalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.goal.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Meta não encontrada" });
      }

      const updated = await app.prisma.goal.update({
        where: { id },
        data: { currentAmountCents: existing.currentAmountCents + parsed.data.amountCents },
      });
      return reply.send(serializeGoal(updated));
    }
  );

  app.delete(
    "/api/v1/goals/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.goal.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Meta não encontrada" });
      }
      await app.prisma.goal.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
