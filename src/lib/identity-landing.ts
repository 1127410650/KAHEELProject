import { supabase } from "@/integrations/supabase/client";
import { rememberedAccountKey, verifyAccount } from "@/lib/mkt-account";
import { loadPlatformIdentity } from "@/lib/mkt-platform";

/**
 * Single resolver for "where does *this* caller belong?".
 *
 * `/me` and `/audit` are the two legacy entry points that cannot become server
 * 301s, because their destination depends on who is asking — a cacheable
 * permanent redirect would pin one identity's destination for everybody. They
 * both delegate here so the answer is defined in exactly one place.
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

  // No account chosen yet → the picker, carrying the personal dashboard as the
  // destination so the user never lands back on a retired screen.
  let href = "/choose-account?next=%2Fdashboard%2Fprofile";
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
