import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../lib/auth.js";
import {
  decryptBackupJson,
  encryptBackupJson,
  type EncryptedBackupPayload,
} from "../lib/crypto-backup.js";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "../lib/totp.js";

export async function registerSecurityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/security/status",
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { totpEnabled: true, pinHash: true },
      });
      return {
        totpEnabled: Boolean(user?.totpEnabled),
        pinEnabled: Boolean(user?.pinHash),
      };
    }
  );

  app.post(
    "/api/v1/security/2fa/setup",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user) return reply.status(404).send({ error: "NotFound" });

      const secret = generateTotpSecret();
      await app.prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, totpEnabled: false },
      });

      return reply.send({
        secret,
        otpauthUrl: buildOtpAuthUri(user.email, secret),
      });
    }
  );

  app.post(
    "/api/v1/security/2fa/enable",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { code } = (request.body ?? {}) as { code?: string };
      const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user?.totpSecret) {
        return reply.status(400).send({ error: "BadRequest", message: "Execute o setup 2FA antes." });
      }

      if (!code || !verifyTotpCode(user.totpSecret, code)) {
        return reply.status(400).send({ error: "InvalidCode", message: "Código 2FA inválido." });
      }

      await app.prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true },
      });
      return reply.send({ totpEnabled: true });
    }
  );

  app.post(
    "/api/v1/security/2fa/disable",
    { preHandler: [app.authenticate] },
    async (request) => {
      await app.prisma.user.update({
        where: { id: request.user.sub },
        data: { totpEnabled: false, totpSecret: null },
      });
      return { totpEnabled: false };
    }
  );

  app.post(
    "/api/v1/security/pin",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { pin } = (request.body ?? {}) as { pin?: string };
      if (!pin || !/^\d{4,8}$/.test(pin)) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "PIN deve ter de 4 a 8 dígitos.",
        });
      }
      const pinHash = await hashPassword(pin);
      await app.prisma.user.update({
        where: { id: request.user.sub },
        data: { pinHash },
      });
      return reply.send({ pinEnabled: true });
    }
  );

  app.post(
    "/api/v1/security/pin/verify",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { pin } = (request.body ?? {}) as { pin?: string };
      const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user?.pinHash || !pin) {
        return reply.send({ valid: false });
      }
      const valid = await verifyPassword(pin, user.pinHash);
      return reply.send({ valid });
    }
  );

  app.post(
    "/api/v1/security/backup/export",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { passphrase } = (request.body ?? {}) as { passphrase?: string };
      if (!passphrase || passphrase.length < 6) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Senha do backup deve ter ao menos 6 caracteres.",
        });
      }

      const userId = request.user.sub;
      const [accounts, categories, transactions, recurringRules, goals] = await Promise.all([
        app.prisma.account.findMany({ where: { userId } }),
        app.prisma.category.findMany({ where: { userId } }),
        app.prisma.transaction.findMany({ where: { userId } }),
        app.prisma.recurringRule.findMany({ where: { userId } }),
        app.prisma.goal.findMany({ where: { userId } }),
      ]);

      const encrypted = encryptBackupJson(
        { exportedAt: new Date().toISOString(), accounts, categories, transactions, recurringRules, goals },
        passphrase
      );
      return reply.send(encrypted);
    }
  );

  app.post(
    "/api/v1/security/backup/restore",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { backup, passphrase } = (request.body ?? {}) as {
        backup?: EncryptedBackupPayload;
        passphrase?: string;
      };
      if (!backup || !passphrase) {
        return reply.status(400).send({ error: "ValidationError", message: "Backup e senha obrigatórios." });
      }

      try {
        const decoded = decryptBackupJson<{
          exportedAt: string;
          accounts: unknown[];
          transactions: unknown[];
        }>(backup, passphrase);
        return reply.send({
          valid: true,
          exportedAt: decoded.exportedAt,
          accountsCount: decoded.accounts?.length ?? 0,
          transactionsCount: decoded.transactions?.length ?? 0,
        });
      } catch {
        return reply.status(400).send({
          error: "DecryptionFailed",
          message: "Senha incorreta ou arquivo de backup corrompido.",
        });
      }
    }
  );
}
