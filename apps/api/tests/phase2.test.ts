import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Phase 2 API Integration Tests", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let accessToken = "";
  let checkingId = "";
  let cardId = "";
  let expenseCategoryId = "";

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-phase2-"));
    const dbPath = path.join(tempDir, "test.db").replace(/\\/g, "/");
    const dbUrl = `file:${dbPath}`;

    execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, DATABASE_URL: dbUrl },
      shell: process.platform === "win32",
      stdio: "pipe",
    });

    app = await buildApp({
      databaseUrl: dbUrl,
      jwtSecret: "test-phase2-secret-32-chars-minimum",
      mode: "test",
      rateLimitMax: 1000,
    });
    await app.ready();

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "Fase2", email: "fase2@finflow.dev", password: "Password123" },
    });
    accessToken = reg.json().accessToken;

    const accs = await app.inject({
      method: "GET",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    checkingId = accs.json()[0].id;

    const cats = await app.inject({
      method: "GET",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const expCat = (cats.json() as Array<{ id: string; type: string }>).find(
      (c) => c.type === "EXPENSE"
    )!;
    expenseCategoryId = expCat.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates a credit card, splits installments across invoices, and pays an invoice", async () => {
    const cardRes = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Nubank Ultravioleta",
        type: "CREDIT_CARD",
        creditLimitCents: 1000000,
        closingDay: 10,
        dueDay: 17,
      },
    });
    expect(cardRes.statusCode).toBe(201);
    cardId = cardRes.json().id;

    // Purchase on 2026-11-15 (after closingDay 10 -> first installment in 2026-12 invoice)
    const txRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: cardId,
        categoryId: expenseCategoryId,
        title: "Notebook",
        type: "EXPENSE",
        amountCents: 300000,
        date: "2026-11-15",
        status: "PENDING",
        installments: 3,
      },
    });
    expect(txRes.statusCode).toBe(201);
    expect(txRes.json().invoiceMonth).toBe("2026-12");
    expect(txRes.json().title).toBe("Notebook (1/3)");

    const invRes = await app.inject({
      method: "GET",
      url: "/api/v1/credit-cards/invoices?month=2026-12",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(invRes.statusCode).toBe(200);
    const invoices = invRes.json() as Array<{
      accountId: string;
      invoiceTotalCents: number;
      availableLimitCents: number;
    }>;
    const cardInv = invoices.find((i) => i.accountId === cardId)!;
    expect(cardInv.invoiceTotalCents).toBe(100000);
    expect(cardInv.availableLimitCents).toBe(700000);

    const payRes = await app.inject({
      method: "POST",
      url: `/api/v1/credit-cards/${cardId}/pay-invoice`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { month: "2026-12", sourceAccountId: checkingId },
    });
    expect(payRes.statusCode).toBe(200);
    expect(payRes.json().paidCents).toBe(100000);
  });

  it("calculates category budget alerts and manages goals", async () => {
    const newCatRes = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Orçamento Teste",
        type: "EXPENSE",
        budgetLimitCents: 100000,
      },
    });
    const budgetCatId = newCatRes.json().id;

    await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingId,
        categoryId: budgetCatId,
        title: "Compra Grande",
        type: "EXPENSE",
        amountCents: 85000,
        date: "2026-11-10",
        status: "PAID",
      },
    });

    const bRes = await app.inject({
      method: "GET",
      url: "/api/v1/budgets?month=2026-11",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(bRes.statusCode).toBe(200);
    const budget = (bRes.json() as Array<{ categoryId: string; alertLevel: string }>).find(
      (b) => b.categoryId === budgetCatId
    )!;
    expect(budget.alertLevel).toBe("warning");

    // Goals
    const gRes = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Reserva de Emergência", targetAmountCents: 1000000 },
    });
    expect(gRes.statusCode).toBe(201);
    const goalId = gRes.json().id;

    const cRes = await app.inject({
      method: "POST",
      url: `/api/v1/goals/${goalId}/contribute`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { amountCents: 250000 },
    });
    expect(cRes.statusCode).toBe(200);
    expect(cRes.json().percent).toBe(25);
  });

  it("imports statements skipping duplicates and exports CSV", async () => {
    const imp1 = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingId,
        rows: [
          { date: "2026-11-02", title: "Padaria", amountCents: 2500, type: "EXPENSE" },
          { date: "2026-11-03", title: "Freela", amountCents: 80000, type: "INCOME" },
        ],
      },
    });
    expect(imp1.statusCode).toBe(201);
    expect(imp1.json()).toEqual({ imported: 2, skipped: 0 });

    const imp2 = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingId,
        rows: [{ date: "2026-11-02", title: "Padaria", amountCents: 2500, type: "EXPENSE" }],
      },
    });
    expect(imp2.json()).toEqual({ imported: 0, skipped: 1 });

    const expRes = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/export?format=csv",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(expRes.statusCode).toBe(200);
    expect(expRes.body).toContain("Padaria");
  });

  it("serves external financial indicators with fallback resilience", async () => {
    const [rates, bcb, holidays] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/integrations/rates",
        headers: { authorization: `Bearer ${accessToken}` },
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/integrations/bcb",
        headers: { authorization: `Bearer ${accessToken}` },
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/integrations/holidays/2026",
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    ]);

    expect(rates.statusCode).toBe(200);
    expect(rates.json().rates.usdBrl).toBeGreaterThan(0);
    expect(bcb.statusCode).toBe(200);
    expect(bcb.json().selicPercent).toBeGreaterThan(0);
    expect(holidays.statusCode).toBe(200);
    expect(holidays.json().holidays.length).toBeGreaterThan(0);
  });
});
