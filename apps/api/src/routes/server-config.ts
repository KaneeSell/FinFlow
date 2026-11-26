import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  checkPortAvailable,
  saveServerConfig,
  type ServerRuntimeConfig,
} from "../lib/server-config.js";

const updateServerConfigSchema = z.object({
  port: z.number().int().min(1024, "Porta mínima é 1024").max(65535, "Porta máxima é 65535"),
  host: z.string().trim().min(1).optional(),
});

export interface ServerConfigRouteOptions {
  databaseUrl?: string;
  runtimePort: number;
  runtimeHost: string;
  onPortChange?: (next: ServerRuntimeConfig) => void;
}

export async function registerServerConfigRoutes(
  app: FastifyInstance,
  options: ServerConfigRouteOptions
): Promise<void> {
  app.get(
    "/api/v1/server/config",
    { preHandler: [app.authenticate] },
    async () => ({
      port: options.runtimePort,
      host: options.runtimeHost,
    })
  );

  app.get(
    "/api/v1/server/check-port",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = request.query as { port?: string };
      const port = Number(query.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Porta inválida. Informe um número entre 1024 e 65535.",
        });
      }

      if (port === options.runtimePort) {
        return { port, available: true, inUseByFinFlow: true };
      }

      const available = await checkPortAvailable(port, options.runtimeHost);
      return { port, available, inUseByFinFlow: false };
    }
  );

  app.put(
    "/api/v1/server/config",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = updateServerConfigSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Configuração inválida",
        });
      }

      const nextPort = parsed.data.port;
      const nextHost = parsed.data.host ?? options.runtimeHost;

      if (nextPort !== options.runtimePort) {
        const available = await checkPortAvailable(nextPort, nextHost);
        if (!available) {
          return reply.status(409).send({
            error: "Conflict",
            message: `A porta ${nextPort} já está em uso por outro aplicativo.`,
          });
        }
      }

      saveServerConfig({ port: nextPort, host: nextHost }, options.databaseUrl);

      const restarting = nextPort !== options.runtimePort && Boolean(options.onPortChange);
      if (restarting && options.onPortChange) {
        setTimeout(() => {
          options.onPortChange?.({ port: nextPort, host: nextHost });
        }, 150);
      }

      return reply.send({
        ok: true,
        port: nextPort,
        host: nextHost,
        restarting,
      });
    }
  );
}
