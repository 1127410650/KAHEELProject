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
const REMEMBER_KEY = "tahqaq.auth.remember";

function authStorageKey(): string | null {
  const explicitRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"];
  const url = import.meta.env["VITE_SUPABASE_URL"];
  let urlRef: string | null = null;
  try {
    urlRef = url ? new URL(url).hostname.split(".")[0] || null : null;
  } catch {
    urlRef = null;
  }
  const ref = explicitRef || urlRef;
  return ref ? `sb-${ref}-auth-token` : null;
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
  local.setItem(REMEMBER_KEY, "1");
  if (key && session) {
    const held = session.getItem(key);
    if (!local.getItem(key) && held) local.setItem(key, held);
    session.removeItem(key);
  }
  syncAuthStorage();
}

/**
 * Keeps the official token in durable storage after every Supabase auth event.
 */
export function syncAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session) return;
  local.setItem(REMEMBER_KEY, "1");
  const held = session.getItem(key);
  if (!local.getItem(key) && held) local.setItem(key, held);
  session.removeItem(key);
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
  local.setItem(REMEMBER_KEY, "1");
  const held = session.getItem(key);
  if (!local.getItem(key) && held) local.setItem(key, held);
  session.removeItem(key);
}

/** Manual sign-out: no copy of the session may survive in either scope. */
export function clearAuthStorage() {
  const key = authStorageKey();
  if (!key) return;
  try {
    safeLocal()?.removeItem(key);
    safeSession()?.removeItem(key);
  } catch {
    /* nothing durable to clean up in private mode */
  }
}
