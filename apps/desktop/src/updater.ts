import { app, ipcMain, shell, type BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const GITHUB_RELEASES_LATEST_URL =
  "https://api.github.com/repos/KaneeSell/FinFlow/releases/latest";
const DEFAULT_UPDATE_INTERVAL_MS = 30 * 60 * 1000;

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubReleasePayload {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  published_at?: string;
  assets?: ReleaseAsset[];
}

export interface DesktopUpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  downloadUrl: string | null;
  publishedAt: string | null;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "").split("-")[0] ?? "0.0.0";
}

function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const partsA = normalizeVersion(a)
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  const partsB = normalizeVersion(b)
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function detectDesktopAssetMatcher(): RegExp {
  if (process.platform === "win32") return /\.exe$/i;
  if (process.platform === "linux") {
    return process.env.APPIMAGE ? /\.AppImage$/i : /\.deb$/i;
  }
  return /\.zip$/i;
}

export async function checkForDesktopUpdate(): Promise<DesktopUpdateCheckResult> {
  const res = await fetch(GITHUB_RELEASES_LATEST_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "FinFlow-Desktop",
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao consultar atualizações (HTTP ${res.status})`);
  }

  const release = (await res.json()) as GitHubReleasePayload;
  const currentVersion = normalizeVersion(app.getVersion());
  const latestVersion = normalizeVersion(release.tag_name);
  const matcher = detectDesktopAssetMatcher();
  const asset = (release.assets ?? []).find((a) => matcher.test(a.name)) ?? null;

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareSemver(currentVersion, latestVersion) === -1,
    releaseName: release.name?.trim() || `FinFlow v${latestVersion}`,
    releaseNotes: release.body?.trim() || "",
    releaseUrl: release.html_url,
    downloadUrl: asset?.browser_download_url ?? null,
    publishedAt: release.published_at ?? null,
  };
}

async function downloadAndInstallUpdate(
  downloadUrl: string,
  onProgress: (percent: number) => void,
  onBeforeQuit: () => void
): Promise<void> {
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": "FinFlow-Desktop" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Falha ao baixar atualização (HTTP ${res.status})`);
  }

  const urlObj = new URL(downloadUrl);
  const filename = path.basename(urlObj.pathname) || "FinFlow-Update";
  const destPath = path.join(app.getPath("temp"), filename);

  const totalBytes = Number(res.headers.get("content-length") ?? "0");
  let downloadedBytes = 0;

  const fileStream = fs.createWriteStream(destPath);
  const reader = res.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(Buffer.from(value));
        downloadedBytes += value.byteLength;
        if (totalBytes > 0) {
          onProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
        }
      }
    }
  } finally {
    await new Promise<void>((resolve) => fileStream.end(resolve));
  }

  onProgress(100);

  if (destPath.endsWith(".AppImage")) {
    fs.chmodSync(destPath, 0o755);
  }

  if (destPath.endsWith(".exe") || destPath.endsWith(".AppImage")) {
    const child = spawn(destPath, [], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } else {
    await shell.openPath(destPath);
  }

  onBeforeQuit();
  app.quit();
}

export function registerDesktopUpdater(
  getWindow: () => BrowserWindow | null,
  stopLocalApi: () => void
): () => void {
  const sendStatus = (payload: unknown) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("finflow:updates:status", payload);
    }
  };

  ipcMain.handle("finflow:updates:check", async () => {
    try {
      const info = await checkForDesktopUpdate();
      return { ok: true, info };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao verificar atualizações.",
      };
    }
  });

  ipcMain.handle("finflow:updates:install", async (_event, downloadUrl: string) => {
    try {
      sendStatus({ state: "downloading", progress: 0 });
      await downloadAndInstallUpdate(
        downloadUrl,
        (progress) => sendStatus({ state: "downloading", progress }),
        stopLocalApi
      );
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao instalar atualização.";
      sendStatus({ state: "error", error: message });
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("finflow:updates:open-release", async (_event, url: string) => {
    await shell.openExternal(url);
    return { ok: true };
  });

  const runSilentCheck = async () => {
    try {
      const info = await checkForDesktopUpdate();
      if (info.hasUpdate) {
        sendStatus({ state: "available", info });
      }
    } catch {
      // Ignore silent background network errors
    }
  };

  const intervalMs = Number(process.env.FINFLOW_UPDATE_INTERVAL_MS ?? DEFAULT_UPDATE_INTERVAL_MS);
  const initialTimer = setTimeout(() => {
    void runSilentCheck();
  }, 15_000);
  const recurringTimer = setInterval(() => {
    void runSilentCheck();
  }, intervalMs);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(recurringTimer);
  };
}
