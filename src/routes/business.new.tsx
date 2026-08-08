import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy bookmark kept for compatibility. Store/provider creation now always
 * enters the reviewed onboarding flow, so an unapproved work account can never
 * become operational merely by opening the old form URL.
 */
export const Route = createFileRoute("/business/new")({
  beforeLoad: () => {
    throw redirect({ href: "/join?kind=seller", replace: true });
  },
  component: () => null,
});
