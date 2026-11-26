import type { FastifyInstance } from "fastify";
import {
  applyAutoRules,
  createAutoRuleSchema,
  updateAutoRuleSchema,
  type RuleMatchType,
} from "@finflow/shared";

function serializeRule(r: {
  id: string;
  name: string;
  matchType: string;
  pattern: string;
  categoryId: string;
  applyTags: string;
  isActive: boolean;
  priority: number;
  category?: { id: string; name: string; color: string } | null;
}) {
  let tags: string[] = [];
  try {
    tags = JSON.parse(r.applyTags) as string[];
  } catch {
    tags = [];
  }
  return {
    id: r.id,
    name: r.name,
    matchType: r.matchType,
    pattern: r.pattern,
    categoryId: r.categoryId,
    applyTags: tags,
    isActive: r.isActive,
    priority: r.priority,
    category: r.category ?? null,
  };
}

export async function registerRuleRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/rules",
    { preHandler: [app.authenticate] },
    async (request) => {
      const rules = await app.prisma.autoRule.findMany({
        where: { userId: request.user.sub },
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
      return rules.map(serializeRule);
    }
  );

  app.post(
    "/api/v1/rules",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createAutoRuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const created = await app.prisma.autoRule.create({
        data: {
          userId: request.user.sub,
          name: parsed.data.name,
          matchType: parsed.data.matchType,
          pattern: parsed.data.pattern,
          categoryId: parsed.data.categoryId,
          applyTags: JSON.stringify(parsed.data.applyTags),
          priority: parsed.data.priority,
        },
        include: { category: { select: { id: true, name: true, color: true } } },
      });

      return reply.status(201).send(serializeRule(created));
    }
  );

  app.patch(
    "/api/v1/rules/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateAutoRuleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const existing = await app.prisma.autoRule.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Regra não encontrada" });
      }

      const updated = await app.prisma.autoRule.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.matchType !== undefined && { matchType: parsed.data.matchType }),
          ...(parsed.data.pattern !== undefined && { pattern: parsed.data.pattern }),
          ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
          ...(parsed.data.applyTags !== undefined && {
            applyTags: JSON.stringify(parsed.data.applyTags),
          }),
          ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        },
        include: { category: { select: { id: true, name: true, color: true } } },
      });

      return reply.send(serializeRule(updated));
    }
  );

  app.post(
    "/api/v1/rules/test",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { title } = (request.body ?? {}) as { title?: string };
      const rules = await app.prisma.autoRule.findMany({
        where: { userId: request.user.sub, isActive: true },
      });
      const match = applyAutoRules(
        title ?? "",
        rules.map((r) => ({
          matchType: r.matchType as RuleMatchType,
          pattern: r.pattern,
          categoryId: r.categoryId,
          applyTags: JSON.parse(r.applyTags) as string[],
          isActive: r.isActive,
          priority: r.priority,
        }))
      );
      return match;
    }
  );

  app.delete(
    "/api/v1/rules/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await app.prisma.autoRule.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!existing) {
        return reply.status(404).send({ error: "NotFound", message: "Regra não encontrada" });
      }
      await app.prisma.autoRule.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
