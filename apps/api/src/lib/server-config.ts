import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { ServerAdminConfig, ServerBackupInfo } from "@finflow/shared";
import { resolveDatabaseUrl } from "./db-bootstrap.js";

export type ServerRuntimeConfig = ServerAdminConfig;

export function getDefaultServerConfig(): ServerAdminConfig {
  return {
    port: Number(process.env.PORT ?? 3333),
    host: process.env.HOST ?? "0.0.0.0",
    publicUrl: process.env.FINFLOW_PUBLIC_URL ?? "",
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
    allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
    enableSwagger: process.env.ENABLE_SWAGGER !== "false",
    accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? 15),
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
    logLevel: (process.env.LOG_LEVEL as ServerAdminConfig["logLevel"]) || "info",
    autoBackupEnabled: true,
    autoBackupRetention: 7,
  };
}

export function resolveDbFilePath(databaseUrl?: string): string | null {
  const dbUrl = resolveDatabaseUrl(databaseUrl);
  if (!dbUrl.startsWith("file:")) return null;
  const filePart = dbUrl.slice("file:".length).split("?")[0];
  if (!filePart || filePart === ":memory:") return null;
  return path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart);
}

export function getServerConfigPath(databaseUrl?: string): string {
  if (process.env.FINFLOW_SERVER_CONFIG_PATH) {
    return process.env.FINFLOW_SERVER_CONFIG_PATH;
  }

  const dbFile = resolveDbFilePath(databaseUrl);
  if (dbFile) {
    return path.join(path.dirname(dbFile), "server-config.json");
  }

  return path.resolve(import.meta.dirname, "../../prisma/server-config.json");
}

export function loadServerConfig(databaseUrl?: string): ServerAdminConfig {
  const defaults = getDefaultServerConfig();

  if (process.env.FINFLOW_MODE === "e2e" || process.env.FINFLOW_MODE === "test") {
    return defaults;
  }

  try {
    const configPath = getServerConfigPath(databaseUrl);
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<ServerAdminConfig>;
      const merged: ServerAdminConfig = {
        ...defaults,
        ...parsed,
      };
      if (process.env.FINFLOW_MANAGED_PORT === "true") {
        merged.port = defaults.port;
        merged.host = defaults.host;
      }
      if (!Number.isInteger(merged.port) || merged.port < 1024 || merged.port > 65535) {
        merged.port = defaults.port;
      }
      return merged;
    }
  } catch {
    // Fallback to defaults on unreadable config
  }

  return defaults;
}

export function saveServerConfig(config: ServerAdminConfig, databaseUrl?: string): void {
  const configPath = getServerConfigPath(databaseUrl);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export function checkPortAvailable(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export function getLanUrls(port: number): string[] {
  const urls: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

function getBackupsDir(dbFile: string | null): string | null {
  if (!dbFile) return null;
  return path.join(path.dirname(dbFile), "backups");
}

export function listServerBackups(dbFile: string | null): ServerBackupInfo[] {
  const dir = getBackupsDir(dbFile);
  if (!dir || !fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createServerBackup(
  dbFile: string | null,
  retention = 7
): ServerBackupInfo | null {
  if (!dbFile || !fs.existsSync(dbFile)) return null;
  const dir = getBackupsDir(dbFile);
  if (!dir) return null;

  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `finflow-backup-${stamp}.db`;
  const destPath = path.join(dir, filename);
  fs.copyFileSync(dbFile, destPath);

  const backups = listServerBackups(dbFile);
  for (const stale of backups.slice(retention)) {
    try {
      fs.unlinkSync(path.join(dir, stale.name));
    } catch {
      // ignore cleanup error
    }
  }

  const stat = fs.statSync(destPath);
  return {
    name: filename,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}
