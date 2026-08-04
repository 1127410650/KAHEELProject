/**
 * "Keep me signed in on this device" — session persistence scope.
 *
 * There is exactly ONE Supabase client (`@/integrations/supabase/client`), it is
 * created once, and it always uses the official Supabase Auth storage key. This
 * module never invents token keys of its own: it only decides WHERE that single
 * official entry lives.
 *
 *   remember = true  (default) → localStorage: survives reload, new tabs and a
 *                                browser restart; Supabase refreshes the token.
 *   remember = false           → sessionStorage: the same official entry is kept
 *                                for the current browser session only, so a
 *                                reload or in-app navigation keeps the user
 *                                signed in, while closing the browser ends it.
 *
 * The only key we own is the boolean preference below — it holds no token.
 */
const REMEMBER_KEY = "tahqaq.auth.remember";

function authStorageKey(): string | null {
  const ref = import.meta.env["VITE_SUPABASE_PROJECT_ID"];
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

/** Defaults to true: the checkbox on the sign-in page starts enabled. */
export function rememberSession(): boolean {
  return safeLocal()?.getItem(REMEMBER_KEY) !== "0";
}

export function setRememberSession(remember: boolean) {
  const local = safeLocal();
  if (!local) return;
  local.setItem(REMEMBER_KEY, remember ? "1" : "0");
  syncAuthStorage();
}

/**
 * Aligns the official Supabase entry with the current preference. Called once on
 * boot (before the session is read) and after every auth state change, so a
 * refreshed token never leaks into permanent storage in session-only mode.
 */
export function syncAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session) return;

  if (rememberSession()) {
    // Persistent mode: localStorage is the source of truth; drop any leftover copy.
    session.removeItem(key);
    return;
  }

  const fromLocal = local.getItem(key);
  if (fromLocal) {
    // Supabase just wrote (or refreshed) the token: move it to the browser session.
    session.setItem(key, fromLocal);
    local.removeItem(key);
  }
}

/**
 * Session-only mode keeps the token in sessionStorage, which the Supabase client
 * does not read. Copying it back into localStorage before the client is first
 * used is what makes a reload keep the user signed in.
 */
export function restoreAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session || rememberSession()) return;

  const held = session.getItem(key);
  if (held) local.setItem(key, held);
  else local.removeItem(key);

  // Nothing durable may survive the browser session in this mode.
  const drain = () => {
    const current = local.getItem(key);
    if (current) session.setItem(key, current);
    local.removeItem(key);
  };
  window.addEventListener("pagehide", drain);
  window.addEventListener("beforeunload", drain);
}
