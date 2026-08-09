import { supabase } from "@/integrations/supabase/client";
import { rememberedAccountKey, verifyAccount } from "@/lib/mkt-account";
import { loadPlatformIdentity } from "@/lib/mkt-platform";

/**
 * Single resolver for "where does *this* caller belong?".
 *
 * `/go` is the only route that asks: its destination depends on who is asking, so
 * it can never become a cacheable server 301 — a permanent redirect would pin one
 * identity's destination for everybody. The retired `/me` and `/audit` shells now
 * 301 to `/go`, which delegates here, so the answer lives in exactly one place.
 *
 * The returned path grants nothing: every destination runs its own guard.
 */
export type LandingTarget = {
  /** Destination path, ready to hand to `redirect({ href })`. */
  href: string;
  /** True when the caller is an unrestricted platform admin. */
  isAdmin: boolean;
};

/** `null` means: no session, the caller must sign in first. */
export async function resolveIdentityLanding(): Promise<LandingTarget | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  let isAdmin = false;
  try {
    const identity = await loadPlatformIdentity();
    isAdmin = identity.is_platform_admin && !identity.restricted;
  } catch {
    /* role lookup failed → fall through to the normal account flow */
  }

  if (isAdmin) return { href: "/admin", isAdmin: true };

  // No account chosen yet → the picker, carrying the personal profile as the
  // destination so the user never lands back on a retired screen.
  let href = "/choose-account?next=%2Fmy%2Fprofile";
  const key = rememberedAccountKey();
  const account = key ? await verifyAccount(key) : null;
  if (account) {
    const { data: storefronts } = await supabase.rpc("mkt_my_storefront", {
      _account_key: account.account_key,
    });
    if (storefronts?.[0]) {
      href = "/business";
    } else {
      href = account.kind === "business" ? "/business/profile" : "/my/profile";
    }
  }

  return { href, isAdmin: false };
}
