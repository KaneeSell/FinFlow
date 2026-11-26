import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("Database Auto-Bootstrap (Fresh SQLite without prisma db push)", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-bootstrap-test-"));
  const dbPath = path.join(tempDir, "nested", "fresh.db");
  const databaseUrl = `file:${dbPath.replace(/\\/g, "/")}`;

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("auto-initializes schema on empty DB, registers user, and stays idempotent on restart", async () => {
    const app1 = await buildApp({
      databaseUrl,
      jwtSecret: "bootstrap-test-secret-with-at-least-32-chars",
      mode: "test",
    });
    await app1.ready();

    const registerRes = await app1.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Bootstrap User",
        email: "bootstrap@finflow.dev",
        password: "Password123",
      },
    });
    expect(registerRes.statusCode).toBe(201);
    const registerBody = registerRes.json();
    expect(registerBody.accessToken).toBeTruthy();
    expect(registerBody.refreshToken).toBeTruthy();

    const accountsRes = await app1.inject({
      method: "GET",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${registerBody.accessToken}` },
    });
    expect(accountsRes.statusCode).toBe(200);
    expect((accountsRes.json() as unknown[]).length).toBeGreaterThanOrEqual(2);

    const loginRes = await app1.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "bootstrap@finflow.dev",
        password: "Password123",
      },
    });
    expect(loginRes.statusCode).toBe(200);

    await app1.close();

    // Restart second app instance against the same DB to verify idempotency
    const app2 = await buildApp({
      databaseUrl,
      jwtSecret: "bootstrap-test-secret-with-at-least-32-chars",
      mode: "test",
    });
    await app2.ready();

    const loginRes2 = await app2.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "bootstrap@finflow.dev",
        password: "Password123",
      },
    });
    expect(loginRes2.statusCode).toBe(200);

    const dupRes = await app2.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Bootstrap User",
        email: "bootstrap@finflow.dev",
        password: "Password123",
      },
    });
    expect(dupRes.statusCode).toBe(409);

    await app2.close();
  });
});
