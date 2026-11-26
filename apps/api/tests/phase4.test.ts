import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Phase 4 API Integration Tests", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let accessToken = "";

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-phase4-"));
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
      jwtSecret: "test-phase4-secret-32-chars-minimum",
      mode: "test",
      rateLimitMax: 1000,
    });
    await app.ready();

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { name: "Daniel", email: "fase4@finflow.dev", password: "Password123" },
    });
    accessToken = reg.json().accessToken;
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("manages investments and computes Net Worth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/investments",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        symbol: "ITSA4",
        name: "Itaúsa",
        assetClass: "STOCK",
        quantity: 100,
        avgPriceCents: 900,
        currentPriceCents: 1050,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().totalCurrentCents).toBe(105000);

    const nw = await app.inject({
      method: "GET",
      url: "/api/v1/investments/net-worth",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(nw.statusCode).toBe(200);
    expect(nw.json().investmentsTotalCents).toBe(105000);
    expect(nw.json().totalGainLossCents).toBe(15000);
  });

  it("manages workspaces, split expenses, balances, and settle", async () => {
    const wsRes = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Casa", type: "COUPLE" },
    });
    expect(wsRes.statusCode).toBe(201);
    const wsId = wsRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${wsId}/members`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { memberName: "Ana" },
    });

    const expRes = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${wsId}/expenses`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: "Mercado",
        paidByName: "Daniel",
        totalAmountCents: 20000,
        participants: ["Daniel", "Ana"],
        date: "2026-11-25",
      },
    });
    expect(expRes.statusCode).toBe(201);
    const expenseId = expRes.json().id;

    const listRes = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${wsId}/expenses`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const balances = listRes.json().balances as Array<{
      memberName: string;
      netBalanceCents: number;
    }>;
    expect(balances.find((b) => b.memberName === "Ana")?.netBalanceCents).toBe(-10000);

    await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${wsId}/expenses/${expenseId}/settle`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
  });

  it("connects Open Finance sandbox, parses NLP/NFC-e, and returns smart insights", async () => {
    const conn = await app.inject({
      method: "POST",
      url: "/api/v1/open-finance/connections",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { provider: "SANDBOX", institutionName: "Banco Inter" },
    });
    expect(conn.statusCode).toBe(201);

    const sync = await app.inject({
      method: "POST",
      url: `/api/v1/open-finance/connections/${conn.json().id}/sync`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(sync.json().imported).toBe(1);

    const nl = await app.inject({
      method: "POST",
      url: "/api/v1/insights/parse-nl",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { text: "Almoço 45,90 alimentação ontem" },
    });
    expect(nl.json().amountCents).toBe(4590);

    const nfce = await app.inject({
      method: "POST",
      url: "/api/v1/insights/parse-nfce",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        input: "https://www.nfce.fazenda.sp.gov.br/qrcode?p=35261112345678000190650010000012341000012345|2|1|1|HASH&vNF=89.90",
      },
    });
    expect(nfce.json().valid).toBe(true);
    expect(nfce.json().amountCents).toBe(8990);

    const insights = await app.inject({
      method: "GET",
      url: "/api/v1/insights",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(insights.statusCode).toBe(200);
    expect(insights.json().netWorthCents).toBeGreaterThan(0);
  });
});
