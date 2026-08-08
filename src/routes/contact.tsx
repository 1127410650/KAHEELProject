import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  beforeLoad: () => {
    throw redirect({ href: "/help#contact", replace: true });
  },
  component: () => null,
});
