import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { loadMyReports, simpleStage, type MktReportPublic } from "@/lib/mkt-reports";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/reports/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "بلاغاتي — گحيل" },
      {
        name: "description",
        content: "متابعة البلاغات التي قدّمتها عن الإعلانات في گحيل وحالة معالجتها.",
      },
      { property: "og:title", content: "بلاغاتي — گحيل" },
      { property: "og:description", content: "حالة البلاغات المقدَّمة ونتيجة المراجعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyReportsPage,
});

const CLOSED: string[] = ["closed", "duplicate", "invalid", "out_of_scope"];

function MyReportsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const [tab, setTab] = useState<"all" | "open" | "closed">("all");

  const reports = useQuery({
    queryKey: ["mkt", "my-reports", session?.user.id],
    enabled: !!session,
    queryFn: loadMyReports,
  });

  const rows = (reports.data ?? []).filter((r: MktReportPublic) =>
    tab === "all" ? true : tab === "closed" ? CLOSED.includes(r.status) : !CLOSED.includes(r.status),
  );

  return (
    <DashboardShell title={t("market.reports.my.title")}>
      <div className="mb-4 flex gap-2">
        {(["all", "open", "closed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            }
          >
            {t(`market.reports.my.${key}`)}
          </button>
        ))}
      </div>

      {reports.isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("market.reports.my.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((report) => (
            <li key={report.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p dir="ltr" className="font-mono text-xs font-bold text-foreground">
                    {report.ref_no ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("market.reports.my.submittedAt")}: {formatDateTime(report.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("market.reports.my.lastUpdate")}: {formatDateTime(report.updated_at)}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {t(`market.reports.stage.${simpleStage(report.status)}`)}
                </span>
              </div>
              {report.note && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{report.note}</p>
              )}
              <Link
                to="/dashboard/reports/$id"
                params={{ id: report.id }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t("market.reports.my.openDetails")}
                <ChevronLeft className="size-3 rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
