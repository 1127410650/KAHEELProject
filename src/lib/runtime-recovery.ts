const RECOVERY_KEY = "gohail.runtime.asset-reload";
const RECOVERY_TTL_MS = 5 * 60_000;

let memoryRecoveryAt = 0;

const STALE_ASSET_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading (?:css )?chunk [\w-]+ failed/i,
  /unable to preload css/i,
  /dynamically imported module/i,
];

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error instanceof Response) return `Response ${error.status} ${error.url}`;
  return String(error ?? "");
}

export function isStaleAssetError(error: unknown): boolean {
  const text = errorText(error);
  return STALE_ASSET_PATTERNS.some((pattern) => pattern.test(text));
}

function previousRecoveryAt(): number {
  if (typeof window === "undefined") return memoryRecoveryAt;
  try {
    const stored = Number(window.sessionStorage.getItem(RECOVERY_KEY) ?? "0");
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return memoryRecoveryAt;
  }
}

function rememberRecovery(now: number) {
  memoryRecoveryAt = now;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, String(now));
  } catch {
    // Embedded/private previews can deny sessionStorage too; memory is enough
    // to stop a reload loop for the lifetime of the current document.
  }
}

/**
 * A deployment replaces Vite's hashed route chunks. An already-open Lovable
 * preview can still reference the removed hashes and fall into the root error
 * boundary. Reload once to fetch the new HTML/manifest, with a TTL guard so a
 * real network or server failure can never cause a reload loop.
 */
export function recoverStaleAssetOnce(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleAssetError(error)) return false;
  const now = Date.now();
  if (now - previousRecoveryAt() < RECOVERY_TTL_MS) return false;
  rememberRecovery(now);
  window.location.reload();
  return true;
}
