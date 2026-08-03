import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { guardSession } from "@/lib/auth-session";

/**
 * Single gate for the whole marketplace back office. Direct links to any
 * `/admin/*` URL now require a session before the page module renders; the
 * platform-admin / staff-permission check itself stays server-backed inside
 * `AdminShell` (`isPlatformAdmin`), which never reveals data to a non-admin.
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
