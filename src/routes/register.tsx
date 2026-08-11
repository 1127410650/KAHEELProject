import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/register` is retired as a screen: account creation now lives in the single
 * canonical auth screen as its second tab. The URL is kept (bookmarks, printed
 * invitations, search results) and redirects while preserving every query
 * parameter — most importantly `invite`, which selects the invite-only form.
 */
export const Route = createFileRoute("/register")({
  beforeLoad: ({ location }) => {
    const search = new URLSearchParams(location.searchStr ?? "");
    search.set("tab", "register");
    throw redirect({ href: `/auth?${search.toString()}`, replace: true });
  },
  component: () => null,
});
