import type { FastifyInstance } from "fastify";
import { projectCashflow, type RecurrenceFrequency } from "@finflow/shared";
import { computeAccountBalances } from "./accounts.js";

export async function registerForecastRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/forecast",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { months: rawMonths } = request.query as { months?: string };
      const parsedMonths = Number(rawMonths);
      const months: 3 | 6 | 12 = parsedMonths === 3 || parsedMonths === 12 ? parsedMonths : 6;
      const userId = request.user.sub;

      const [accounts, deltas, rules, pendingTxs] = await Promise.all([
        app.prisma.account.findMany({ where: { userId, isArchived: false } }),
        computeAccountBalances(app.prisma, userId),
        app.prisma.recurringRule.findMany({ where: { userId, isActive: true } }),
        app.prisma.transaction.findMany({
          where: { userId, status: "PENDING", date: { gte: new Date() } },
          select: { type: true, amountCents: true, date: true },
        }),
      ]);

      const startingBalanceCents = accounts.reduce(
        (sum, acc) => sum + acc.initialBalanceCents + (deltas.get(acc.id) ?? 0),
        0
      );

      return projectCashflow(
        startingBalanceCents,
        rules.map((r) => ({
          type: r.type as "INCOME" | "EXPENSE",
          amountCents: r.amountCents,
          frequency: r.frequency as RecurrenceFrequency,
          dayOfMonth: r.dayOfMonth,
          nextRunDate: r.nextRunDate,
          endDate: r.endDate,
          isActive: r.isActive,
        })),
        pendingTxs.map((t) => ({
          type: t.type as "INCOME" | "EXPENSE" | "TRANSFER",
          amountCents: t.amountCents,
          date: t.date,
        })),
        months
      );
    }
  );
}
