import { app, BrowserWindow } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";

let apiProcess: ChildProcess | null = null;
const LOCAL_API_PORT = process.env.FINFLOW_LOCAL_PORT ?? "3333";

function startLocalApiServer(): void {
  const userDataDir = app.getPath("userData");
  const dbPath = path.join(userDataDir, "finflow.db").replace(/\\/g, "/");

  const apiEntry = app.isPackaged
    ? path.join(process.resourcesPath, "api", "dist", "server.js")
    : path.resolve(__dirname, "../../api/dist/server.js");

  apiProcess = fork(apiEntry, [], {
    env: {
      ...process.env,
      PORT: LOCAL_API_PORT,
      HOST: "127.0.0.1",
      FINFLOW_MODE: "local",
      DATABASE_URL: `file:${dbPath}`,
    },
    stdio: "inherit",
  });
}

function createWindow(): void {
  process.env.FINFLOW_LOCAL_API_URL = `http://127.0.0.1:${LOCAL_API_PORT}`;

  const win = new BrowserWindow({
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

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexHtml = app.isPackaged
      ? path.join(process.resourcesPath, "web-dist", "index.html")
      : path.resolve(__dirname, "../../web/dist/index.html");
    void win.loadFile(indexHtml);
  }
}

void app.whenReady().then(() => {
  if (process.env.FINFLOW_SKIP_LOCAL_API !== "true") {
    startLocalApiServer();
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
