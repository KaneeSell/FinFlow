import type { FastifyInstance } from "fastify";
import { loginSchema, refreshSchema, registerSchema } from "@finflow/shared";
import {
  generateRefreshTokenRaw,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../lib/auth.js";
import { seedDefaultUserData } from "../lib/defaults.js";

const REFRESH_TTL_DAYS = 7;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const issueTokens = async (user: { id: string; email: string; name: string }) => {
    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      { expiresIn: "15m" }
    );
    const refreshToken = generateRefreshTokenRaw();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await app.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  };

  app.post("/api/v1/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        issues: parsed.error.issues,
      });
    }

    const existing = await app.prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return reply.status(409).send({
        error: "Conflict",
        message: "Este e-mail já está cadastrado.",
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await app.prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        currency: parsed.data.currency,
      },
    });

    await seedDefaultUserData(app.prisma, user.id);
    const tokens = await issueTokens(user);

    return reply.status(201).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        createdAt: user.createdAt.toISOString(),
      },
      ...tokens,
    });
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: parsed.error.issues[0]?.message ?? "Dados inválidos",
      });
    }

    const user = await app.prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "E-mail ou senha inválidos.",
      });
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "E-mail ou senha inválidos.",
      });
    }

    const tokens = await issueTokens(user);
    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        createdAt: user.createdAt.toISOString(),
      },
      ...tokens,
    });
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Refresh token inválido",
      });
    }

    const tokenHash = hashToken(parsed.data.refreshToken);
    const record = await app.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Sessão expirada. Faça login novamente.",
      });
    }

    // Rotate refresh token
    await app.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokens(record.user);
    return reply.send(tokens);
  });

  app.post(
    "/api/v1/auth/logout",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as { refreshToken?: string } | undefined;
      if (body?.refreshToken) {
        await app.prisma.refreshToken.updateMany({
          where: {
            tokenHash: hashToken(body.refreshToken),
            userId: request.user.sub,
          },
          data: { revokedAt: new Date() },
        });
      }
      return reply.send({ ok: true });
    }
  );

  app.get(
    "/api/v1/auth/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.user.sub },
      });
      if (!user) {
        return reply.status(404).send({ error: "NotFound", message: "Usuário não encontrado" });
      }
      return reply.send({
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        createdAt: user.createdAt.toISOString(),
      });
    }
  );
}
