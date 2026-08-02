import { createFileRoute, redirect } from "@tanstack/react-router";

import { logLegacyRoute } from "@/lib/routes-map";

/**
 * Legacy alias: `/marketplace` rendered the exact same home page as `/`.
 * It now redirects to the canonical route, keeping any query string, and records
 * the hit locally so the alias can be retired once it stops being used.
 */
export const Route = createFileRoute("/marketplace")({
  ssr: false,
  beforeLoad: () => {
    logLegacyRoute("/marketplace");
    const search =
      typeof window !== "undefined"
        ? Object.fromEntries(new URLSearchParams(window.location.search).entries())
        : {};
    throw redirect({ to: "/", search, replace: true });
  },
  component: () => null,
});
