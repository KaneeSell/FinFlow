import type { FastifyInstance } from "fastify";
import { createCategorySchema, updateCategorySchema } from "@finflow/shared";

export async function registerCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/categories",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { type } = request.query as { type?: string };
      const categories = await app.prisma.category.findMany({
        where: {
          userId: request.user.sub,
          ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });

      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        budgetLimitCents: cat.budgetLimitCents,
      }));
    }
  );

  app.post(
    "/api/v1/categories",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const cat = await app.prisma.category.create({
        data: {
          userId: request.user.sub,
          name: parsed.data.name,
          type: parsed.data.type,
          color: parsed.data.color,
          icon: parsed.data.icon,
          budgetLimitCents: parsed.data.budgetLimitCents ?? null,
        },
      });

      return reply.status(201).send({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        budgetLimitCents: cat.budgetLimitCents,
      });
    }
  );

  app.patch(
    "/api/v1/categories/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.category.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Categoria não encontrada" });
      }

      const updated = await app.prisma.category.update({
        where: { id },
        data: parsed.data,
      });

      return reply.send({
        id: updated.id,
        name: updated.name,
        type: updated.type,
        color: updated.color,
        icon: updated.icon,
        budgetLimitCents: updated.budgetLimitCents,
      });
    }
  );

  app.delete(
    "/api/v1/categories/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.category.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Categoria não encontrada" });
      }

      await app.prisma.category.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
