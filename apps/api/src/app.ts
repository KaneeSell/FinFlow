import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { PrismaClient } from "@prisma/client";
import { ensureDatabaseSchema } from "./lib/db-bootstrap.js";
import { createPrismaClient } from "./lib/prisma.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerCategoryRoutes } from "./routes/categories.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerRecurringRoutes } from "./routes/recurring.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerCreditCardRoutes } from "./routes/credit-cards.js";
import { registerBudgetsGoalsRoutes } from "./routes/budgets-goals.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerRuleRoutes } from "./routes/rules.js";
import { registerForecastRoutes } from "./routes/forecast.js";
import { registerSyncRoutes } from "./routes/sync.js";
import { registerSecurityRoutes } from "./routes/security.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerInvestmentRoutes } from "./routes/investments.js";
import { registerWorkspaceRoutes } from "./routes/workspaces.js";
import { registerOpenFinanceRoutes } from "./routes/open-finance.js";
import { registerInsightRoutes } from "./routes/insights.js";
import { registerServerConfigRoutes } from "./routes/server-config.js";
import type { ServerRuntimeConfig } from "./lib/server-config.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; name: string };
    user: { sub: string; email: string; name: string };
  }
}

export interface BuildAppOptions {
  databaseUrl?: string;
  jwtSecret?: string;
  corsOrigin?: string;
  mode?: string;
  logger?: boolean;
  rateLimitMax?: number;
  runtimePort?: number;
  runtimeHost?: string;
  onPortChange?: (next: ServerRuntimeConfig) => void;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  const prisma = createPrismaClient(options.databaseUrl ?? process.env.DATABASE_URL);
  await ensureDatabaseSchema(prisma);
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  const corsOrigin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? "*";
  await app.register(cors, {
    origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim()),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: options.rateLimitMax ?? 300,
    timeWindow: "1 minute",
  });

  await app.register(jwt, {
    secret:
      options.jwtSecret ??
      process.env.JWT_SECRET ??
      "finflow-dev-secret-change-in-production-32chars",
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Token inválido ou ausente.",
      });
    }
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "FinFlow API",
        description: "API de finanças pessoais multiplataforma (Local-first ou Servidor Remoto)",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  const runtimePort = options.runtimePort ?? Number(process.env.PORT ?? 3333);
  const runtimeHost = options.runtimeHost ?? process.env.HOST ?? "0.0.0.0";

  app.get("/health", async () => ({
    status: "ok",
    service: "finflow-api",
    version: "0.1.0",
    mode: options.mode ?? process.env.FINFLOW_MODE ?? "local",
    port: runtimePort,
    timestamp: new Date().toISOString(),
  }));

  await registerAuthRoutes(app);
  await registerAccountRoutes(app);
  await registerCategoryRoutes(app);
  await registerTransactionRoutes(app);
  await registerRecurringRoutes(app);
  await registerDashboardRoutes(app);
  await registerCreditCardRoutes(app);
  await registerBudgetsGoalsRoutes(app);
  await registerIntegrationRoutes(app);
  await registerRuleRoutes(app);
  await registerForecastRoutes(app);
  await registerSyncRoutes(app);
  await registerSecurityRoutes(app);
  await registerWebhookRoutes(app);
  await registerInvestmentRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerOpenFinanceRoutes(app);
  await registerInsightRoutes(app);
  await registerServerConfigRoutes(app, {
    databaseUrl: options.databaseUrl,
    runtimePort,
    runtimeHost,
    onPortChange: options.onPortChange,
  });

  return app;
}
