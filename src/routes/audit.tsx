import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { loadPlatformIdentity } from "@/lib/mkt-platform";

/**
 * `/audit` — retired internal operations console, kept only as a redirect.
 *
 * The old internal system (لوحة التحكم / المشرفون / المشاريع / العهد / الطلبات /
 * الموردون / الفواتير / المنتجات / التقارير / المستخدمون / الأعضاء / المحذوفات /
 * سجل العمليات) and its sidebar shell were removed. Historical data stays in the
 * database untouched; only the old UI is gone. There is now exactly one back
 * office: `/admin` (`AdminShell`).
 *
 *  - platform admin → `/admin/audit-log` (the single operations log)
 *  - signed-in user → `/me`, which resolves their own approved destination
 *  - signed out     → `/auth`
 *
 * The redirect grants nothing: the destination runs its own guard.
 */
export const Route = createFileRoute("/audit")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", replace: true });

    let isAdmin = false;
    try {
      const identity = await loadPlatformIdentity();
      isAdmin = identity.is_platform_admin && !identity.restricted;
    } catch {
      /* role lookup failed → fall back to the normal user destination */
    }

    throw redirect({ href: isAdmin ? "/admin/audit-log" : "/me", replace: true });
  },

  component: () => null,
});
