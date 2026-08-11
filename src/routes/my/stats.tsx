/**
 * إحصاءات حسابي — نفس سياق الحساب النشط في لوحة المالك.
 *
 * كل الأرقام تأتي مجمّعة من دالة واحدة تحلّ الملكية على الخادم، فلا يمرّ أي
 * معرّف مالك من المتصفح ولا تُقرأ أحداث خام في العميل. الحساب الفردي يقيس
 * إعلاناته، وحساب المنشأة يقيس إعلانات الكيان بشرط عضوية نشطة.
 */
import { useMemo, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, Heart, PhoneCall, Share2, Users } from "lucide-react";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import { useActiveAccount } from "@/lib/mkt-account";
import {
  OWNER_ANALYTICS_RANGES,
  useOwnerAnalytics,
  type OwnerAnalyticsRange,
} from "@/lib/mkt-owner-analytics";

export const Route = createFileRoute("/my/stats")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "إحصاءات حسابي — كَحيل" },
      {
        name: "description",
        content: "مشاهدات إعلاناتك وزيارات التفاصيل ونقرات التواصل والمفضلة والمشاركات.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerStatsPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: number;
  icon: typeof Eye;
  note?: string;
}) {
  return (
    <div className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)] shadow-panel">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        <span className="text-desc font-semibold">{label}</span>
      </div>
      <p className="mt-1 text-page font-black tabular-nums text-foreground" dir="ltr">
        {formatNumber(value)}
      </p>
      {note ? <p className="mt-1 text-nav text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function OwnerStatsPage() {
  const { account } = useActiveAccount();
  const [days, setDays] = useState<OwnerAnalyticsRange>(30);
  const tenantId = account?.kind === "business" ? account.tenant_id : null;

  const stats = useOwnerAnalytics({ days, tenantId, enabled: !!account });

  const topIds = useMemo(
    () => (stats.data?.top_listings ?? []).map((row) => row.listing_id),
    [stats.data],
  );

  /** العناوين تُقرأ بصلاحية المالك نفسه (RLS) — لا تكشف الدالة أي عنوان. */
  const titles = useQuery({
    queryKey: ["mkt", "owner-analytics-titles", topIds],
    enabled: topIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_listings")
        .select("id, title")
        .in("id", topIds);
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.id, row.title as string]));
    },
  });

  const totals = stats.data?.totals;
  const maxSessions = Math.max(1, ...(stats.data?.daily ?? []).map((d) => d.sessions));

  return (
    <DashboardShell title="إحصاءات حسابي">
      <div className="mb-[var(--sp-4)] flex flex-wrap items-center gap-2">
        {OWNER_ANALYTICS_RANGES.map((range) => (
          <Button
            key={range}
            size="sm"
            variant={days === range ? "default" : "outline"}
            style={{ minHeight: 44 }}
            onClick={() => setDays(range)}
          >
            آخر <span dir="ltr">{formatNumber(range)}</span> يومًا
          </Button>
        ))}
        {stats.data?.from ? (
          <span className="text-desc text-muted-foreground">
            من {formatDate(stats.data.from)}
          </span>
        ) : null}
      </div>

      {stats.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--r-card)]" />
          ))}
        </div>
      ) : stats.isError ? (
        <p className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)] text-body text-muted-foreground">
          تعذّر تحميل الإحصاءات الآن. حدّث الصفحة بعد قليل.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="مرات الظهور"
              value={totals?.impressions ?? 0}
              icon={BarChart3}
              note="تُحتسب حيث يُسجّل الظهور في القوائم."
            />
            <StatCard label="زيارات التفاصيل" value={totals?.detail_visits ?? 0} icon={Eye} />
            <StatCard label="نقرات التواصل" value={totals?.contact_clicks ?? 0} icon={PhoneCall} />
            <StatCard label="الإضافة للمفضلة" value={totals?.favorites ?? 0} icon={Heart} />
            <StatCard label="المشاركات" value={totals?.shares ?? 0} icon={Share2} />
            <StatCard
              label="الجلسات"
              value={totals?.sessions ?? 0}
              icon={Users}
              note="زيارات الفريق والحسابات التجريبية غير محتسبة."
            />
          </div>

          <section className="mt-[var(--sp-6)] rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)] shadow-panel">
            <h2 className="text-section font-extrabold text-foreground">الجلسات يوميًا</h2>
            {(stats.data?.daily ?? []).length === 0 ? (
              <p className="mt-2 text-body text-muted-foreground">
                لا توجد زيارات مسجّلة في هذه الفترة.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {(stats.data?.daily ?? []).map((row) => (
                  <li key={row.day} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-nav text-muted-foreground" dir="ltr">
                      {formatDate(row.day)}
                    </span>
                    <span
                      aria-hidden
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.round((row.sessions / maxSessions) * 100)}%` }}
                    />
                    <span className="text-nav font-bold tabular-nums text-foreground" dir="ltr">
                      {formatNumber(row.sessions)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-[var(--sp-6)] grid gap-[var(--sp-4)] lg:grid-cols-2">
            <section className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)] shadow-panel">
              <h2 className="text-section font-extrabold text-foreground">الدول</h2>
              <p className="mt-1 text-nav text-muted-foreground">
                الشرائح الصغيرة تُدمج في «أخرى» حفظًا للخصوصية.
              </p>
              {(stats.data?.countries ?? []).length === 0 ? (
                <p className="mt-2 text-body text-muted-foreground">لا بيانات بعد.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {(stats.data?.countries ?? []).map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-2">
                      <span className="text-body text-foreground">{row.label}</span>
                      <span className="text-body font-bold tabular-nums" dir="ltr">
                        {formatNumber(row.sessions)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)] shadow-panel">
              <h2 className="text-section font-extrabold text-foreground">أكثر إعلاناتك زيارة</h2>
              {(stats.data?.top_listings ?? []).length === 0 ? (
                <p className="mt-2 text-body text-muted-foreground">
                  يظهر هنا الإعلان بعد بلوغه 5 جلسات على الأقل.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {(stats.data?.top_listings ?? []).map((row) => (
                    <li key={row.listing_id} className="flex items-center justify-between gap-2">
                      <Link
                        to="/my/ads/$id/edit"
                        params={{ id: row.listing_id }}
                        className="min-h-11 content-center truncate text-body text-foreground underline decoration-dotted underline-offset-4"
                      >
                        {titles.data?.get(row.listing_id) ?? "إعلان"}
                      </Link>
                      <span className="shrink-0 text-nav tabular-nums text-muted-foreground" dir="ltr">
                        {formatNumber(row.detail_visits)} / {formatNumber(row.contact_clicks)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
