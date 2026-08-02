import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { logLegacyRoute, resolveLegacyTarget } from "@/lib/routes-map";

/**
 * Central legacy-route resolver (`LegacyRouteRedirect`).
 *
 * Instead of registering one route file per retired URL (`/marketplace`,
 * `/login`, `/signin`, `/home`, …) every unmatched path lands here:
 *  - a path listed as `legacy` in `routes-map.ts` is redirected to its canonical
 *    path, keeping the query string and the hash (return path, item id, mode…);
 *  - anything else falls through to the root 404 page.
 *
 * A redirect never bypasses protection: the canonical route runs its own guard
 * (sign-in, active account, membership, permission) exactly as for a direct hit.
 */
export const Route = createFileRoute("/$")({
  ssr: false,
  beforeLoad: ({ location }) => {
    const target = resolveLegacyTarget(location.pathname);
    if (!target) throw notFound();
    logLegacyRoute(location.pathname);
    const rest = `${location.searchStr ?? ""}${location.hash ? `#${location.hash}` : ""}`;
    throw redirect({ href: `${target}${rest}`, replace: true });
  },
  component: () => null,
});
