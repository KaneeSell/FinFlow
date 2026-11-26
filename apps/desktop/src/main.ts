import { app, BrowserWindow, ipcMain } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { registerDesktopUpdater } from "./updater";

interface DesktopConfig {
  localPort?: number;
}

let apiProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let disposeUpdater: (() => void) | null = null;
let activeLocalPort = Number(process.env.FINFLOW_LOCAL_PORT ?? "3333");

function getDesktopConfigPath(): string {
  return path.join(app.getPath("userData"), "desktop-config.json");
}

function readDesktopConfig(): DesktopConfig {
  try {
    const raw = fs.readFileSync(getDesktopConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as DesktopConfig;
    if (
      typeof parsed.localPort === "number" &&
      Number.isInteger(parsed.localPort) &&
      parsed.localPort >= 1024 &&
      parsed.localPort <= 65535
    ) {
      return { localPort: parsed.localPort };
    }
  } catch {
    // Config file may not exist yet
  }
  return {};
}

function writeDesktopConfig(config: DesktopConfig): void {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(getDesktopConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function stopLocalApiServer(): void {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
}

function startLocalApiServer(port: number): void {
  const userDataDir = app.getPath("userData");
  const dbPath = path.join(userDataDir, "finflow.db").replace(/\\/g, "/");

  const apiEntry = app.isPackaged
    ? path.join(process.resourcesPath, "api", "dist", "server.js")
    : path.resolve(__dirname, "../../api/dist/server.js");
  const apiCwd = path.dirname(path.dirname(apiEntry));

  apiProcess = fork(apiEntry, [], {
    cwd: apiCwd,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      FINFLOW_MODE: "local",
      FINFLOW_MANAGED_PORT: "true",
      DATABASE_URL: `file:${dbPath}`,
    },
    stdio: "inherit",
  });
}

async function waitForLocalApi(port: number, timeoutMs = 10000): Promise<boolean> {
  const healthUrl = `http://127.0.0.1:${port}/health`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return true;
    } catch {
      // API still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

function registerServerIpc(): void {
  ipcMain.handle("finflow:server:get-port", () => activeLocalPort);

  ipcMain.handle("finflow:server:check-port", async (_event, port: number) => {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return { available: false, inUseByFinFlow: false };
    }
    if (port === activeLocalPort && apiProcess !== null) {
      return { available: true, inUseByFinFlow: true };
    }
    const available = await checkPortAvailable(port);
    return { available, inUseByFinFlow: false };
  });

  ipcMain.handle("finflow:server:set-port", async (_event, port: number) => {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return { ok: false, error: "Porta inválida. Escolha um número entre 1024 e 65535." };
    }

    if (port === activeLocalPort) {
      writeDesktopConfig({ localPort: port });
      return { ok: true, port, apiUrl: `http://127.0.0.1:${port}` };
    }

    const available = await checkPortAvailable(port);
    if (!available) {
      return { ok: false, error: `A porta ${port} já está em uso por outro aplicativo.` };
    }

    stopLocalApiServer();
    startLocalApiServer(port);
    const healthy = await waitForLocalApi(port);
    if (!healthy) {
      stopLocalApiServer();
      startLocalApiServer(activeLocalPort);
      await waitForLocalApi(activeLocalPort);
      return { ok: false, error: `Não foi possível iniciar o servidor na porta ${port}.` };
    }

    activeLocalPort = port;
    process.env.FINFLOW_LOCAL_API_URL = `http://127.0.0.1:${port}`;
    writeDesktopConfig({ localPort: port });
    return { ok: true, port, apiUrl: `http://127.0.0.1:${port}` };
  });
}

function createWindow(): void {
  process.env.FINFLOW_LOCAL_API_URL = `http://127.0.0.1:${activeLocalPort}`;
  process.env.FINFLOW_APP_VERSION = app.getVersion();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    title: "FinFlow",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexHtml = app.isPackaged
      ? path.join(process.resourcesPath, "web-dist", "index.html")
      : path.resolve(__dirname, "../../web/dist/index.html");
    void mainWindow.loadFile(indexHtml);
  }
}

void app.whenReady().then(async () => {
  const saved = readDesktopConfig();
  if (saved.localPort) {
    activeLocalPort = saved.localPort;
  }

  registerServerIpc();

  if (process.env.FINFLOW_SKIP_LOCAL_API !== "true") {
    startLocalApiServer(activeLocalPort);
    await waitForLocalApi(activeLocalPort);
  }
  createWindow();
  disposeUpdater = registerDesktopUpdater(() => mainWindow, stopLocalApiServer);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (disposeUpdater) {
    disposeUpdater();
    disposeUpdater = null;
  }
  stopLocalApiServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
