import type { FastifyInstance } from "fastify";
import { createWebhookSchema } from "@finflow/shared";

function serializeWebhook(w: {
  id: string;
  name: string;
  provider: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: w.id,
    name: w.name,
    provider: w.provider,
    url: w.url,
    events: JSON.parse(w.events) as string[],
    isActive: w.isActive,
    createdAt: w.createdAt.toISOString(),
  };
}

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/webhooks",
    { preHandler: [app.authenticate] },
    async (request) => {
      const list = await app.prisma.webhookConfig.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: "asc" },
      });
      return list.map(serializeWebhook);
    }
  );

  app.post(
    "/api/v1/webhooks",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createWebhookSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const created = await app.prisma.webhookConfig.create({
        data: {
          userId: request.user.sub,
          name: parsed.data.name,
          provider: parsed.data.provider,
          url: parsed.data.url,
          events: JSON.stringify(parsed.data.events),
        },
      });
      return reply.status(201).send(serializeWebhook(created));
    }
  );

  app.post(
    "/api/v1/webhooks/:id/test",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const hook = await app.prisma.webhookConfig.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!hook) {
        return reply.status(404).send({ error: "NotFound", message: "Webhook não encontrado" });
      }

      const text = "FinFlow: Notificação de teste enviada com sucesso!";
      const body =
        hook.provider === "DISCORD"
          ? JSON.stringify({ content: text })
          : hook.provider === "TELEGRAM"
            ? JSON.stringify({ text })
            : JSON.stringify({ event: "TEST", message: text, timestamp: new Date().toISOString() });

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(hook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: hook.provider === "NTFY" ? text : body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return reply.send({ delivered: res.ok, status: res.status });
      } catch (err) {
        return reply.send({
          delivered: false,
          error: err instanceof Error ? err.message : "Falha ao enviar",
        });
      }
    }
  );

  app.delete(
    "/api/v1/webhooks/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const hook = await app.prisma.webhookConfig.findFirst({
        where: { id, userId: request.user.sub },
      });
      if (!hook) {
        return reply.status(404).send({ error: "NotFound", message: "Webhook não encontrado" });
      }
      await app.prisma.webhookConfig.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
