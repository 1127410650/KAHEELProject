/**
 * Browser-safe configuration for the one canonical Kaheel Supabase project.
 *
 * Lovable's embedded preview can expose server variables without mirroring the
 * matching `VITE_*` values into the browser bundle. A missing browser value
 * used to crash the React root before the first network request. Supabase
 * publishable keys are intentionally public (they are shipped to every browser)
 * and authorization continues to be enforced by Auth and RLS.
 *
 * Environment values remain the first choice so the publishable key can be
 * rotated without a code release. The checked-in values are a fail-safe for
 * the approved project only; secret/service-role keys never belong here.
 */

export const CANONICAL_SUPABASE_PROJECT_ID = "rgpnhzovtceitqxpiilf";
export const CANONICAL_SUPABASE_URL =
  `https://${CANONICAL_SUPABASE_PROJECT_ID}.supabase.co` as const;
export const CANONICAL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jwDvrweHplYpTtuAZUSuHA_95zLINNn";

function serverEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env[name];
}

function configuredValue(viteName: string, serverName: string): string | undefined {
  const viteValue = import.meta.env[viteName]?.trim();
  if (viteValue) return viteValue;
  const value = serverEnv(serverName)?.trim();
  return value || undefined;
}

function assertCanonicalProject(projectId: string, url: string, publishableKey: string): void {
  if (projectId !== CANONICAL_SUPABASE_PROJECT_ID) {
    throw new Error("Supabase runtime configuration does not match the canonical project.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase runtime URL is invalid.");
  }
  const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  if (normalized !== CANONICAL_SUPABASE_URL || parsed.search || parsed.hash) {
    throw new Error("Supabase runtime URL does not match the canonical project.");
  }
  if (publishableKey.startsWith("sb_secret_")) {
    throw new Error("A secret Supabase key must never be exposed to the browser.");
  }
}

const projectId =
  configuredValue("VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID") ??
  CANONICAL_SUPABASE_PROJECT_ID;
const url = configuredValue("VITE_SUPABASE_URL", "SUPABASE_URL") ?? CANONICAL_SUPABASE_URL;
const publishableKey =
  configuredValue("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY") ??
  CANONICAL_SUPABASE_PUBLISHABLE_KEY;

assertCanonicalProject(projectId, url, publishableKey);

export const supabasePublicConfig = Object.freeze({
  projectId,
  url,
  publishableKey,
});
