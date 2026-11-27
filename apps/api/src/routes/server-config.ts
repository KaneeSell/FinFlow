import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import {
  updateServerAdminConfigSchema,
  type ServerAdminConfig,
  type ServerStatusDTO,
} from "@finflow/shared";
import {
  checkPortAvailable,
  createServerBackup,
  getLanUrls,
  listServerBackups,
  resolveDbFilePath,
  saveServerConfig,
} from "../lib/server-config.js";

export interface ServerConfigRouteOptions {
  databaseUrl?: string;
  mode?: string;
  onPortChange?: (next: ServerAdminConfig) => void;
}

export async function registerServerConfigRoutes(
  app: FastifyInstance,
  options: ServerConfigRouteOptions
): Promise<void> {
  app.get(
    "/api/v1/server/config",
    { preHandler: [app.authenticate] },
    async () => app.serverConfig
  );

  app.get(
    "/api/v1/server/status",
    { preHandler: [app.authenticate] },
    async (): Promise<ServerStatusDTO> => {
      const dbFile = resolveDbFilePath(options.databaseUrl);
      const dbSizeBytes = dbFile && fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
      const mem = process.memoryUsage();
      const now = new Date();

      const [users, accounts, categories, transactions, recurringRules, activeSessions] =
        await Promise.all([
          app.prisma.user.count(),
          app.prisma.account.count(),
          app.prisma.category.count(),
          app.prisma.transaction.count(),
          app.prisma.recurringRule.count(),
          app.prisma.refreshToken.count({
            where: { revokedAt: null, expiresAt: { gt: now } },
          }),
        ]);

      return {
        status: "ok",
        mode: options.mode ?? process.env.FINFLOW_MODE ?? "local",
        version: "0.1.0",
        nodeVersion: process.version,
        platform: `${process.platform} (${process.arch})`,
        pid: process.pid,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        memoryHeapMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        port: app.serverConfig.port,
        host: app.serverConfig.host,
        lanUrls: getLanUrls(app.serverConfig.port),
        dbPath: dbFile ?? ":memory:",
        dbSizeBytes,
        counts: {
          users,
          accounts,
          categories,
          transactions,
          recurringRules,
          activeSessions,
        },
        backups: listServerBackups(dbFile),
      };
    }
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

      if (port === app.serverConfig.port) {
        return { port, available: true, inUseByFinFlow: true };
      }

      const available = await checkPortAvailable(port, app.serverConfig.host);
      return { port, available, inUseByFinFlow: false };
    }
  );

  app.put(
    "/api/v1/server/config",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = updateServerAdminConfigSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Configuração inválida",
        });
      }

      const prev = app.serverConfig;
      const nextConfig: ServerAdminConfig = {
        ...prev,
        ...parsed.data,
      };

      if (nextConfig.port !== prev.port) {
        const available = await checkPortAvailable(nextConfig.port, nextConfig.host);
        if (!available) {
          return reply.status(409).send({
            error: "Conflict",
            message: `A porta ${nextConfig.port} já está em uso por outro aplicativo.`,
          });
        }
      }

      saveServerConfig(nextConfig, options.databaseUrl);
      app.serverConfig = nextConfig;

      const needsRebind =
        nextConfig.port !== prev.port ||
        nextConfig.host !== prev.host ||
        nextConfig.corsOrigin !== prev.corsOrigin ||
        nextConfig.rateLimitMax !== prev.rateLimitMax ||
        nextConfig.enableSwagger !== prev.enableSwagger;

      const restarting = needsRebind && Boolean(options.onPortChange);
      if (restarting && options.onPortChange) {
        setTimeout(() => {
          options.onPortChange?.(nextConfig);
        }, 150);
      }

      return reply.send({
        ok: true,
        ...nextConfig,
        restarting,
      });
    }
  );

  app.post(
    "/api/v1/server/maintenance/vacuum",
    { preHandler: [app.authenticate] },
    async () => {
      const dbFile = resolveDbFilePath(options.databaseUrl);
      const beforeBytes = dbFile && fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;

      await app.prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
      await app.prisma.$executeRawUnsafe("VACUUM;");

      const afterBytes = dbFile && fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
      return { ok: true, beforeBytes, afterBytes };
    }
  );

  app.post(
    "/api/v1/server/backup",
    { preHandler: [app.authenticate] },
    async (_request, reply) => {
      const dbFile = resolveDbFilePath(options.databaseUrl);
      await app.prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(PASSIVE);");
      const backup = createServerBackup(dbFile, app.serverConfig.autoBackupRetention);
      if (!backup) {
        return reply.status(400).send({
          error: "BackupUnavailable",
          message: "Backup em arquivo disponível apenas para bancos SQLite em disco.",
        });
      }
      return {
        ok: true,
        backup,
        backups: listServerBackups(dbFile),
      };
    }
  );

  app.post(
    "/api/v1/server/sessions/revoke-expired",
    { preHandler: [app.authenticate] },
    async () => {
      const result = await app.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
        },
      });
      return { ok: true, deleted: result.count };
    }
  );

  app.post(
    "/api/v1/server/restart",
    { preHandler: [app.authenticate] },
    async () => {
      const restarting = Boolean(options.onPortChange);
      if (restarting && options.onPortChange) {
        setTimeout(() => {
          options.onPortChange?.(app.serverConfig);
        }, 150);
      }
      return { ok: true, restarting };
    }
  );
}
