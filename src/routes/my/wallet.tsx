import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Coins } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount } from "@/lib/mkt-account";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/my/wallet")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "نقاطي — كَحيل" },
      { name: "description", content: "رصيد نقاطك وسجل عمليات الترويج في كَحيل." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PointsPage,
});

const PAGE_SIZE = 20;

function PointsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const [page, setPage] = useState(0);

  const accountType = account?.kind === "business" ? "business" : "user";
  const accountId = account?.kind === "business" ? account.tenant_id : session?.user.id;

  const wallet = useQuery({
    queryKey: ["mkt", "wallet", accountType, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_point_wallets")
        .select("id, balance_points, lifetime_spent, lifetime_granted")
        .eq("account_type", accountType)
        .eq("account_id", accountId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ledger = useQuery({
    queryKey: ["mkt", "wallet-ledger", wallet.data?.id, page],
    enabled: !!wallet.data?.id,
    queryFn: async () => {
      const walletId = wallet.data!.id;
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("mkt_point_ledger")
        .select(
          "id, direction, points, balance_after, kind, reason, listing_id, created_at",
        )
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = data ?? [];
      const listingIds = Array.from(
        new Set(rows.map((r) => r.listing_id).filter((v): v is string => !!v)),
      );
      const titles = new Map<string, string>();
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from("mkt_listings")
          .select("id, title")
          .in("id", listingIds);
        for (const l of listings ?? []) titles.set(l.id, l.title);
      }
      return rows.map((r) => ({ ...r, listingTitle: r.listing_id ? titles.get(r.listing_id) ?? null : null }));
    },
  });

  return (
    <DashboardShell title={t("market.points.title")}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-desc text-muted-foreground">
            <Coins className="size-3.5 text-primary" aria-hidden />
            {t("market.points.balance")}
          </p>
          {wallet.isLoading ? (
            <Skeleton className="mt-1.5 h-6 w-16" />
          ) : (
            <p className="mt-1 text-xl font-bold text-foreground" dir="ltr">
              {formatNumber(wallet.data?.balance_points ?? 0)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-desc text-muted-foreground">{t("market.points.lifetimeSpent")}</p>
          {wallet.isLoading ? (
            <Skeleton className="mt-1.5 h-6 w-16" />
          ) : (
            <p className="mt-1 text-xl font-bold text-foreground" dir="ltr">
              {formatNumber(wallet.data?.lifetime_spent ?? 0)}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-foreground">{t("market.points.ledger")}</h2>

      {ledger.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (ledger.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("market.points.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {(ledger.data ?? []).map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                  row.direction === "credit"
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {row.direction === "credit" ? (
                  <ArrowDownLeft className="size-4" aria-hidden />
                ) : (
                  <ArrowUpRight className="size-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {t(`market.points.kind.${row.kind}`)}
                  {row.listingTitle ? ` · ${row.listingTitle}` : ""}
                </span>
                <span className="block text-desc text-muted-foreground" dir="ltr">
                  {formatDateTime(row.created_at)}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span
                  className={`block text-sm font-semibold ${
                    row.direction === "credit" ? "text-primary" : "text-destructive"
                  }`}
                  dir="ltr"
                >
                  {row.direction === "credit" ? "+" : "-"}
                  {formatNumber(row.points)}
                </span>
                <span className="block text-desc text-muted-foreground" dir="ltr">
                  {formatNumber(row.balance_after)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {t("common.previous")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={(ledger.data ?? []).length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("common.next")}
        </Button>
      </div>

      <Link
        to="/my/ads"
        className="mt-6 inline-block text-desc font-medium text-primary hover:underline"
      >
        {t("market.dash.myAds")}
      </Link>
    </DashboardShell>
  );
}
