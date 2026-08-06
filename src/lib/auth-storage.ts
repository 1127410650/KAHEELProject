/**
 * "Keep me signed in on this device" — session persistence scope.
 *
 * Browser behavior:
 *   remember = true  (default) -> localStorage
 *   remember = false           -> sessionStorage for the current browser session
 *
 * Native behavior is implemented by native-auth-storage.ts. It listens for the
 * event exported here and switches between device-bound secure storage and an
 * in-memory session store without exposing auth tokens to browser storage.
 */
const REMEMBER_KEY = "tahqaq.auth.remember";
export const AUTH_PERSISTENCE_EVENT = "kahli:auth-persistence-change";

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

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUTH_PERSISTENCE_EVENT, {
        detail: { remember },
      }),
    );
  }
}

/**
 * Aligns the official Supabase browser entry with the current preference.
 * Native auth tokens are handled separately and never copied here.
 */
export function syncAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session) return;

  if (rememberSession()) {
    session.removeItem(key);
    return;
  }

  const fromLocal = local.getItem(key);
  if (fromLocal) session.setItem(key, fromLocal);
  else session.removeItem(key);
  armDrain();
}

let drainArmed = false;

function armDrain() {
  if (drainArmed || typeof window === "undefined") return;
  drainArmed = true;

  const drain = () => {
    const key = authStorageKey();
    const local = safeLocal();
    const session = safeSession();
    if (!key || !local || !session || rememberSession()) return;
    const current = local.getItem(key);
    if (current) session.setItem(key, current);
    local.removeItem(key);
  };
  window.addEventListener("pagehide", drain);
  window.addEventListener("beforeunload", drain);
}

export function restoreAuthStorage() {
  const key = authStorageKey();
  const local = safeLocal();
  const session = safeSession();
  if (!key || !local || !session || rememberSession()) return;

  const held = session.getItem(key);
  if (held) local.setItem(key, held);
  else local.removeItem(key);

  armDrain();
}

/** Manual sign-out: no browser copy of the session may survive. */
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
