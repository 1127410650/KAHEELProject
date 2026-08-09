import { createFileRoute, redirect } from "@tanstack/react-router";

import { resolveIdentityLanding } from "@/lib/identity-landing";

type GoSearch = { next?: string | undefined };

/**
 * `/go` — the one entry point that answers "where do I belong?".
 *
 * It replaces the two retired shells `/me` (personal dashboard) and `/audit`
 * (internal operations console), which each carried their own copy of the same
 * resolution logic. Both old URLs now 301 here, and the answer is computed in a
 * single place (`identity-landing.ts`):
 *
 *  - platform admin → `/admin` (or `/admin/audit-log` for `?next=audit-log`)
 *  - signed-in user → their approved destination
 *  - signed out     → `/auth`
 *
 * Client-side (`ssr: false`) on purpose: the session lives in `localStorage`, so
 * the server cannot resolve the caller, and the destination must never be
 * cached — a 301 from here would pin one identity's landing page for everyone.
 * The redirect grants nothing: every destination runs its own guard.
 */
export const Route = createFileRoute("/go")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): GoSearch => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "التوجيه — كَحيل" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ search }) => {
    const landing = await resolveIdentityLanding();
    if (!landing) throw redirect({ to: "/auth", replace: true });

    // `?next=audit-log` is the only accepted hint, and only an admin can use it —
    // an arbitrary `next` path is ignored rather than followed, so this route can
    // never be used to bounce a signed-in user to an attacker-chosen URL.
    const href =
      landing.isAdmin && search.next === "audit-log" ? "/admin/audit-log" : landing.href;
    throw redirect({ href, replace: true });
  },
  component: () => null,
});
