import type { FastifyInstance } from "fastify";
import {
  addWorkspaceMemberSchema,
  calculateSplitBalances,
  createSharedExpenseSchema,
  createWorkspaceSchema,
  splitInstallmentsCents,
} from "@finflow/shared";
import { parseDateInput } from "../lib/date.js";

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/workspaces",
    { preHandler: [app.authenticate] },
    async (request) => {
      const list = await app.prisma.workspace.findMany({
        where: { ownerId: request.user.sub },
        include: { members: true },
        orderBy: { createdAt: "asc" },
      });
      return list;
    }
  );

  app.post(
    "/api/v1/workspaces",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createWorkspaceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const ws = await app.prisma.workspace.create({
        data: {
          name: parsed.data.name,
          type: parsed.data.type,
          ownerId: request.user.sub,
          members: {
            create: {
              memberName: request.user.name || "Você",
              memberEmail: request.user.email,
              role: "OWNER",
            },
          },
        },
        include: { members: true },
      });

      return reply.status(201).send(ws);
    }
  );

  app.post(
    "/api/v1/workspaces/:id/members",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = addWorkspaceMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "ValidationError", message: "Dados inválidos" });
      }

      const ws = await app.prisma.workspace.findFirst({
        where: { id, ownerId: request.user.sub },
      });
      if (!ws) return reply.status(404).send({ error: "NotFound" });

      const member = await app.prisma.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          memberName: parsed.data.memberName,
          memberEmail: parsed.data.memberEmail || null,
        },
      });
      return reply.status(201).send(member);
    }
  );

  app.get(
    "/api/v1/workspaces/:id/expenses",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ws = await app.prisma.workspace.findFirst({
        where: { id, ownerId: request.user.sub },
      });
      if (!ws) return reply.status(404).send({ error: "NotFound" });

      const expenses = await app.prisma.sharedExpense.findMany({
        where: { workspaceId: ws.id },
        orderBy: { date: "desc" },
      });

      const formatted = expenses.map((e) => ({
        id: e.id,
        workspaceId: e.workspaceId,
        paidByName: e.paidByName,
        title: e.title,
        totalAmountCents: e.totalAmountCents,
        splits: JSON.parse(e.splitsJson) as Array<{ memberName: string; shareCents: number }>,
        settled: e.settled,
        date: e.date.toISOString(),
      }));

      return {
        expenses: formatted,
        balances: calculateSplitBalances(formatted),
      };
    }
  );

  app.post(
    "/api/v1/workspaces/:id/expenses",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = createSharedExpenseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }

      const ws = await app.prisma.workspace.findFirst({
        where: { id, ownerId: request.user.sub },
      });
      if (!ws) return reply.status(404).send({ error: "NotFound" });

      const parts = splitInstallmentsCents(
        parsed.data.totalAmountCents,
        parsed.data.participants.length
      );
      const splits = parsed.data.participants.map((memberName, idx) => ({
        memberName,
        shareCents: parts[idx] ?? 0,
      }));

      const created = await app.prisma.sharedExpense.create({
        data: {
          workspaceId: ws.id,
          paidByName: parsed.data.paidByName,
          title: parsed.data.title,
          totalAmountCents: parsed.data.totalAmountCents,
          splitsJson: JSON.stringify(splits),
          date: parseDateInput(parsed.data.date),
        },
      });

      return reply.status(201).send({
        id: created.id,
        workspaceId: created.workspaceId,
        paidByName: created.paidByName,
        title: created.title,
        totalAmountCents: created.totalAmountCents,
        splits,
        settled: created.settled,
        date: created.date.toISOString(),
      });
    }
  );

  app.patch(
    "/api/v1/workspaces/:id/expenses/:expenseId/settle",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, expenseId } = request.params as { id: string; expenseId: string };
      const ws = await app.prisma.workspace.findFirst({
        where: { id, ownerId: request.user.sub },
      });
      if (!ws) return reply.status(404).send({ error: "NotFound" });

      const updated = await app.prisma.sharedExpense.update({
        where: { id: expenseId },
        data: { settled: true },
      });
      return reply.send({ id: updated.id, settled: updated.settled });
    }
  );
}
