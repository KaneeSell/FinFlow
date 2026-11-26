import type { FastifyInstance } from "fastify";
import {
  createInvestmentSchema,
  updateInvestmentSchema,
  type AssetClass,
} from "@finflow/shared";
import { computeAccountBalances } from "./accounts.js";

function serializeAsset(a: {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  quantity: number;
  avgPriceCents: number;
  currentPriceCents: number;
  currency: string;
  indexer: string | null;
  indexerRate: number | null;
  notes: string | null;
}) {
  const totalInvestedCents = Math.round(a.quantity * a.avgPriceCents);
  const totalCurrentCents = Math.round(a.quantity * a.currentPriceCents);
  const gainLossCents = totalCurrentCents - totalInvestedCents;
  const gainLossPercent =
    totalInvestedCents > 0
      ? Math.round((gainLossCents / totalInvestedCents) * 1000) / 10
      : 0;

  return {
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    assetClass: a.assetClass as AssetClass,
    quantity: a.quantity,
    avgPriceCents: a.avgPriceCents,
    currentPriceCents: a.currentPriceCents,
    totalInvestedCents,
    totalCurrentCents,
    gainLossCents,
    gainLossPercent,
    currency: a.currency,
    indexer: a.indexer,
    indexerRate: a.indexerRate,
    notes: a.notes,
  };
}

export async function registerInvestmentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/investments",
    { preHandler: [app.authenticate] },
    async (request) => {
      const assets = await app.prisma.investmentAsset.findMany({
        where: { userId: request.user.sub },
        orderBy: [{ assetClass: "asc" }, { symbol: "asc" }],
      });
      return assets.map(serializeAsset);
    }
  );

  app.post(
    "/api/v1/investments",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createInvestmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const created = await app.prisma.investmentAsset.create({
        data: {
          userId: request.user.sub,
          symbol: parsed.data.symbol,
          name: parsed.data.name,
          assetClass: parsed.data.assetClass,
          quantity: parsed.data.quantity,
          avgPriceCents: parsed.data.avgPriceCents,
          currentPriceCents: parsed.data.currentPriceCents,
          currency: parsed.data.currency,
          indexer: parsed.data.indexer ?? null,
          indexerRate: parsed.data.indexerRate ?? null,
          notes: parsed.data.notes ?? null,
        },
      });
      return reply.status(201).send(serializeAsset(created));
    }
  );

  app.patch(
    "/api/v1/investments/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateInvestmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.investmentAsset.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Ativo não encontrado" });
      }

      const updated = await app.prisma.investmentAsset.update({
        where: { id },
        data: parsed.data,
      });
      return reply.send(serializeAsset(updated));
    }
  );

  app.delete(
    "/api/v1/investments/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.investmentAsset.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Ativo não encontrado" });
      }
      await app.prisma.investmentAsset.delete({ where: { id } });
      return reply.status(204).send();
    }
  );

  app.get(
    "/api/v1/investments/net-worth",
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.user.sub;
      const [accounts, deltas, assets] = await Promise.all([
        app.prisma.account.findMany({ where: { userId, isArchived: false } }),
        computeAccountBalances(app.prisma, userId),
        app.prisma.investmentAsset.findMany({ where: { userId } }),
      ]);

      const accountsTotalCents = accounts.reduce(
        (sum, acc) => sum + acc.initialBalanceCents + (deltas.get(acc.id) ?? 0),
        0
      );

      let investmentsTotalCents = 0;
      let investedCostCents = 0;
      const byClass = new Map<AssetClass, number>();

      for (const a of assets) {
        const current = Math.round(a.quantity * a.currentPriceCents);
        const cost = Math.round(a.quantity * a.avgPriceCents);
        investmentsTotalCents += current;
        investedCostCents += cost;
        const cls = a.assetClass as AssetClass;
        byClass.set(cls, (byClass.get(cls) ?? 0) + current);
      }

      const allocationByClass = Array.from(byClass.entries()).map(([assetClass, totalCents]) => ({
        assetClass,
        totalCents,
        percent:
          investmentsTotalCents > 0
            ? Math.round((totalCents / investmentsTotalCents) * 1000) / 10
            : 0,
      }));

      return {
        accountsTotalCents,
        investmentsTotalCents,
        netWorthCents: accountsTotalCents + investmentsTotalCents,
        investedCostCents,
        totalGainLossCents: investmentsTotalCents - investedCostCents,
        allocationByClass,
      };
    }
  );
}
