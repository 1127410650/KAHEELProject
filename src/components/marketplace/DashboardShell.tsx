import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref } from "@/lib/mkt";
import { useRequireAccount } from "@/lib/mkt-account";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account pages share only a title and a reading column. Navigation between them
 * lives in one place — the unified account menu in the header — so no page
 * repeats a tab bar on top of it.
 *
 * Every page here is private, so it also requires an active account context:
 * without one the user is sent to the account selection screen first.
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
  const { account, loading: accountLoading } = useRequireAccount(t("market.entry.revoked"));

  useEffect(() => {
    if (!loading && !session) void navigate({ href: loginHref(currentPath()) });
  }, [loading, session, navigate]);

  const ready = !loading && !!session && !accountLoading && !!account;

  return (
    <MarketShell footer="none">
      <div
        className={
          narrow
            ? "mx-auto w-full max-w-[920px] px-4 py-6"
            : "mx-auto w-full max-w-7xl px-4 py-6"
        }
      >
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {account && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {t("market.entry.workingUnder", {
              name: account.name || t("market.account.fallbackName"),
            })}
          </p>
        )}

        <div className="mt-5">
          {ready ? children : <Skeleton className="h-40 w-full rounded-xl" />}
        </div>
      </div>
    </MarketShell>
  );
}

