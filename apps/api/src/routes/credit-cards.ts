import type { FastifyInstance } from "fastify";
import { payInvoiceSchema } from "@finflow/shared";
import { getMonthBounds } from "../lib/date.js";
import { serializeTransaction } from "./transactions.js";

export async function registerCreditCardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/credit-cards/invoices",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { month: queryMonth } = request.query as { month?: string };
      const { month } = getMonthBounds(queryMonth);
      const userId = request.user.sub;

      const cards = await app.prisma.account.findMany({
        where: { userId, type: "CREDIT_CARD", isArchived: false },
        orderBy: { createdAt: "asc" },
      });

      const invoices = await Promise.all(
        cards.map(async (card) => {
          const txs = await app.prisma.transaction.findMany({
            where: {
              userId,
              accountId: card.id,
              invoiceMonth: month,
              type: "EXPENSE",
            },
            include: {
              account: { select: { id: true, name: true, color: true } },
              destinationAccount: { select: { id: true, name: true, color: true } },
              category: { select: { id: true, name: true, color: true, icon: true } },
            },
            orderBy: { date: "desc" },
          });

          const allPendingExpenses = await app.prisma.transaction.aggregate({
            where: {
              userId,
              accountId: card.id,
              type: "EXPENSE",
              status: "PENDING",
            },
            _sum: { amountCents: true },
          });

          const invoiceTotalCents = txs.reduce((sum, t) => sum + t.amountCents, 0);
          const paidTotalCents = txs
            .filter((t) => t.status === "PAID")
            .reduce((sum, t) => sum + t.amountCents, 0);
          const pendingTotalCents = invoiceTotalCents - paidTotalCents;
          const creditLimitCents = card.creditLimitCents ?? 0;
          const usedLimitCents = allPendingExpenses._sum.amountCents ?? 0;

          return {
            accountId: card.id,
            accountName: card.name,
            color: card.color,
            month,
            closingDay: card.closingDay ?? 10,
            dueDay: card.dueDay ?? 17,
            creditLimitCents,
            invoiceTotalCents,
            paidTotalCents,
            pendingTotalCents,
            availableLimitCents: Math.max(0, creditLimitCents - usedLimitCents),
            transactions: txs.map(serializeTransaction),
          };
        })
      );

      return invoices;
    }
  );

  app.post(
    "/api/v1/credit-cards/:accountId/pay-invoice",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { accountId } = request.params as { accountId: string };
      const parsed = payInvoiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const userId = request.user.sub;
      const [card, source] = await Promise.all([
        app.prisma.account.findFirst({ where: { id: accountId, userId, type: "CREDIT_CARD" } }),
        app.prisma.account.findFirst({ where: { id: parsed.data.sourceAccountId, userId } }),
      ]);

      if (!card || !source) {
        return reply.status(404).send({
          error: "NotFound",
          message: "Cartão ou conta pagadora não encontrada.",
        });
      }

      const pendingTxs = await app.prisma.transaction.findMany({
        where: {
          userId,
          accountId: card.id,
          invoiceMonth: parsed.data.month,
          type: "EXPENSE",
          status: "PENDING",
        },
      });

      const totalToPay = pendingTxs.reduce((s, t) => s + t.amountCents, 0);
      if (totalToPay <= 0) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Não há valores pendentes nesta fatura.",
        });
      }

      await app.prisma.$transaction([
        app.prisma.transaction.updateMany({
          where: { id: { in: pendingTxs.map((t) => t.id) } },
          data: { status: "PAID" },
        }),
        app.prisma.transaction.create({
          data: {
            userId,
            accountId: source.id,
            destinationAccountId: card.id,
            title: `Pagamento Fatura ${card.name} (${parsed.data.month})`,
            type: "TRANSFER",
            amountCents: totalToPay,
            date: new Date(),
            status: "PAID",
            tags: JSON.stringify(["fatura"]),
          },
        }),
      ]);

      return reply.send({ ok: true, paidCents: totalToPay });
    }
  );
}
