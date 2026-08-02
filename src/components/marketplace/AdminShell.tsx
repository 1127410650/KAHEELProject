import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared gate + tabs for the marketplace back office. Only platform admins get in. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id],
    enabled: !!session,
    queryFn: isPlatformAdmin,
  });

  const allowed = !!session && admin.data === true;
  const checking = loading || (!!session && admin.isLoading);

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {allowed && (
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Link
              to="/admin/listings"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.listings")}
            </Link>
            <Link
              to="/admin/verifications"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.verifications")}
            </Link>
          </nav>
        )}
        <div className="mt-5">
          {checking ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : allowed ? (
            children
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <ShieldAlert className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-medium text-foreground">{t("market.admin.denied")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("market.admin.deniedHint")}</p>
            </div>
          )}
        </div>
      </div>
    </MarketShell>
  );
}
