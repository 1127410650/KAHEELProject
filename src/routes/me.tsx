import { createFileRoute, redirect } from "@tanstack/react-router";

import { resolveIdentityLanding } from "@/lib/identity-landing";

/**
 * `/me` — retired personal dashboard, kept only as a central redirect.
 *
 * The old personal shell (حسابي الشخصي / طلباتي / مشاريعي / مستنداتي / الدعوات /
 * التنبيهات / الإعدادات الشخصية) was removed: every function now lives in exactly
 * one place. This route resolves the caller and forwards them to the single
 * approved destination, so no old link 404s and no old UI can be reopened.
 * The destination table lives in `identity-landing.ts`.
 *
 * It stays a client route (not a server 301) because the destination depends on
 * the caller; a cacheable 301 would pin one identity's answer for everyone.
 */
export const Route = createFileRoute("/me")({
  ssr: false,
  beforeLoad: async () => {
    const landing = await resolveIdentityLanding();
    if (!landing) throw redirect({ to: "/auth", replace: true });
    throw redirect({ href: landing.href, replace: true });
  },

  component: () => null,
});
