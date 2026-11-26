import type { FastifyInstance } from "fastify";
import {
  calculateFireProjection,
  parseNaturalLanguageTransaction,
  parseNfceQrCode,
} from "@finflow/shared";
import { getMonthBounds } from "../lib/date.js";
import { computeAccountBalances } from "./accounts.js";

export async function registerInsightRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/insights",
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.user.sub;
      const { month, start, end } = getMonthBounds();

      const [accounts, deltas, assets, monthTxs, recurringRules] = await Promise.all([
        app.prisma.account.findMany({ where: { userId, isArchived: false } }),
        computeAccountBalances(app.prisma, userId),
        app.prisma.investmentAsset.findMany({ where: { userId } }),
        app.prisma.transaction.findMany({
          where: { userId, date: { gte: start, lt: end }, status: "PAID" },
        }),
        app.prisma.recurringRule.findMany({
          where: { userId, isActive: true, type: "EXPENSE" },
        }),
      ]);

      const accountsTotalCents = accounts.reduce(
        (sum, acc) => sum + acc.initialBalanceCents + (deltas.get(acc.id) ?? 0),
        0
      );
      const investmentsTotalCents = assets.reduce(
        (sum, a) => sum + Math.round(a.quantity * a.currentPriceCents),
        0
      );
      const netWorthCents = accountsTotalCents + investmentsTotalCents;

      const monthlyIncomeCents = monthTxs
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + t.amountCents, 0);
      const monthlyExpenseCents = monthTxs
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + t.amountCents, 0);

      const recurringMonthlyCents = recurringRules.reduce((s, r) => s + r.amountCents, 0);
      const recurringSharePercent =
        monthlyIncomeCents > 0
          ? Math.round((recurringMonthlyCents / monthlyIncomeCents) * 1000) / 10
          : 0;

      const fire = calculateFireProjection(
        Math.max(monthlyExpenseCents, 100000),
        netWorthCents,
        Math.max(0, monthlyIncomeCents - monthlyExpenseCents),
        6
      );

      const tips: string[] = [];
      if (recurringSharePercent > 50) {
        tips.push(
          `Seus gastos recorrentes comprometem ${recurringSharePercent}% da sua renda mensal.`
        );
      }
      if (monthlyIncomeCents > monthlyExpenseCents) {
        tips.push("Saldo positivo neste mês! Excelente momento para aportar em metas ou ativos.");
      } else if (monthlyExpenseCents > 0) {
        tips.push("Despesas acima das receitas neste mês. Revise suas categorias de maior gasto.");
      }

      return {
        month,
        netWorthCents,
        recurringSharePercent,
        fire,
        tips,
      };
    }
  );

  app.post(
    "/api/v1/insights/parse-nl",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { text } = (request.body ?? {}) as { text?: string };
      const categories = await app.prisma.category.findMany({
        where: { userId: request.user.sub },
        select: { id: true, name: true, type: true },
      });
      return parseNaturalLanguageTransaction(text ?? "", categories);
    }
  );

  app.post(
    "/api/v1/insights/parse-nfce",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { input } = (request.body ?? {}) as { input?: string };
      return parseNfceQrCode(input ?? "");
    }
  );
}
