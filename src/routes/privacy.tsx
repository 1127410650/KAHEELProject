import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  beforeLoad: () => {
    throw redirect({ href: "/about#privacy", replace: true });
  },
  component: () => null,
});
