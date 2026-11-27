import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Transactions API Full Coverage", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let tokenA = "";
  let tokenB = "";
  let checkingId = "";
  let walletId = "";
  let cardId = "";
  let expenseCatId = "";
  let incomeCatId = "";
  let createdTxId = "";

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-tx-test-"));
    const dbUrl = `file:${path.join(tempDir, "tx.db").replace(/\\/g, "/")}`;
    app = await buildApp({
      databaseUrl: dbUrl,
      jwtSecret: "test-jwt-secret-with-at-least-32-chars",
      mode: "test",
      rateLimitMax: 1000,
    });
    await app.ready();

    const regA = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "User A", email: "user-a@finflow.dev", password: "Password123" },
    });
    tokenA = regA.json().accessToken;

    const regB = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "User B", email: "user-b@finflow.dev", password: "Password123" },
    });
    tokenB = regB.json().accessToken;

    const accRes = await app.inject({
      method: "GET",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const accs = accRes.json() as Array<{ id: string; name: string }>;
    checkingId = accs.find((a) => a.name === "Conta Corrente")!.id;
    walletId = accs.find((a) => a.name === "Carteira")!.id;

    const cardRes = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: "Nubank",
        type: "CREDIT_CARD",
        creditLimitCents: 500000,
        closingDay: 10,
        dueDay: 17,
      },
    });
    cardId = cardRes.json().id;

    const catRes = await app.inject({
      method: "GET",
      url: "/api/v1/categories",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const cats = catRes.json() as Array<{ id: string; type: string }>;
    expenseCatId = cats.find((c) => c.type === "EXPENSE")!.id;
    incomeCatId = cats.find((c) => c.type === "INCOME")!.id;

    await app.inject({
      method: "POST",
      url: "/api/v1/rules",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: "Uber Rule",
        matchType: "CONTAINS",
        pattern: "UBER",
        categoryId: expenseCatId,
        applyTags: ["transporte"],
        priority: 10,
      },
    });
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("validates payload and rejects missing/same-account transfers", async () => {
    const emptyRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: checkingId,
        title: "Sem valor",
        type: "EXPENSE",
        amountCents: 0,
        date: "2026-11-27",
      },
    });
    expect(emptyRes.statusCode).toBe(400);

    const sameTransfer = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: checkingId,
        destinationAccountId: checkingId,
        title: "Mesma conta",
        type: "TRANSFER",
        amountCents: 5000,
        date: "2026-11-27",
      },
    });
    expect(sameTransfer.statusCode).toBe(400);
  });

  it("creates expense, income, transfer, and installments with auto-rules", async () => {
    const expRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: checkingId,
        title: "UBER VIAGEM",
        type: "EXPENSE",
        amountCents: 3500,
        date: "2026-11-27",
        status: "PAID",
        notes: "Centro",
      },
    });
    expect(expRes.statusCode).toBe(201);
    const exp = expRes.json();
    createdTxId = exp.id;
    expect(exp.categoryId).toBe(expenseCatId);
    expect(exp.tags).toContain("transporte");

    const incRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: checkingId,
        categoryId: incomeCatId,
        title: "Freela",
        type: "INCOME",
        amountCents: 100000,
        date: "2026-11-27",
        status: "PAID",
      },
    });
    expect(incRes.statusCode).toBe(201);

    const trfRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: checkingId,
        destinationAccountId: walletId,
        title: "Saque",
        type: "TRANSFER",
        amountCents: 20000,
        date: "2026-11-27",
        status: "PAID",
      },
    });
    expect(trfRes.statusCode).toBe(201);

    const instRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: cardId,
        title: "UBER PASS ANUAL",
        type: "EXPENSE",
        amountCents: 10000,
        date: "2026-11-05",
        status: "PAID",
        installments: 3,
      },
    });
    expect(instRes.statusCode).toBe(201);
    const firstInst = instRes.json();
    expect(firstInst.installmentNumber).toBe(1);
    expect(firstInst.installmentTotal).toBe(3);
    expect(firstInst.categoryId).toBe(expenseCatId);
    expect(firstInst.invoiceMonth).toBe("2026-11");
  });

  it("filters, exports CSV/JSON, imports without duplicates, updates, toggles status, and enforces isolation", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?month=2026-11&search=UBER",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().length).toBeGreaterThanOrEqual(2);

    const csvRes = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/export?format=csv",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.body).toContain("UBER VIAGEM");

    const jsonRes = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/export?format=json",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(jsonRes.statusCode).toBe(200);
    expect(jsonRes.json().transactions.length).toBeGreaterThanOrEqual(4);

    const importRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        accountId: checkingId,
        rows: [
          { date: "2026-11-27", title: "UBER VIAGEM", amountCents: 3500, type: "EXPENSE" },
          { date: "2026-11-26", title: "Padaria Importada", amountCents: 1850, type: "EXPENSE" },
        ],
      },
    });
    expect(importRes.statusCode).toBe(201);
    expect(importRes.json()).toEqual({ imported: 1, skipped: 1 });

    // Isolation: User B cannot patch/toggle/delete User A's transaction
    const forbiddenPatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${createdTxId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { title: "Hack" },
    });
    expect(forbiddenPatch.statusCode).toBe(404);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${createdTxId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: "UBER ATUALIZADO", amountCents: 4000 },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().title).toBe("UBER ATUALIZADO");

    const toggleRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${createdTxId}/toggle-status`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(toggleRes.statusCode).toBe(200);
    expect(toggleRes.json().status).toBe("PENDING");

    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${createdTxId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(delRes.statusCode).toBe(204);
  });
});
