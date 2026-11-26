export const GITHUB_RELEASES_LATEST_URL =
  "https://api.github.com/repos/KaneeSell/FinFlow/releases/latest";

export const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

export interface GitHubReleasePayload {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  published_at?: string;
  assets?: ReleaseAsset[];
}

export type UpdatePlatform =
  | "win-exe"
  | "win-msi"
  | "linux-appimage"
  | "linux-deb"
  | "android-apk"
  | "web";

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  downloadUrl: string | null;
  publishedAt: string | null;
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "").split("-")[0] ?? "0.0.0";
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
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

export function isNewerVersion(current: string, latest: string): boolean {
  return compareSemver(current, latest) === -1;
}

export function selectReleaseAsset(
  assets: ReleaseAsset[],
  platform: UpdatePlatform
): ReleaseAsset | null {
  if (platform === "web" || assets.length === 0) return null;

  const matcher: Record<Exclude<UpdatePlatform, "web">, RegExp> = {
    "win-exe": /\.exe$/i,
    "win-msi": /\.msi$/i,
    "linux-appimage": /\.AppImage$/i,
    "linux-deb": /\.deb$/i,
    "android-apk": /\.apk$/i,
  };

  const regex = matcher[platform];
  return assets.find((asset) => regex.test(asset.name)) ?? null;
}

export function buildUpdateCheckResult(
  currentVersion: string,
  release: GitHubReleasePayload,
  platform: UpdatePlatform
): UpdateCheckResult {
  const current = normalizeVersion(currentVersion);
  const latest = normalizeVersion(release.tag_name);
  const asset = selectReleaseAsset(release.assets ?? [], platform);

  return {
    currentVersion: current,
    latestVersion: latest,
    hasUpdate: isNewerVersion(current, latest),
    releaseName: release.name?.trim() || `FinFlow v${latest}`,
    releaseNotes: release.body?.trim() || "",
    releaseUrl: release.html_url,
    downloadUrl: asset?.browser_download_url ?? null,
    publishedAt: release.published_at ?? null,
  };
}
