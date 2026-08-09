import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { guardSession } from "@/lib/auth-session";

/**
 * Single gate for the whole marketplace back office. Direct links to any
 * `/admin/*` URL now require a session before the page module renders; the
 * platform-admin / staff-permission check itself stays server-backed inside
 * `AdminShell` (`isPlatformAdmin`), which never reveals data to a non-admin.
 *
 * `ssr: false` (never `"data-only"`): the session lives in `localStorage`, so a
 * server-side guard has nothing to read, and with `"data-only"` the guard is not
 * re-run in the browser — a signed-out visitor then reaches the page module.
 */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const result = await guardSession();
    if (result.status !== "authenticated") {
      throw redirect({ to: "/auth", search: { next: location.href }, replace: true });
    }
  },

  component: () => <Outlet />,
});
