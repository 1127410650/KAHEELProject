import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared gate + tabs for the marketplace back office. Platform admins always get in;
 * `staffAccess` lets a page open the gate for staff holding a specific permission.
 */
export function AdminShell({
  title,
  children,
  staffAccess,
  staffChecking = false,
}: {
  title: string;
  children: ReactNode;
  staffAccess?: boolean | undefined;
  staffChecking?: boolean;
}) {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id],
    enabled: !!session,
    queryFn: isPlatformAdmin,
  });

  const allowed = !!session && (admin.data === true || staffAccess === true);
  const checking = loading || (!!session && (admin.isLoading || staffChecking));

  return (
    <MarketShell footer="none">
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
              to="/admin/listing-events"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.logTab")}
            </Link>
            <Link
              to="/admin/listing-reports"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.listingReports")}
            </Link>
            <Link
              to="/admin/verifications"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.verifications")}
            </Link>
            <Link
              to="/admin/activities"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.activities")}
            </Link>
            <Link
              to="/admin/geo"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.geo")}
            </Link>

            <Link
              to="/admin/reports"
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t("market.admin.reports")}
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
