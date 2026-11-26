import {
  buildUpdateCheckResult,
  GITHUB_RELEASES_LATEST_URL,
  type GitHubReleasePayload,
  type UpdateCheckResult,
  type UpdatePlatform,
} from "@finflow/shared";

const STORAGE_AUTO_UPDATE_KEY = "finflow:auto_update_check";

export interface DesktopUpdateStatusEvent {
  state: "available" | "downloading" | "error";
  info?: UpdateCheckResult;
  progress?: number;
  error?: string;
}

export interface DesktopUpdatesBridge {
  checkForUpdates: () => Promise<{ ok: boolean; info?: UpdateCheckResult; error?: string }>;
  downloadAndInstall: (downloadUrl: string) => Promise<{ ok: boolean; error?: string }>;
  openReleasePage: (url: string) => Promise<{ ok: boolean }>;
  onUpdateStatus: (callback: (payload: DesktopUpdateStatusEvent) => void) => () => void;
}

export function getAppVersion(): string {
  if (typeof window !== "undefined" && window.finflowDesktop?.appVersion) {
    return window.finflowDesktop.appVersion;
  }
  return typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";
}

export function getAutoUpdateCheckEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_AUTO_UPDATE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function setAutoUpdateCheckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_AUTO_UPDATE_KEY, String(enabled));
  } catch {
    // ignore storage errors
  }
}

function detectWebOrMobilePlatform(): UpdatePlatform {
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
    return "android-apk";
  }
  return "web";
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (typeof window !== "undefined" && window.finflowDesktop?.updates) {
    const res = await window.finflowDesktop.updates.checkForUpdates();
    if (!res.ok || !res.info) {
      throw new Error(res.error ?? "Falha ao verificar atualizações.");
    }
    return res.info;
  }

  const res = await fetch(GITHUB_RELEASES_LATEST_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(`Falha ao verificar atualizações (HTTP ${res.status})`);
  }

  const release = (await res.json()) as GitHubReleasePayload;
  return buildUpdateCheckResult(getAppVersion(), release, detectWebOrMobilePlatform());
}

export async function triggerAppUpdate(info: UpdateCheckResult): Promise<void> {
  if (typeof window !== "undefined" && window.finflowDesktop?.updates) {
    if (info.downloadUrl) {
      const res = await window.finflowDesktop.updates.downloadAndInstall(info.downloadUrl);
      if (!res.ok) {
        throw new Error(res.error ?? "Falha ao instalar atualização.");
      }
      return;
    }
    await window.finflowDesktop.updates.openReleasePage(info.releaseUrl);
    return;
  }

  const targetUrl = info.downloadUrl ?? info.releaseUrl;
  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
