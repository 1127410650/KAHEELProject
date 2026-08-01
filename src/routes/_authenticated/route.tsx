import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";

/**
 * This subtree is client-only (ssr: false), so the server sends an empty shell.
 * Rendering nothing on the very first client pass keeps hydration byte-identical
 * and avoids React's "server rendered HTML didn't match" recovery warning.
 */
function AuthenticatedShell() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedShell,
});

