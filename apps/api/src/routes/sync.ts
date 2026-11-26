import type { FastifyInstance } from "fastify";
import { syncBatchSchema } from "@finflow/shared";
import { parseDateInput } from "../lib/date.js";

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/v1/sync/batch",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = syncBatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const userId = request.user.sub;
      let applied = 0;
      let duplicates = 0;

      for (const mut of parsed.data.mutations) {
        const already = await app.prisma.processedMutation.findUnique({
          where: { clientMutationId: mut.clientMutationId },
        });
        if (already) {
          duplicates += 1;
          continue;
        }

        const acc = await app.prisma.account.findFirst({
          where: { id: mut.payload.accountId, userId },
        });
        if (!acc) continue;

        await app.prisma.$transaction([
          app.prisma.processedMutation.create({
            data: { userId, clientMutationId: mut.clientMutationId },
          }),
          app.prisma.transaction.create({
            data: {
              userId,
              accountId: mut.payload.accountId,
              categoryId: mut.payload.categoryId ?? null,
              title: mut.payload.title,
              type: mut.payload.type,
              amountCents: mut.payload.amountCents,
              date: parseDateInput(mut.payload.date),
              status: mut.payload.status,
              tags: JSON.stringify(["offline-sync"]),
            },
          }),
        ]);
        applied += 1;
      }

      return reply.send({ applied, duplicates, syncedAt: new Date().toISOString() });
    }
  );
}
