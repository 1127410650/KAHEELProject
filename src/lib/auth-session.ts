/**
 * Session continuity helpers.
 *
 * The Supabase browser client already persists the session in `localStorage`
 * and refreshes the access token on its own. What used to break continuity was
 * our own code: route guards called `supabase.auth.getUser()` (a network call)
 * and treated ANY failure — an offline tab, a slow preview, a 5xx — as
 * "signed out", bouncing the user to `/auth`.
 *
 * `guardSession()` fixes exactly that: the local session is the source of truth
 * for "is there a session at all", and the network check can only revoke it when
 * the server explicitly rejects the token (invalid/expired refresh token,
 * disabled user), never when the request itself fails.
 */
import { supabase } from "@/integrations/supabase/client";

export type SessionGuardResult =
  | { status: "authenticated"; userId: string }
  | { status: "unauthenticated"; reason: "no-session" | "revoked" };

/** True when the auth server actively rejected the identity (not a network fault). */
function isRevocation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  const message = String((error as { message?: string }).message ?? "").toLowerCase();
  if (status === 401 || status === 403) return true;
  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("jwt expired") ||
    message.includes("user not found") ||
    message.includes("user is banned") ||
    message.includes("session not found")
  );
}

export async function guardSession(): Promise<SessionGuardResult> {
  const { data: local } = await supabase.auth.getSession();
  if (!local.session) return { status: "unauthenticated", reason: "no-session" };

  const { data, error } = await supabase.auth.getUser();
  if (data?.user) return { status: "authenticated", userId: data.user.id };
  if (isRevocation(error)) return { status: "unauthenticated", reason: "revoked" };

  // Transient failure (offline, timeout, 5xx): keep the restored session.
  return { status: "authenticated", userId: local.session.user.id };
}

const MANUAL_KEY = "tahqaq.auth.manualSignOut";

/** Marks the next SIGNED_OUT event as user-initiated, so no "session expired" notice shows. */
export function markManualSignOut() {
  try {
    window.sessionStorage.setItem(MANUAL_KEY, "1");
  } catch {
    /* private mode: at worst the notice appears once */
  }
}

export function consumeManualSignOut(): boolean {
  try {
    const flag = window.sessionStorage.getItem(MANUAL_KEY);
    window.sessionStorage.removeItem(MANUAL_KEY);
    return flag === "1";
  } catch {
    return false;
  }
}

/** Keys that survive sign-out / account switching: UI preferences, never account data. */
export const PRESERVED_LOCAL_KEYS = ["tahqaq.locale", "tahqaq.theme"];
