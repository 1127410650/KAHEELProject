import { createFileRoute, redirect } from "@tanstack/react-router";

import { resolveIdentityLanding } from "@/lib/identity-landing";

/**
 * `/audit` — retired internal operations console, kept only as a redirect.
 *
 * The old internal system (لوحة التحكم / المشرفون / المشاريع / العهد / الطلبات /
 * الموردون / الفواتير / المنتجات / التقارير / المستخدمون / الأعضاء / المحذوفات /
 * سجل العمليات) and its sidebar shell were removed. There is now exactly one
 * back office: `/admin` (`AdminShell`).
 *
 *  - platform admin → `/admin/audit-log` (the single operations log)
 *  - signed-in user → their own approved destination (`identity-landing.ts`)
 *  - signed out     → `/auth`
 *
 * Client route rather than a server 301 for the same reason as `/me`: the
 * destination depends on the caller. The redirect grants nothing.
 */
export const Route = createFileRoute("/audit")({
  ssr: false,
  beforeLoad: async () => {
    const landing = await resolveIdentityLanding();
    if (!landing) throw redirect({ to: "/auth", replace: true });
    throw redirect({
      href: landing.isAdmin ? "/admin/audit-log" : landing.href,
      replace: true,
    });
  },

  component: () => null,
});
