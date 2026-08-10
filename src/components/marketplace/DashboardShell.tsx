import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref } from "@/lib/mkt";
import { useRequireAccount } from "@/lib/mkt-account";
import { routeRuleFor } from "@/lib/routes-map";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { AccessDenied } from "@/components/AccessDenied";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/**
 * Account pages share only a title and a reading column. Navigation between them
 * lives in one place — the unified account menu in the header — so no page
 * repeats a tab bar on top of it.
 *
 * Every page here is private, so it also requires an active account context:
 * without one the user is sent to the account selection screen first. The
 * identity type and permission allowed on this URL come from the central route
 * map (`src/lib/routes-map.ts`), never from per-page copies of the rules.
 */
export function DashboardShell({
  title,
  children,
  narrow = false,
}: {
  title: string;
  children: ReactNode;
  /** Centred, reading-width column (~920px) for form pages. */
  narrow?: boolean;
}) {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const {
    account,
    loading: accountLoading,
    unavailable,
    can,
  } = useRequireAccount(t("market.entry.revoked"));

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const rule = routeRuleFor(pathname);

  useEffect(() => {
    if (!loading && !session) void navigate({ href: loginHref(currentPath()) });
  }, [loading, session, navigate]);

  const ready = !loading && !!session && !accountLoading && !!account;
  const allowed =
    !ready ||
    !rule ||
    (rule.allowed_identity_types.includes(account!.kind) &&
      (!rule.required_permission || can(rule.required_permission)));

  return (
    <MarketShell footer="none">
      <div
        className={
          narrow ? "mx-auto w-full max-w-[920px] px-[var(--page-x)] py-6" : "mx-auto w-full max-w-7xl px-[var(--page-x)] py-6"
        }
      >
        <header className="market-page-intro">
          <h1 className="text-page font-black text-foreground">{title}</h1>
          {account && (
            <p className="mt-1 truncate text-desc text-muted-foreground">
              {t("market.entry.workingUnder", {
                name: account.name || t("market.account.fallbackName"),
              })}
            </p>
          )}
        </header>

        <div className="mt-5">
          {unavailable && !account ? (
            // A failed account read is never a blank page and never a sign-out:
            // it says the connection failed, states the session is intact, and retries.
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-foreground">{t("market.entry.offline")}</p>
              <p className="text-desc text-muted-foreground">{t("market.entry.loadFailed")}</p>
              <Button
                type="button"
                className="min-h-11"
                onClick={() => {
                  if (typeof window !== "undefined") window.location.reload();
                }}
              >
                {t("market.entry.retry")}
              </Button>
            </div>
          ) : !ready ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : allowed ? (
            children
          ) : (
            <AccessDenied reason="forbidden" />
          )}
        </div>
      </div>
    </MarketShell>
  );
}
