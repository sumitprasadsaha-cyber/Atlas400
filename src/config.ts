/**
 * Application Version & Runtime Configuration
 * Automatically computed from build environment, Git commit, and deployment metadata.
 */

export interface AppVersionData {
  version: string;
  gitCommit: string;
  gitCommitShort: string;
  gitBranch: string;
  buildTime: string;
  deploymentEnvironment: string;
  baseVersion: string;
}

// Injected at compile-time by Vite via define / import.meta.env
export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string) || "6.0.0-auto";

export const GIT_COMMIT: string =
  (import.meta.env.VITE_GIT_COMMIT as string) || "local-development";

export const GIT_COMMIT_SHORT: string =
  (import.meta.env.VITE_GIT_COMMIT_SHORT as string) ||
  (import.meta.env.VITE_GIT_COMMIT ? (import.meta.env.VITE_GIT_COMMIT as string).slice(0, 7) : "dev");

export const GIT_BRANCH: string =
  (import.meta.env.VITE_GIT_BRANCH as string) || "main";

export const BUILD_TIME: string =
  (import.meta.env.VITE_BUILD_TIME as string) || new Date().toISOString();

export const DEPLOYMENT_ENV: string =
  (import.meta.env.VITE_DEPLOYMENT_ENV as string) ||
  (import.meta.env.DEV ? "development" : "production");

export const BASE_VERSION: string =
  (import.meta.env.VITE_BASE_VERSION as string) || "6.0.0";

/**
 * Fetches the dynamic runtime version directly from the live /api/version endpoint.
 * Strictly bypasses all caches so users always receive the freshest deployment state.
 */
export async function fetchLiveAppVersion(): Promise<AppVersionData | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json && (json.version || json.gitCommit)) {
      return {
        version: json.version || APP_VERSION,
        gitCommit: json.gitCommit || GIT_COMMIT,
        gitCommitShort: json.gitCommitShort || GIT_COMMIT_SHORT,
        gitBranch: json.gitBranch || GIT_BRANCH,
        buildTime: json.buildTime || BUILD_TIME,
        deploymentEnvironment: json.deploymentEnvironment || DEPLOYMENT_ENV,
        baseVersion: json.baseVersion || BASE_VERSION,
      };
    }
    return null;
  } catch (err) {
    console.warn("[Version] Could not fetch live version from /api/version:", err);
    return null;
  }
}
