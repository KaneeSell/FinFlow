import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Server Config & Live Port Switching API", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let dbUrl: string;
  let configPath: string;
  let accessToken = "";
  const onPortChange = vi.fn();

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-server-config-test-"));
    const dbPath = path.join(tempDir, "test.db").replace(/\\/g, "/");
    dbUrl = `file:${dbPath}`;
    configPath = path.join(tempDir, "server-config.json");
    process.env.FINFLOW_SERVER_CONFIG_PATH = configPath;

    app = await buildApp({
      databaseUrl: dbUrl,
      jwtSecret: "test-jwt-secret-with-at-least-32-chars",
      mode: "test",
      runtimePort: 3333,
      runtimeHost: "127.0.0.1",
      onPortChange,
    });
    await app.ready();

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Server Admin",
        email: "server-admin@finflow.dev",
        password: "Password123",
      },
    });
    accessToken = reg.json().accessToken;
  });

  afterAll(async () => {
    delete process.env.FINFLOW_SERVER_CONFIG_PATH;
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("blocks unauthenticated access to /api/v1/server/config", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/server/config" });
    expect(res.statusCode).toBe(401);
  });

  it("returns current runtime port and host", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/server/config",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ port: 3333, host: "127.0.0.1" });
  });

  it("rejects invalid port and busy port (409)", async () => {
    const invalidRes = await app.inject({
      method: "PUT",
      url: "/api/v1/server/config",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { port: 80 },
    });
    expect(invalidRes.statusCode).toBe(400);

    const occupiedServer = net.createServer();
    await new Promise<void>((resolve) => occupiedServer.listen(0, "127.0.0.1", resolve));
    const busyPort = (occupiedServer.address() as net.AddressInfo).port;

    try {
      const busyRes = await app.inject({
        method: "PUT",
        url: "/api/v1/server/config",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { port: busyPort },
      });
      expect(busyRes.statusCode).toBe(409);
    } finally {
      await new Promise<void>((resolve) => occupiedServer.close(() => resolve()));
    }
  });

  it("persists new port and triggers onPortChange on a free port", async () => {
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const freePort = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/server/config",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { port: freePort },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      port: freePort,
      host: "127.0.0.1",
      restarting: true,
    });

    const saved = JSON.parse(fs.readFileSync(configPath, "utf8")) as { port: number; host: string };
    expect(saved.port).toBe(freePort);

    await new Promise((r) => setTimeout(r, 200));
    expect(onPortChange).toHaveBeenCalledWith({ port: freePort, host: "127.0.0.1" });
  });
});
