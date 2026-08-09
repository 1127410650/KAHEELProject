import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { isSafeInternalPath, safeInternalPath } from "@/lib/safe-next";
import { isSigningOut } from "@/lib/auth-signout";

interface ChooseSearch {
  next?: string | undefined;
}

/**
 * Legacy compatibility route. The marketplace no longer asks users to choose a
 * publishing identity. It silently uses the personal account and returns to the
 * requested page.
 */
export const Route = createFileRoute("/choose-account")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>): ChooseSearch => {
    const raw = search["next"];
    return typeof raw === "string" && isSafeInternalPath(raw) ? { next: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "جاري فتح الحساب — گحيل" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseAccountRedirect,
});

function ChooseAccountRedirect() {
  const { session, loading: sessionLoading } = useSession();
  const { next: rawNext } = Route.useSearch();
  const navigate = useNavigate();
  const { accounts, account: activeAccount, loading, select } = useActiveAccount();

  const safeNext = safeInternalPath(isSafeInternalPath(rawNext) ? rawNext : undefined);
  const target = safeNext.startsWith("/choose-account") ? "/" : safeNext;

  useEffect(() => {
    if (sessionLoading || loading) return;

    if (!session && !isSigningOut()) {
      const back = `/choose-account?next=${encodeURIComponent(target)}`;
      void navigate({ href: `/auth?next=${encodeURIComponent(back)}`, replace: true });
      return;
    }

    if (!session) return;

    const personal = accounts.find((item) => item.kind === "individual");
    const preferred = personal ?? activeAccount ?? accounts[0];

    if (!preferred) {
      void navigate({ href: target, replace: true });
      return;
    }

    if (activeAccount?.account_key === preferred.account_key) {
      void navigate({ href: target, replace: true });
      return;
    }

    let cancelled = false;
    void select(preferred.account_key).finally(() => {
      if (!cancelled) void navigate({ href: target, replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [
    sessionLoading,
    loading,
    session,
    accounts,
    activeAccount,
    select,
    navigate,
    target,
  ]);

  return (
    <div className="market-surface grid min-h-dvh place-items-center px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span>جاري فتح حسابك…</span>
      </div>
    </div>
  );
}
