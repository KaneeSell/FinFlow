import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-e2e-"));
const dbPath = path.join(tempDir, "e2e.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;

const apiDir = path.resolve(import.meta.dirname, "../apps/api");

execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  cwd: apiDir,
  env: { ...process.env, DATABASE_URL: dbUrl },
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.env.DATABASE_URL = dbUrl;
process.env.PORT = "3339";
process.env.HOST = "127.0.0.1";
process.env.FINFLOW_MODE = "e2e";

await import("../apps/api/dist/server.js");
