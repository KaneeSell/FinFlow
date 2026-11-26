import { describe, expect, it } from "vitest";
import {
  buildUpdateCheckResult,
  compareSemver,
  isNewerVersion,
  normalizeVersion,
  selectReleaseAsset,
} from "./updates.js";

describe("Update SemVer and Release Asset Helpers", () => {
  it("normalizes and compares SemVer versions accurately", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
    expect(compareSemver("1.1.0", "1.0.9")).toBe(1);
    expect(isNewerVersion("1.0.0", "v1.1.0")).toBe(true);
    expect(isNewerVersion("v1.1.0", "1.1.0")).toBe(false);
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
  });

  it("selects matching platform release assets", () => {
    const assets = [
      { name: "FinFlow-1.1.0-win-x64.exe", browser_download_url: "https://example.com/win.exe" },
      { name: "FinFlow-1.1.0-win-x64.msi", browser_download_url: "https://example.com/win.msi" },
      { name: "FinFlow-1.1.0-linux-x86_64.AppImage", browser_download_url: "https://example.com/app.AppImage" },
      { name: "FinFlow-1.1.0-linux-amd64.deb", browser_download_url: "https://example.com/app.deb" },
      { name: "app-debug.apk", browser_download_url: "https://example.com/app.apk" },
    ];

    expect(selectReleaseAsset(assets, "win-exe")?.name).toBe("FinFlow-1.1.0-win-x64.exe");
    expect(selectReleaseAsset(assets, "win-msi")?.name).toBe("FinFlow-1.1.0-win-x64.msi");
    expect(selectReleaseAsset(assets, "linux-appimage")?.name).toBe("FinFlow-1.1.0-linux-x86_64.AppImage");
    expect(selectReleaseAsset(assets, "linux-deb")?.name).toBe("FinFlow-1.1.0-linux-amd64.deb");
    expect(selectReleaseAsset(assets, "android-apk")?.name).toBe("app-debug.apk");
    expect(selectReleaseAsset(assets, "web")).toBeNull();
  });

  it("builds UpdateCheckResult with hasUpdate flag and downloadUrl", () => {
    const result = buildUpdateCheckResult(
      "1.0.0",
      {
        tag_name: "v1.1.0",
        name: "FinFlow v1.1.0",
        body: "Auto-updater support",
        html_url: "https://github.com/KaneeSell/FinFlow/releases/tag/v1.1.0",
        published_at: "2026-11-26T15:00:00Z",
        assets: [
          {
            name: "FinFlow-1.1.0-win-x64.exe",
            browser_download_url: "https://github.com/KaneeSell/FinFlow/releases/download/v1.1.0/FinFlow-1.1.0-win-x64.exe",
          },
        ],
      },
      "win-exe"
    );

    expect(result.hasUpdate).toBe(true);
    expect(result.currentVersion).toBe("1.0.0");
    expect(result.latestVersion).toBe("1.1.0");
    expect(result.downloadUrl).toContain("FinFlow-1.1.0-win-x64.exe");
  });
});
