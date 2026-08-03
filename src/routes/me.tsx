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

    try {
      const identity = await loadPlatformIdentity();
      if (identity.is_platform_admin && !identity.restricted) {
        throw redirect({ to: "/admin", replace: true });
      }
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      /* role lookup failed → fall through to the normal account flow */
    }

    const key = rememberedAccountKey();
    const account = key ? await verifyAccount(key) : null;
    if (!account) throw redirect({ to: "/choose-account", replace: true });
    throw redirect({
      to: account.kind === "business" ? "/dashboard/business" : "/dashboard/profile",
      replace: true,
    });
  },
  component: () => null,
});
