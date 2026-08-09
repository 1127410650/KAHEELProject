import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { guardSession } from "@/lib/auth-session";

/**
 * Single gate for the personal account area (`/my/*`).
 *
 * Every page used to repeat the sign-in check inside `DashboardShell`, which runs
 * only after the page module has already loaded and rendered. One parent layout
 * means a direct link to any account URL is resolved before its module is
 * fetched, so a signed-out visitor never sees a flash of a private screen.
 *
 * The gate stays deliberately thin — session only. The account context, the
 * identity type allowed on the URL and the permission check remain in
 * `DashboardShell` + `src/lib/routes-map.ts`, which are the single source for
 * those rules, and the database (RLS) is still the only authority that grants
 * anything.
 *
 * `ssr: "data-only"` because the Supabase session lives in `localStorage`: the
 * subtree renders on the client only (a server render would have to guess), while
 * a plain `ssr: false` also made the client insert a Suspense boundary the server
 * HTML never had — a hydration mismatch on every page of this area.
 */
export const Route = createFileRoute("/my")({
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

    // `/my` itself is not a page: the right landing screen depends on the caller
    // (admin console / work account / personal account), and `/go` resolves that
    // in one place.
    const path = location.pathname.replace(/\/+$/, "");
    if (path === "/my") throw redirect({ to: "/go", replace: true });
  },

  component: () => <Outlet />,
});
