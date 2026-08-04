/**
 * The single manual sign-out path of the app.
 *
 * Every sign-out affordance (marketplace account menu, admin sidebar, account
 * picker) calls this one hook, so the order of operations can never drift:
 *
 *  1. flag the sign-out as user-initiated → no "session expired" notice,
 *  2. forget the active account choice (never the language/theme preferences),
 *  3. cancel in-flight queries and drop the cache, so no 401 storm and no
 *     back-button shell hydrated from protected data,
 *  4. clear the Supabase session (both storage scopes),
 *  5. land on the public landing page with a history REPLACE.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { markManualSignOut } from "@/lib/auth-session";
import { clearAuthStorage } from "@/lib/auth-storage";

/** Active-account memory key owned by `src/lib/mkt-account.tsx`. */
const ACCOUNT_KEY = "tahqaq.mkt.account";

let signingOut = false;

/**
 * True from the moment a manual sign-out starts until the browser leaves the
 * page. Session-dependent redirects (the account picker sending signed-out
 * visitors to `/auth`) must stand down while this is true, otherwise they race
 * the sign-out navigation and the user lands on the sign-in page instead of the
 * public landing page.
 */
export function isSigningOut(): boolean {
  return signingOut;
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async function signOut() {
    signingOut = true;
    markManualSignOut();
    try {
      window.localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      /* private mode: the choice is re-validated next session anyway */
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    clearAuthStorage();
    await navigate({ to: "/welcome", replace: true }).catch(() => {
      if (typeof window !== "undefined") window.location.replace("/welcome");
    });
    signingOut = false;
  };
}
