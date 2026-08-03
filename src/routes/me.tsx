import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { rememberedAccountKey, verifyAccount } from "@/lib/mkt-account";
import { loadPlatformIdentity } from "@/lib/mkt-platform";

/**
 * `/me` — retired personal dashboard, kept only as a central redirect.
 *
 * The old personal shell (حسابي الشخصي / طلباتي / مشاريعي / مستنداتي / الدعوات /
 * التنبيهات / الإعدادات الشخصية) was removed: every function now lives in exactly
 * one place. This route resolves the caller server-side and forwards them to the
 * single approved destination, so no old link 404s and no old UI can be reopened:
 *  - platform admin        → `/admin`
 *  - business account      → `/dashboard/business`
 *  - personal account      → `/dashboard/profile`
 *  - no account chosen yet → `/choose-account`
 *  - signed out            → `/auth`
 *
 * The redirect grants nothing: each destination runs its own guard.
 */
export const Route = createFileRoute("/me")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", replace: true });

    // The destination is decided first and thrown once, so a redirect can never be
    // swallowed by the error handling around the role lookup.
    let target = "/choose-account";
    let isAdmin = false;
    try {
      const identity = await loadPlatformIdentity();
      isAdmin = identity.is_platform_admin && !identity.restricted;
    } catch {
      /* role lookup failed → fall through to the normal account flow */
    }

    if (isAdmin) {
      target = "/admin";
    } else {
      const key = rememberedAccountKey();
      const account = key ? await verifyAccount(key) : null;
      if (account) {
        target = account.kind === "business" ? "/dashboard/business" : "/dashboard/profile";
      }
    }

    throw redirect({ href: target, replace: true });
  },

  component: () => null,
});
