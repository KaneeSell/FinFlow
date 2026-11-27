import type { FastifyInstance } from "fastify";
import type { ServerAdminConfig } from "@finflow/shared";
import { buildApp } from "./app.js";
import { loadServerConfig } from "./lib/server-config.js";

let currentApp: FastifyInstance | null = null;
let currentConfig: ServerAdminConfig = loadServerConfig();

async function boot(config: ServerAdminConfig): Promise<void> {
  const app = await buildApp({
    logger: process.env.NODE_ENV !== "test",
    serverConfig: config,
    onPortChange: async (next) => {
      const prev = currentConfig;
      try {
        if (currentApp) {
          await currentApp.close();
          currentApp = null;
        }
        await boot(next);
      } catch (err) {
        console.error(`Failed to rebind FinFlow API to ${next.host}:${next.port}:`, err);
        await boot(prev);
      }
    },
  });

  await app.listen({ port: config.port, host: config.host });
  currentApp = app;
  currentConfig = config;
  console.log(`FinFlow API running at http://${config.host}:${config.port}`);
}

async function start(): Promise<void> {
  try {
    await boot(loadServerConfig());
  } catch (err) {
    console.error("Failed to start FinFlow API:", err);
    process.exit(1);
  }
}

void start();
