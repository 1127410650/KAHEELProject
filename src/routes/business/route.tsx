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
 * `ssr: false` because the Supabase session lives in `localStorage`: gating this
 * subtree on the server would redirect every hard refresh to `/auth`. It must stay
 * `false` and not `"data-only"`: with `"data-only"` the guard runs on the server
 * (where there is no session to see) and is NOT re-run in the browser, so a
 * signed-out visitor reaches the page module — verified in the browser.
 */
export const Route = createFileRoute("/business")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const result = await guardSession();
    if (result.status !== "authenticated") {
      throw redirect({ to: "/auth", search: { next: location.href }, replace: true });
    }
  },

  component: () => <Outlet />,
});
