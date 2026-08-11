/**
 * تحليلات المدير — /admin/analytics
 *
 * الأرقام من التتبع الموحّد فقط، ومستبعَد منها افتراضيًا: أحداث الاختبار،
 * الحسابات التجريبية، وحركة فريق العمل (مع خيار إظهارها للمقارنة).
 */
import { useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BarChart3, FlaskConical, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminCard, AdminEmptyState, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { getAnalyticsReport, purgeTestEvents, type AnalyticsReport } from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin/analytics/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "تحليلات المنصة — كَحيل" },
      { name: "description", content: "أحداث المنصة وجلساتها وأهم صفحاتها خلال المدة المختارة." },
      { property: "og:title", content: "تحليلات المنصة — كَحيل" },
      { property: "og:description", content: "لوحة أرقام التشغيل من محرك التتبع الموحّد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnalyticsPage,
});

const RANGES = [7, 30, 90] as const;

function Kpi({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-card)] border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-nav text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        {label}
      </div>
      <p className="mt-1 text-[22px] font-black text-foreground" dir="ltr">
        {value}
      </p>
    </div>
  );
}

/** خط تفاعلي بسيط من التجميع اليومي — بلا مكتبة رسم إضافية. */
function DailyBars({ daily }: { daily: AnalyticsReport["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => Number(d.events)));
  return (
    <div className="flex h-32 items-end gap-1 overflow-x-auto" dir="ltr">
      {daily.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.events}`}
          className="min-w-[6px] flex-1 rounded-t bg-primary/70"
          style={{ height: `${Math.max(4, (Number(d.events) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function AdminAnalyticsPage() {
  const fetchReport = useServerFn(getAnalyticsReport);
  const purge = useServerFn(purgeTestEvents);
  const [days, setDays] = useState<number>(30);
  const [includeInternal, setIncludeInternal] = useState(false);

  const report = useQuery({
    queryKey: ["admin", "analytics", days, includeInternal],
    queryFn: () => fetchReport({ data: { days, includeInternal } }),
    staleTime: 60_000,
  });

  const data = report.data && !("error" in report.data) ? report.data : null;
  const denied = report.data && "error" in report.data && report.data.error === "forbidden";

  return (
    <AdminShell title="تحليلات المنصة">
      <AdminPageHead
        title="أرقام التشغيل"
        description="مستبعَد من الأرقام: أحداث الاختبار، الحسابات التجريبية، وحركة فريق العمل."
        actions={
          <>
            {RANGES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={days === r ? "default" : "outline"}
                onClick={() => setDays(r)}
                style={{ minHeight: 44 }}
              >
                {r} يومًا
              </Button>
            ))}
            <Button
              size="sm"
              variant={includeInternal ? "default" : "outline"}
              onClick={() => setIncludeInternal((v) => !v)}
              style={{ minHeight: 44 }}
            >
              حركة الفريق
            </Button>
          </>
        }
      />

      {denied ? (
        <AdminCard title="لا صلاحية">
          <p className="text-desc text-muted-foreground">
            تحتاج صلاحية «عرض التحليلات» لقراءة هذه الأرقام.
          </p>
        </AdminCard>
      ) : report.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data ? (
        <AdminEmptyState
          icon={BarChart3}
          title="لا أرقام بعد"
          hint="ستظهر الأرقام مع أول أحداث يسجّلها محرك التتبع."
        />
      ) : (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-3)] sm:grid-cols-3">
            <Kpi icon={Activity} label="الأحداث" value={formatNumber(Number(data.totals.events))} />
            <Kpi icon={Users} label="الجلسات" value={formatNumber(Number(data.totals.sessions))} />
            <Kpi icon={BarChart3} label="الزوّار" value={formatNumber(Number(data.totals.visitors))} />
          </div>

          <AdminCard title="الأحداث يوميًا">
            {data.daily.length === 0 ? (
              <p className="text-desc text-muted-foreground">لا بيانات في هذه المدة.</p>
            ) : (
              <DailyBars daily={data.daily} />
            )}
          </AdminCard>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-2">
            <AdminCard title="أكثر الصفحات">
              <ul className="space-y-2">
                {data.top_routes.map((r) => (
                  <li
                    key={r.route_path}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-nav"
                  >
                    <span className="truncate text-foreground" dir="ltr">
                      {r.route_path}
                    </span>
                    <span className="shrink-0 font-bold text-muted-foreground" dir="ltr">
                      {formatNumber(Number(r.events))}
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>

            <AdminCard title="أكثر الأحداث">
              <ul className="space-y-2">
                {data.top_events.map((e) => (
                  <li
                    key={e.name}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-nav"
                  >
                    <span className="truncate text-foreground" dir="ltr">
                      {e.name}
                    </span>
                    <span className="shrink-0 font-bold text-muted-foreground" dir="ltr">
                      {formatNumber(Number(e.events))}
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          </div>

          <AdminCard title="وضع الاختبار" description="أحداث الاختبار لا تدخل الأرقام، وتُحذف عند الإغلاق.">
            <p className="text-desc text-muted-foreground">
              أحداث معلّمة كاختبار: <span dir="ltr">{formatNumber(Number(data.test_events))}</span>
            </p>
            <Button
              className="mt-2"
              variant="outline"
              style={{ minHeight: 44 }}
              onClick={async () => {
                const result = await purge({});
                if ("error" in result) toast.error("تعذّر الحذف — تحقق من الصلاحية");
                else {
                  toast.success(`حُذف ${result.deleted} حدث اختبار`);
                  void report.refetch();
                }
              }}
            >
              <FlaskConical aria-hidden className="size-4" />
              حذف أحداث الاختبار
            </Button>
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}
