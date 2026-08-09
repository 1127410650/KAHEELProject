import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { guardSession } from "@/lib/auth-session";

/**
 * Single gate for the work-account area (`/business/*`): the operations board,
 * the business profile, orders, the store and the service pages.
 *
 * Same contract as `/my`: session only, resolved before any page module loads so
 * a signed-out visitor never sees a flash of a private screen. Whether the active
 * account is actually a business, and whether it is approved and permitted, is
 * still decided by `DashboardShell` + `src/lib/routes-map.ts`, and only the
 * database (RLS) grants anything.
 *
 * `ssr: "data-only"` because the Supabase session lives in `localStorage`: the
 * subtree renders on the client only (a server render would have to guess), while
 * a plain `ssr: false` also made the client insert a Suspense boundary the server
 * HTML never had — a hydration mismatch on every page of this area.
 */
export const Route = createFileRoute("/business")({
  ssr: "data-only",
  beforeLoad: async ({ location }) => {
    // The Supabase session lives in `localStorage`, so the server cannot answer
    // this question: gating there would bounce every hard refresh to `/auth`.
    // The subtree renders on the client only (`ssr: "data-only"`), so the gate
    // still runs before any page module loads.
    if (typeof window === "undefined") return;
    const result = await guardSession();
    if (result.status !== "authenticated") {
      throw redirect({ to: "/auth", search: { next: location.href }, replace: true });
    }
  },

  component: () => <Outlet />,
});
