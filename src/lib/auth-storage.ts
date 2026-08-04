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

  // Session-only mode: keep the browser-session copy in step with the token the
  // client just wrote/refreshed. The permanent copy is dropped on `pagehide`
  // (see `armDrain`), so nothing durable outlives the browser session.
  const fromLocal = local.getItem(key);
  if (fromLocal) session.setItem(key, fromLocal);
  else session.removeItem(key);
  // The mode can be switched mid-session (unchecking the box on the sign-in
  // page after boot), so the drain is armed here too — not only on boot.
  armDrain();
}

let drainArmed = false;

/**
 * In session-only mode nothing durable may survive the browser session: on
 * `pagehide` the token is handed to sessionStorage and removed from
 * localStorage. Registered at most once per page.
 */
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
  if (held) {
    local.setItem(key, held);
  } else {
    // Switching to session-only mode while already signed in must not sign the
    // user out: adopt the durable entry into the browser-session scope instead
    // of deleting it. The `pagehide` drain then keeps it from outliving the
    // browser session.
    const durable = local.getItem(key);
    if (durable) session.setItem(key, durable);
  }


  armDrain();
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

