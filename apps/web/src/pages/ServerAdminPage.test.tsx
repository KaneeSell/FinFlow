import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { ServerAdminPage } from "./ServerAdminPage";

describe("ServerAdminPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("renders server telemetry, LAN URLs, and saves updated port and security settings", async () => {
    vi.spyOn(api.server, "getStatus").mockResolvedValue({
      status: "ok",
      mode: "local",
      version: "0.1.0",
      nodeVersion: "v22.0.0",
      platform: "win32 (x64)",
      pid: 1234,
      uptimeSeconds: 125,
      memoryRssMb: 85.4,
      memoryHeapMb: 42.1,
      port: 3333,
      host: "0.0.0.0",
      lanUrls: ["http://192.168.1.50:3333"],
      dbPath: "C:/FinFlow/finflow.db",
      dbSizeBytes: 65536,
      counts: {
        users: 1,
        accounts: 2,
        categories: 9,
        transactions: 14,
        recurringRules: 3,
        activeSessions: 1,
      },
      backups: [],
    });

    vi.spyOn(api.server, "getConfig").mockResolvedValue({
      port: 3333,
      host: "0.0.0.0",
      publicUrl: "",
      corsOrigin: "*",
      rateLimitMax: 300,
      allowRegistration: true,
      enableSwagger: true,
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 7,
      logLevel: "info",
      autoBackupEnabled: true,
      autoBackupRetention: 7,
    });

    const updateSpy = vi.spyOn(api.server, "updateConfig").mockResolvedValue({
      ok: true,
      restarting: false,
      port: 8080,
      host: "0.0.0.0",
      publicUrl: "",
      corsOrigin: "*",
      rateLimitMax: 300,
      allowRegistration: false,
      enableSwagger: true,
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 7,
      logLevel: "info",
      autoBackupEnabled: true,
      autoBackupRetention: 7,
    });

    render(<ServerAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Painel do Servidor")).toBeInTheDocument();
      expect(screen.getByText("Online · :3333")).toBeInTheDocument();
      expect(screen.getByText("http://192.168.1.50:3333")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "8080" }));
    fireEvent.click(screen.getByRole("button", { name: "Permitido" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e Aplicar Configurações" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 8080,
          allowRegistration: false,
        })
      );
    });
  });
});
