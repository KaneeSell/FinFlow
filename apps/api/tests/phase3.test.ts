import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateTotpCode } from "../src/lib/totp.js";

describe("Phase 3 API Integration Tests", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let accessToken = "";
  let checkingId = "";
  let expenseCategoryId = "";

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-phase3-"));
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
      jwtSecret: "test-phase3-secret-32-chars-minimum",
      mode: "test",
      rateLimitMax: 1000,
    });
    await app.ready();

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "Fase3", email: "fase3@finflow.dev", password: "Password123" },
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
    expenseCategoryId = (cats.json() as Array<{ id: string; type: string }>).find(
      (c) => c.type === "EXPENSE"
    )!.id;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("auto-categorizes new transactions using active rules", async () => {
    const ruleRes = await app.inject({
      method: "POST",
      url: "/api/v1/rules",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Uber Auto",
        matchType: "CONTAINS",
        pattern: "uber",
        categoryId: expenseCategoryId,
        applyTags: ["mobilidade"],
        priority: 10,
      },
    });
    expect(ruleRes.statusCode).toBe(201);

    const txRes = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingId,
        title: "UBER *TRIP CENTRO",
        type: "EXPENSE",
        amountCents: 3250,
        date: "2026-11-25",
        status: "PAID",
      },
    });
    expect(txRes.statusCode).toBe(201);
    expect(txRes.json().categoryId).toBe(expenseCategoryId);
    expect(txRes.json().tags).toContain("mobilidade");
  });

  it("processes offline sync batch idempotently", async () => {
    const mutation = {
      clientMutationId: "mut-offline-001",
      type: "CREATE_TRANSACTION",
      payload: {
        accountId: checkingId,
        title: "Café Offline",
        type: "EXPENSE",
        amountCents: 1200,
        date: "2026-11-25",
        status: "PAID",
      },
    };

    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/sync/batch",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { mutations: [mutation] },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().applied).toBe(1);

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/sync/batch",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { mutations: [mutation] },
    });
    expect(res2.json().applied).toBe(0);
    expect(res2.json().duplicates).toBe(1);
  });

  it("returns 3/6/12-month cashflow forecast", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/recurring",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accountId: checkingId,
        title: "Aluguel Futuro",
        type: "EXPENSE",
        amountCents: 200000,
        frequency: "MONTHLY",
        startDate: new Date().toISOString().slice(0, 10),
      },
    });

    const fRes = await app.inject({
      method: "GET",
      url: "/api/v1/forecast?months=6",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(fRes.statusCode).toBe(200);
    expect(fRes.json().timeline).toHaveLength(6);
    expect(fRes.json().firstNegativeMonth).toBeTruthy();
  });

  it("configures 2FA TOTP, PIN lock, encrypted backup, and webhooks", async () => {
    const setupRes = await app.inject({
      method: "POST",
      url: "/api/v1/security/2fa/setup",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const { secret, otpauthUrl } = setupRes.json() as { secret: string; otpauthUrl: string };
    expect(otpauthUrl).toContain("otpauth://totp/");

    const code = generateTotpCode(secret);
    const enableRes = await app.inject({
      method: "POST",
      url: "/api/v1/security/2fa/enable",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code },
    });
    expect(enableRes.json().totpEnabled).toBe(true);

    // PIN
    await app.inject({
      method: "POST",
      url: "/api/v1/security/pin",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { pin: "2580" },
    });
    const pinVerify = await app.inject({
      method: "POST",
      url: "/api/v1/security/pin/verify",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { pin: "2580" },
    });
    expect(pinVerify.json().valid).toBe(true);

    // Encrypted backup round-trip
    const backupRes = await app.inject({
      method: "POST",
      url: "/api/v1/security/backup/export",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { passphrase: "MinhaSenhaSuperSecreta" },
    });
    expect(backupRes.statusCode).toBe(200);
    const restoreRes = await app.inject({
      method: "POST",
      url: "/api/v1/security/backup/restore",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { backup: backupRes.json(), passphrase: "MinhaSenhaSuperSecreta" },
    });
    expect(restoreRes.json().valid).toBe(true);

    // Webhook
    const hookRes = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Discord", provider: "DISCORD", url: "https://example.com/hook" },
    });
    expect(hookRes.statusCode).toBe(201);
  });
});
