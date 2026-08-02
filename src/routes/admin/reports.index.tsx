import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import {
  isOverdue,
  loadAdminReports,
  loadAppeals,
  loadReportReasons,
  loadReportStats,
  loadStaffAccess,
  makeStaffAccess,
  REPORT_PRIORITIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  slaRemainingHours,
  type AdminReportFilters,
  type Worklist,
} from "@/lib/mkt-reports";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/reports/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "صندوق البلاغات — إدارة سوق تحقّق" },
      {
        name: "description",
        content: "صندوق بلاغات سوق تحقّق: قوائم العمل، مؤشرات الأداء، والفلاتر لمعالجة البلاغات.",
      },
      { property: "og:title", content: "صندوق البلاغات — إدارة سوق تحقّق" },
      { property: "og:description", content: "معالجة بلاغات الإعلانات والحسابات في سوق تحقّق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReportsPage,
});

const WORKLISTS: Worklist[] = [
  "new",
  "unassigned",
  "mine",
  "needs_info",
  "escalated",
  "pending_decision",
  "appeals",
  "closed",
  "all",
];

function AdminReportsPage() {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const [filters, setFilters] = useState<AdminReportFilters>({ worklist: "new" });

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("reports.inbox_view");

  const stats = useQuery({
    queryKey: ["mkt", "report-stats"],
    enabled: canView,
    queryFn: loadReportStats,
  });
  const reasons = useQuery({ queryKey: ["mkt", "report-reasons"], queryFn: loadReportReasons });
  const reports = useQuery({
    queryKey: ["mkt", "admin-reports", filters, session?.user.id],
    enabled: canView && filters.worklist !== "appeals",
    queryFn: () => loadAdminReports(filters, session?.user.id ?? null),
  });
  const appeals = useQuery({
    queryKey: ["mkt", "admin-appeals"],
    enabled: canView && filters.worklist === "appeals",
    queryFn: () => loadAppeals(),
  });

  function set<K extends keyof AdminReportFilters>(key: K, value: AdminReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const kpis = [
    { key: "kpiNew", value: stats.data?.new },
    { key: "kpiOpen", value: stats.data?.open },
    { key: "kpiUnassigned", value: stats.data?.unassigned },
    { key: "kpiCritical", value: stats.data?.critical },
    { key: "kpiOverdue", value: stats.data?.overdue },
    { key: "kpiFirstResp", value: stats.data?.avg_first_response_hours },
    { key: "kpiClose", value: stats.data?.avg_close_hours },
  ];

  return (
    <AdminShell
      title={t("market.reports.admin.inbox")}
      staffAccess={canView}
      staffChecking={access.isLoading}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{t(`market.reports.admin.${kpi.key}`)}</p>
            <p dir="ltr" className="mt-1 text-lg font-bold text-foreground">
              {kpi.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      <nav className="mt-4 -mx-1 flex gap-1 overflow-x-auto pb-1">
        {WORKLISTS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => set("worklist", key)}
            className={
              filters.worklist === key
                ? "shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                : "shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            }
          >
            {t(`market.reports.admin.worklist.${key}`)}
          </button>
        ))}
      </nav>

      {filters.worklist !== "appeals" && (
        <div className="mt-4 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="f-ref" className="text-[11px]">
              {t("market.reports.admin.filters.ref")}
            </Label>
            <Input
              id="f-ref"
              dir="ltr"
              value={filters.ref ?? ""}
              onChange={(e) => set("ref", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-status" className="text-[11px]">
              {t("market.reports.admin.filters.status")}
            </Label>
            <select
              id="f-status"
              value={filters.status ?? ""}
              onChange={(e) => set("status", e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("market.reports.admin.filters.all")}</option>
              {REPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`market.reports.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-priority" className="text-[11px]">
              {t("market.reports.admin.filters.priority")}
            </Label>
            <select
              id="f-priority"
              value={filters.priority ?? ""}
              onChange={(e) => set("priority", e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("market.reports.admin.filters.all")}</option>
              {REPORT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`market.reports.priority.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-severity" className="text-[11px]">
              {t("market.reports.admin.filters.severity")}
            </Label>
            <select
              id="f-severity"
              value={filters.severity ?? ""}
              onChange={(e) => set("severity", e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("market.reports.admin.filters.all")}</option>
              {REPORT_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {t(`market.reports.severity.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-reason" className="text-[11px]">
              {t("market.reports.admin.filters.reason")}
            </Label>
            <select
              id="f-reason"
              value={filters.reason ?? ""}
              onChange={(e) => set("reason", e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("market.reports.admin.filters.all")}</option>
              {(reasons.data ?? []).map((r) => (
                <option key={r.code} value={r.code}>
                  {locale === "ar" ? r.name_ar : r.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-from" className="text-[11px]">
              {t("market.reports.admin.filters.from")}
            </Label>
            <Input
              id="f-from"
              type="date"
              dir="ltr"
              value={filters.from ?? ""}
              onChange={(e) => set("from", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-to" className="text-[11px]">
              {t("market.reports.admin.filters.to")}
            </Label>
            <Input
              id="f-to"
              type="date"
              dir="ltr"
              value={filters.to ?? ""}
              onChange={(e) => set("to", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-sla" className="text-[11px]">
              {t("market.reports.admin.filters.sla")}
            </Label>
            <select
              id="f-sla"
              value={filters.sla ?? ""}
              onChange={(e) => set("sla", e.target.value as AdminReportFilters["sla"])}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t("market.reports.admin.filters.all")}</option>
              <option value="overdue">{t("market.reports.admin.filters.overdue")}</option>
              <option value="ontime">{t("market.reports.admin.filters.ontime")}</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFilters({ worklist: filters.worklist })}
            >
              {t("market.reports.admin.filters.clear")}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {filters.worklist === "appeals" ? (
          appeals.isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : (appeals.data ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("market.reports.admin.noAppeals")}
            </p>
          ) : (
            <ul className="space-y-2">
              {(appeals.data ?? []).map((appeal) => (
                <li key={appeal.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {t(`market.reports.appealStatus.${appeal.status}`)} ·{" "}
                      {formatDateTime(appeal.created_at)}
                    </span>
                    <Link
                      to="/admin/reports/$id"
                      params={{ id: appeal.report_id }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("market.reports.admin.openCase")}
                    </Link>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{appeal.reason}</p>
                </li>
              ))}
            </ul>
          )
        ) : reports.isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : (reports.data ?? []).length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("market.reports.admin.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {(reports.data ?? []).map((report) => {
              const hours = slaRemainingHours(report.sla_due_at);
              const late = isOverdue(report);
              return (
                <li key={report.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p dir="ltr" className="font-mono text-xs font-bold text-foreground">
                        {report.ref_no ?? "—"}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">
                        {report.listing_snapshot?.title ?? "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t(`market.reports.status.${report.status}`)} ·{" "}
                        {t(`market.reports.severity.${report.severity}`)} ·{" "}
                        {t(`market.reports.priority.${report.priority}`)} ·{" "}
                        {report.assigned_to
                          ? report.assigned_to === session?.user.id
                            ? t("market.reports.admin.table.me")
                            : t("market.reports.admin.table.other")
                          : t("market.reports.admin.table.unassigned")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDateTime(report.created_at)}
                        {hours !== null && (
                          <span className={late ? "ms-2 font-medium text-destructive" : "ms-2"}>
                            {late ? (
                              <>
                                <AlertTriangle className="me-1 inline size-3" aria-hidden />
                                {t("market.reports.admin.overdue")}
                              </>
                            ) : (
                              `${Math.round(hours)} ${t("market.reports.admin.hoursLeft")}`
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      to="/admin/reports/$id"
                      params={{ id: report.id }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {t("market.reports.admin.openCase")}
                      <ChevronLeft className="size-3 rtl:rotate-180" aria-hidden />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
