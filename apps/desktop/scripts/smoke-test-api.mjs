import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const desktopDir = path.resolve(import.meta.dirname, "..");
const bundledApiDir = path.join(desktopDir, "build-resources", "api");
const serverEntry = path.join(bundledApiDir, "dist", "server.js");

if (!fs.existsSync(serverEntry)) {
  throw new Error(`Bundled API server not found at ${serverEntry}. Run prepare:api first.`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "finflow-desktop-smoke-"));
const dbPath = path.join(tempDir, "smoke.db").replace(/\\/g, "/");
const port = 3349;
const baseUrl = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, [serverEntry], {
  cwd: bundledApiDir,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    FINFLOW_MODE: "local",
    DATABASE_URL: `file:${dbPath}`,
    NODE_ENV: "production",
  },
  stdio: "inherit",
});

async function waitForHealth(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Bundled API did not become healthy within 10s");
}

try {
  await waitForHealth();

  const registerRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Smoke Test User",
      email: "smoke@finflow.app",
      password: "Password123",
    }),
  });

  if (registerRes.status !== 201) {
    const text = await registerRes.text();
    throw new Error(`Expected 201 from /api/v1/auth/register, got ${registerRes.status}: ${text}`);
  }

  const body = await registerRes.json();
  if (!body.accessToken) {
    throw new Error("Missing accessToken in register response");
  }

  console.log("Desktop bundled API smoke test passed!");
} finally {
  if (child.exitCode === null) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill();
    });
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Ignore Windows file-lock cleanup race on temp dir
  }
}
