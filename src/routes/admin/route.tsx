import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Single gate for the whole marketplace back office. Direct links to any
 * `/admin/*` URL now require a session before the page module renders; the
 * platform-admin / staff-permission check itself stays server-backed inside
 * `AdminShell` (`isPlatformAdmin`), which never reveals data to a non-admin.
 */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.href }, replace: true });
    }
  },
  component: () => <Outlet />,
});
