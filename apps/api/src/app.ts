import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./lib/prisma.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerCategoryRoutes } from "./routes/categories.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerRecurringRoutes } from "./routes/recurring.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";

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
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  const prisma = createPrismaClient(options.databaseUrl ?? process.env.DATABASE_URL);
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

  app.get("/health", async () => ({
    status: "ok",
    service: "finflow-api",
    version: "0.1.0",
    mode: options.mode ?? process.env.FINFLOW_MODE ?? "local",
    timestamp: new Date().toISOString(),
  }));

  await registerAuthRoutes(app);
  await registerAccountRoutes(app);
  await registerCategoryRoutes(app);
  await registerTransactionRoutes(app);
  await registerRecurringRoutes(app);
  await registerDashboardRoutes(app);

  return app;
}
