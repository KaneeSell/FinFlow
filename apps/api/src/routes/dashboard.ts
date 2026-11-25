import type { FastifyInstance } from "fastify";
import {
  calculateDashboardTotals,
  calculateSavingsRate,
  type TransactionStatus,
  type TransactionType,
} from "@finflow/shared";
import { getLastNMonths, getMonthBounds } from "../lib/date.js";
import { computeAccountBalances } from "./accounts.js";
import { serializeRule } from "./recurring.js";
import { serializeTransaction } from "./transactions.js";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/dashboard/summary",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { month: queryMonth } = request.query as { month?: string };
      const { month, start, end } = getMonthBounds(queryMonth);
      const userId = request.user.sub;

      const [accounts, deltas, monthTxs, upcomingRules, recentTxs] = await Promise.all([
        app.prisma.account.findMany({ where: { userId, isArchived: false } }),
        computeAccountBalances(app.prisma, userId),
        app.prisma.transaction.findMany({
          where: { userId, date: { gte: start, lt: end } },
          include: {
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        }),
        app.prisma.recurringRule.findMany({
          where: { userId, isActive: true },
          include: {
            account: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
          orderBy: { nextRunDate: "asc" },
          take: 5,
        }),
        app.prisma.transaction.findMany({
          where: { userId },
          include: {
            account: { select: { id: true, name: true, color: true } },
            destinationAccount: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 8,
        }),
      ]);

      const totalBalanceCents = accounts.reduce(
        (sum, acc) => sum + acc.initialBalanceCents + (deltas.get(acc.id) ?? 0),
        0
      );

      const totals = calculateDashboardTotals(
        monthTxs.map((t) => ({
          type: t.type as TransactionType,
          amountCents: t.amountCents,
          status: t.status as TransactionStatus,
        }))
      );

      // Expenses by category (PAID + PENDING in month for full visibility)
      const catTotals = new Map<
        string,
        { categoryId: string | null; categoryName: string; color: string; totalCents: number }
      >();
      let allMonthExpenseCents = 0;

      for (const tx of monthTxs) {
        if (tx.type !== "EXPENSE") continue;
        allMonthExpenseCents += tx.amountCents;
        const key = tx.categoryId ?? "__uncategorized__";
        const current = catTotals.get(key) ?? {
          categoryId: tx.categoryId,
          categoryName: tx.category?.name ?? "Sem categoria",
          color: tx.category?.color ?? "#64748b",
          totalCents: 0,
        };
        current.totalCents += tx.amountCents;
        catTotals.set(key, current);
      }

      const expensesByCategory = Array.from(catTotals.values())
        .sort((a, b) => b.totalCents - a.totalCents)
        .map((item) => ({
          ...item,
          percent:
            allMonthExpenseCents > 0
              ? Math.round((item.totalCents / allMonthExpenseCents) * 1000) / 10
              : 0,
        }));

      // 6-month cashflow history
      const monthsList = getLastNMonths(month, 6);
      const firstMonthBounds = getMonthBounds(monthsList[0]);
      const historyTxs = await app.prisma.transaction.findMany({
        where: {
          userId,
          status: "PAID",
          type: { in: ["INCOME", "EXPENSE"] },
          date: { gte: firstMonthBounds.start, lt: end },
        },
        select: { type: true, amountCents: true, date: true },
      });

      const historyMap = new Map<string, { incomeCents: number; expenseCents: number }>();
      for (const m of monthsList) {
        historyMap.set(m, { incomeCents: 0, expenseCents: 0 });
      }
      for (const tx of historyTxs) {
        const key = `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, "0")}`;
        const bucket = historyMap.get(key);
        if (!bucket) continue;
        if (tx.type === "INCOME") bucket.incomeCents += tx.amountCents;
        else if (tx.type === "EXPENSE") bucket.expenseCents += tx.amountCents;
      }

      return {
        month,
        totalBalanceCents,
        monthlyIncomeCents: totals.paidIncomeCents,
        monthlyExpenseCents: totals.paidExpenseCents,
        monthlyNetCents: totals.netPaidCents,
        pendingIncomeCents: totals.pendingIncomeCents,
        pendingExpenseCents: totals.pendingExpenseCents,
        savingsRatePercent: calculateSavingsRate(
          totals.paidIncomeCents,
          totals.paidExpenseCents
        ),
        expensesByCategory,
        cashflowHistory: monthsList.map((m) => ({
          month: m,
          ...(historyMap.get(m) ?? { incomeCents: 0, expenseCents: 0 }),
        })),
        upcomingRecurring: upcomingRules.map(serializeRule),
        recentTransactions: recentTxs.map(serializeTransaction),
      };
    }
  );
}
