import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { loadServerConfig } from "./lib/server-config.js";

let currentApp: FastifyInstance | null = null;
let currentPort = 3333;
let currentHost = "0.0.0.0";

async function boot(port: number, host: string): Promise<void> {
  const app = await buildApp({
    logger: process.env.NODE_ENV !== "test",
    runtimePort: port,
    runtimeHost: host,
    onPortChange: async (next) => {
      const prevPort = currentPort;
      const prevHost = currentHost;
      try {
        if (currentApp) {
          await currentApp.close();
          currentApp = null;
        }
        await boot(next.port, next.host);
      } catch (err) {
        console.error(`Failed to rebind FinFlow API to ${next.host}:${next.port}:`, err);
        await boot(prevPort, prevHost);
      }
    },
  });

  await app.listen({ port, host });
  currentApp = app;
  currentPort = port;
  currentHost = host;
  console.log(`FinFlow API running at http://${host}:${port}`);
}

async function start(): Promise<void> {
  const config = loadServerConfig();
  try {
    await boot(config.port, config.host);
  } catch (err) {
    console.error("Failed to start FinFlow API:", err);
    process.exit(1);
  }
}

void start();
