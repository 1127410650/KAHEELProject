/**
 * Durable Supabase session storage for every marketplace identity.
 *
 * A signed-in person and the business/store account selected under that person
 * must survive reloads, new tabs and browser restarts. Supabase owns the token
 * and refresh lifecycle; this module only migrates the one official auth entry
 * to localStorage. It never creates a second token or a parallel auth system.
 *
 * Sessions are cleared only by the central explicit sign-out path or by a real
 * Supabase security revocation (password reset, disabled user, revoked token).
 */
import { supabasePublicConfig } from "@/integrations/supabase/public-config";

const REMEMBER_KEY = "tahqaq.auth.remember";

function authStorageKey(): string {
  return `sb-${supabasePublicConfig.projectId}-auth-token`;
}

function safeLocal(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function safeSession(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Makes durable storage explicit before registration or sign-in writes a token. */
export function enablePersistentSession() {
  const local = safeLocal();
  const session = safeSession();
  const key = authStorageKey();
  if (!local) return;
  try {
    local.setItem(REMEMBER_KEY, "1");
    if (key && session) {
      const held = session.getItem(key);
      if (!local.getItem(key) && held) local.setItem(key, held);
      session.removeItem(key);
    }
    syncAuthStorage();
  } catch {
    // Some embedded/private browsers expose Storage but reject its methods.
    // Supabase's safe adapter keeps the current page session usable in memory.
  }
}

/**
 * Keeps the official token in durable storage after every Supabase auth event.
 */
export function syncAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session) return;
  try {
    local.setItem(REMEMBER_KEY, "1");
    const held = session.getItem(key);
    if (!local.getItem(key) && held) local.setItem(key, held);
    session.removeItem(key);
  } catch {
    // Persistence is best-effort when the browser denies storage operations.
  }
}

/**
 * One-time migration for users who previously selected browser-session-only
 * storage. The same official token is moved; it is never copied to a new key.
 */
export function restoreAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session) return;
  try {
    local.setItem(REMEMBER_KEY, "1");
    const held = session.getItem(key);
    if (!local.getItem(key) && held) local.setItem(key, held);
    session.removeItem(key);
  } catch {
    // Do not let an embedded preview crash while session restoration starts.
  }
}

/** Manual sign-out: no copy of the session may survive in either scope. */
export function clearAuthStorage() {
  const key = authStorageKey();
  try {
    safeLocal()?.removeItem(key);
    safeSession()?.removeItem(key);
  } catch {
    /* nothing durable to clean up in private mode */
  }
}
