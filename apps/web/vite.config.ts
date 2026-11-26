import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function resolveAppVersion(): string {
  if (process.env.FINFLOW_APP_VERSION) {
    return process.env.FINFLOW_APP_VERSION;
  }
  try {
    const rootPkg = JSON.parse(
      fs.readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8")
    ) as { version?: string };
    return rootPkg.version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
}

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
