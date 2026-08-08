import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  beforeLoad: () => {
    throw redirect({ href: "/about#terms", replace: true });
  },
  component: () => null,
});
