import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { resolveDatabaseUrl } from "./db-bootstrap.js";

export interface ServerRuntimeConfig {
  port: number;
  host: string;
}

export function getServerConfigPath(databaseUrl?: string): string {
  if (process.env.FINFLOW_SERVER_CONFIG_PATH) {
    return process.env.FINFLOW_SERVER_CONFIG_PATH;
  }

  const dbUrl = resolveDatabaseUrl(databaseUrl);
  if (dbUrl.startsWith("file:")) {
    const filePart = dbUrl.slice("file:".length).split("?")[0];
    if (filePart && filePart !== ":memory:") {
      const resolvedFile = path.isAbsolute(filePart)
        ? filePart
        : path.resolve(process.cwd(), filePart);
      return path.join(path.dirname(resolvedFile), "server-config.json");
    }
  }

  return path.resolve(import.meta.dirname, "../../prisma/server-config.json");
}

export function loadServerConfig(databaseUrl?: string): ServerRuntimeConfig {
  const defaultPort = Number(process.env.PORT ?? 3333);
  const defaultHost = process.env.HOST ?? "0.0.0.0";

  if (
    process.env.FINFLOW_MODE === "e2e" ||
    process.env.FINFLOW_MODE === "test" ||
    process.env.FINFLOW_MANAGED_PORT === "true"
  ) {
    return { port: defaultPort, host: defaultHost };
  }

  try {
    const configPath = getServerConfigPath(databaseUrl);
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<ServerRuntimeConfig>;
      const port =
        typeof parsed.port === "number" &&
        Number.isInteger(parsed.port) &&
        parsed.port >= 1024 &&
        parsed.port <= 65535
          ? parsed.port
          : defaultPort;
      const host =
        typeof parsed.host === "string" && parsed.host.trim().length > 0
          ? parsed.host.trim()
          : defaultHost;
      return { port, host };
    }
  } catch {
    // Fallback to env/defaults on unreadable config
  }

  return { port: defaultPort, host: defaultHost };
}

export function saveServerConfig(config: ServerRuntimeConfig, databaseUrl?: string): void {
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
