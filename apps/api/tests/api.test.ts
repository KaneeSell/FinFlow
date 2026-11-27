import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("FinFlow API Integration Tests", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let dbPath: string;
  let accessToken = "";
  let refreshToken = "";
  let checkingAccountId = "";
  let walletAccountId = "";
  let expenseCategoryId = "";
  let incomeCategoryId = "";

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-api-test-"));
    dbPath = path.join(tempDir, "test.db");
    const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

    execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      shell: process.platform === "win32",
      stdio: "pipe",
    });

    app = await buildApp({
      databaseUrl: dbUrl,
      jwtSecret: "test-jwt-secret-with-at-least-32-chars",
      mode: "test",
      rateLimitMax: 1000,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("exposes /health without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("finflow-api");
  });

  it("allows PATCH, PUT, and DELETE in CORS preflight", async () => {
    for (const method of ["PATCH", "PUT", "DELETE"]) {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/accounts/acc-1",
        headers: {
          origin: "http://127.0.0.1:4173",
          "access-control-request-method": method,
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers["access-control-allow-methods"]).toContain(method);
    }
  });

  it("blocks protected routes when unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/accounts" });
    expect(res.statusCode).toBe(401);
  });

  it("registers a user, seeds default accounts & categories, and returns tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Daniel Teste",
        email: "daniel@finflow.dev",
        password: "Password123",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe("daniel@finflow.dev");
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it("rotates refresh token cleanly", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).not.toBe(refreshToken);
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it("lists seeded accounts and categories", async () => {
    const accRes = await app.inject({
      method: "GET",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(accRes.statusCode).toBe(200);
    const accounts = accRes.json() as Array<{ id: string; name: string }>;
    expect(accounts.length).toBeGreaterThanOrEqual(2);
    checkingAccountId = accounts.find((a) => a.name === "Conta Corrente")!.id;
    walletAccountId = accounts.find((a) => a.name === "Carteira")!.id;

    const catRes = await app.inject({
      method: "GET",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(catRes.statusCode).toBe(200);
    const categories = catRes.json() as Array<{ id: string; type: string }>;
    incomeCategoryId = categories.find((c) => c.type === "INCOME")!.id;
    expenseCategoryId = categories.find((c) => c.type === "EXPENSE")!.id;
  });

  it("creates income, expense, transfer and updates account balances accurately", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Income +5000.00 in Checking
    const incRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingAccountId,
        categoryId: incomeCategoryId,
        title: "Salário Mensal",
        type: "INCOME",
        amountCents: 500000,
        date: today,
        status: "PAID",
      },
    });
    expect(incRes.statusCode).toBe(201);

    // Expense -1200.50 in Checking
    const expRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingAccountId,
        categoryId: expenseCategoryId,
        title: "Aluguel",
        type: "EXPENSE",
        amountCents: 120050,
        date: today,
        status: "PAID",
      },
    });
    expect(expRes.statusCode).toBe(201);

    // Transfer 300.00 from Checking -> Wallet
    const trRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingAccountId,
        destinationAccountId: walletAccountId,
        title: "Saque para Carteira",
        type: "TRANSFER",
        amountCents: 30000,
        date: today,
        status: "PAID",
      },
    });
    expect(trRes.statusCode).toBe(201);

    const accRes = await app.inject({
      method: "GET",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const accounts = accRes.json() as Array<{ id: string; currentBalanceCents: number }>;
    const checking = accounts.find((a) => a.id === checkingAccountId)!;
    const wallet = accounts.find((a) => a.id === walletAccountId)!;

    // 500000 - 120050 - 30000 = 349950
    expect(checking.currentBalanceCents).toBe(349950);
    expect(wallet.currentBalanceCents).toBe(30000);
  });

  it("creates and materializes a recurring rule", async () => {
    const ruleRes = await app.inject({
      method: "POST",
      url: "/api/v1/recurring",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingAccountId,
        categoryId: expenseCategoryId,
        title: "Internet Fibra",
        type: "EXPENSE",
        amountCents: 12990,
        frequency: "MONTHLY",
        dayOfMonth: 10,
        startDate: "2026-11-10",
      },
    });
    expect(ruleRes.statusCode).toBe(201);
    const rule = ruleRes.json() as { id: string; nextRunDate: string };

    const matRes = await app.inject({
      method: "POST",
      url: `/api/v1/recurring/${rule.id}/materialize`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: "PAID" },
    });
    expect(matRes.statusCode).toBe(201);
    const matBody = matRes.json() as {
      transaction: { title: string; amountCents: number };
      rule: { nextRunDate: string };
    };
    expect(matBody.transaction.title).toBe("Internet Fibra");
    expect(matBody.transaction.amountCents).toBe(12990);
    expect(matBody.rule.nextRunDate.slice(0, 10)).toBe("2026-12-10");
  });

  it("returns accurate dashboard summary", async () => {
    const month = new Date().toISOString().slice(0, 7);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/summary?month=${month}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const summary = res.json();
    expect(summary.monthlyIncomeCents).toBe(500000);
    expect(summary.monthlyExpenseCents).toBeGreaterThanOrEqual(120050);
    expect(summary.cashflowHistory).toHaveLength(6);
  });

  it("creates MEAL_VOUCHER account, posts reload and grocery expense, and computes balance", async () => {
    const accRes = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Alelo Alimentação",
        type: "MEAL_VOUCHER",
        initialBalanceCents: 10000,
        creditLimitCents: 80000,
        dueDay: 1,
      },
    });
    expect(accRes.statusCode).toBe(201);
    const vaId = accRes.json().id as string;

    const today = new Date().toISOString().slice(0, 10);
    await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: vaId,
        title: "Recarga Alelo",
        type: "INCOME",
        amountCents: 80000,
        date: today,
        status: "PAID",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: vaId,
        title: "Supermercado",
        type: "EXPENSE",
        amountCents: 25000,
        date: today,
        status: "PAID",
      },
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const va = (listRes.json() as Array<{ id: string; type: string; currentBalanceCents: number }>).find(
      (a) => a.id === vaId
    );
    expect(va?.type).toBe("MEAL_VOUCHER");
    expect(va?.currentBalanceCents).toBe(65000);
  });
});
