import type { FastifyInstance } from "fastify";
import { createOpenFinanceSchema } from "@finflow/shared";

export async function registerOpenFinanceRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/open-finance/connections",
    { preHandler: [app.authenticate] },
    async (request) => {
      const items = await app.prisma.openFinanceConnection.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: "desc" },
      });
      return items.map((c) => ({
        id: c.id,
        provider: c.provider,
        institutionName: c.institutionName,
        status: c.status,
        lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      }));
    }
  );

  app.post(
    "/api/v1/open-finance/connections",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createOpenFinanceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "ValidationError", message: "Dados inválidos" });
      }

      const created = await app.prisma.openFinanceConnection.create({
        data: {
          userId: request.user.sub,
          provider: parsed.data.provider,
          institutionName: parsed.data.institutionName,
          externalItemId: parsed.data.externalItemId ?? null,
          status: "CONNECTED",
        },
      });
      return reply.status(201).send({
        id: created.id,
        provider: created.provider,
        institutionName: created.institutionName,
        status: created.status,
        lastSyncAt: null,
      });
    }
  );

  app.post(
    "/api/v1/open-finance/connections/:id/sync",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const conn = await app.prisma.openFinanceConnection.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!conn) return reply.status(404).send({ error: "NotFound" });

      const account = await app.prisma.account.findFirst({
        where: { userId: request.user.sub, isArchived: false },
        orderBy: { createdAt: "asc" },
      });

      let imported = 0;
      if (account) {
        const sampleTitle = `Open Finance (${conn.institutionName})`;
        const exists = await app.prisma.transaction.findFirst({
          where: { userId: request.user.sub, title: sampleTitle },
        });
        if (!exists) {
          await app.prisma.transaction.create({
            data: {
              userId: request.user.sub,
              accountId: account.id,
              title: sampleTitle,
              type: "EXPENSE",
              amountCents: 4990,
              date: new Date(),
              status: "PAID",
              tags: JSON.stringify(["open-finance"]),
            },
          });
          imported = 1;
        }
      }

      const updated = await app.prisma.openFinanceConnection.update({
        where: { id: conn.id },
        data: { lastSyncAt: new Date() },
      });

      return reply.send({
        syncedAt: updated.lastSyncAt?.toISOString(),
        imported,
      });
    }
  );

  app.delete(
    "/api/v1/open-finance/connections/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const conn = await app.prisma.openFinanceConnection.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!conn) return reply.status(404).send({ error: "NotFound" });
      await app.prisma.openFinanceConnection.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
