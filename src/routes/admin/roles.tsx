import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old partial permissions screen was replaced by `/admin/access-control`,
 * which edits the full server-enforced permission catalog. Existing bookmarks
 * and links keep working through this redirect.
 */
export const Route = createFileRoute("/admin/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/access-control", replace: true });
  },
});
