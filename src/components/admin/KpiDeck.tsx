/**
 * سطح مؤشرات الأداء (KPI Deck) — أرقام حقيقية من الجداول، مع مفتاح المدى
 * (اليوم / ٧ أيام / ٣٠ يومًا) ومفتاح «مع التجريبي»، وكل بطاقة تفتح شاشتها.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminCard } from "@/components/admin/AdminPage";
import { Sparkline } from "@/components/admin/Sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGmKpis, type KpiRange } from "@/lib/mkt-gm-dashboard";
import { formatNumber } from "@/lib/format";

const RANGES: { key: KpiRange; labelKey: string }[] = [
  { key: 1, labelKey: "admin.gm.range.today" },
  { key: 7, labelKey: "admin.gm.range.week" },
  { key: 30, labelKey: "admin.gm.range.month" },
];

export function KpiDeck() {
  const { t } = useI18n();
  const [range, setRange] = useState<KpiRange>(7);
  const [includeDemo, setIncludeDemo] = useState(false);

  const kpis = useQuery({
    queryKey: ["mkt", "admin", "gm", "kpis", range, includeDemo],
    queryFn: () => loadGmKpis(range, includeDemo),
  });

  const data = kpis.data;

  const cards: { key: string; value: string; hint?: string; points: number[]; to: string }[] = data
    ? [
        {
          key: "admin.gm.kpi.users",
          value: formatNumber(data.newUsers.total),
          points: data.newUsers.points,
          to: "/admin/users",
        },
        {
          key: "admin.gm.kpi.listings",
          value: formatNumber(data.newListings.total),
          hint: data.listingsByCategory
            .slice(0, 3)
            .map((row) => `${row.label} ${formatNumber(row.count)}`)
            .join(" · "),
          points: data.newListings.points,
          to: "/admin/listings",
        },
        {
          key: "admin.gm.kpi.errands",
          value: formatNumber(data.errands.total),
          points: data.errands.points,
          to: "/admin/errands",
        },
        {
          key: "admin.gm.kpi.serviceBookings",
          value: formatNumber(data.serviceBookings.total),
          points: data.serviceBookings.points,
          to: "/admin/stores",
        },
        {
          key: "admin.gm.kpi.aqarBookings",
          value: formatNumber(data.aqarBookings.total),
          points: data.aqarBookings.points,
          to: "/admin/listings",
        },
        {
          key: "admin.gm.kpi.conversations",
          value: formatNumber(data.conversations.total),
          points: data.conversations.points,
          to: "/admin/moderation",
        },
        {
          key: "admin.gm.kpi.campaigns",
          value: `${formatNumber(data.campaignClicks)} / ${formatNumber(data.campaignImpressions)}`,
          hint: `CTR ${data.campaignCtr.toFixed(2)}%`,
          points: [],
          to: "/admin/campaigns",
        },
        {
          key: "admin.gm.kpi.topups",
          value: formatNumber(data.topupsPending),
          hint: `${formatNumber(Math.round(data.topupsPendingAmount))} SAR`,
          points: [],
          to: "/admin/ad-credit",
        },
        {
          key: "admin.gm.kpi.reviews",
          value: formatNumber(data.reviews.total),
          points: data.reviews.points,
          to: "/admin/moderation",
        },
      ]
    : [];

  return (
    <AdminCard
      className="mt-[var(--sp-4)]"
      title={t("admin.gm.kpi.title")}
      description={t("admin.gm.kpi.hint")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[var(--r-chip,12px)] border border-border p-0.5">
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={
                  "min-h-9 rounded-[var(--r-chip,12px)] px-3 text-[14px] font-bold " +
                  (range === item.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground")
                }
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIncludeDemo((value) => !value)}
            className={
              "k-press min-h-9 rounded-[var(--r-chip,12px)] border px-3 text-[14px] font-bold " +
              (includeDemo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground")
            }
            aria-pressed={includeDemo}
          >
            {t("admin.gm.kpi.withDemo")}
          </button>
        </div>
      }
    >
      {kpis.isLoading ? (
        <div className="grid grid-cols-1 gap-[var(--sp-3)] sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-[var(--r-card)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--sp-3)] sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.key}
              to={card.to}
              className="k-press k-fade-up group min-w-0 rounded-[var(--r-card)] border border-border bg-secondary/40 p-[var(--sp-3)]"
            >
              <span className="flex items-center gap-1 text-[14px] text-muted-foreground">
                <span className="truncate">{t(card.key)}</span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </span>
              <span className="mt-1 block truncate text-[20px] font-black tabular-nums text-foreground">
                {card.value}
              </span>
              {card.hint ? (
                <span className="mt-0.5 block truncate text-[14px] text-muted-foreground">
                  {card.hint}
                </span>
              ) : null}
              {card.points.length > 1 ? <Sparkline points={card.points} /> : null}
            </Link>
          ))}
        </div>
      )}
    </AdminCard>
  );
}
