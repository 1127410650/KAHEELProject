import { createFileRoute, redirect } from "@tanstack/react-router";

import { safeInternalPath } from "@/lib/mkt";

/**
 * Public alias for the sign-in page. Keeps the visitor's return path so that after
 * signing in they land back on the same listing with their action re-opened.
 */
export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: () => {
    const raw = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    const next = safeInternalPath(raw);
    throw redirect({ to: "/auth", search: next ? { next } : {}, replace: true });
  },
  component: () => null,
});
