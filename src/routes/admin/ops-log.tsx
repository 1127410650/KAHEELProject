import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Download, Lock } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { loadStaffAccess, makeStaffAccess } from "@/lib/mkt-reports";
import { OPS_LOG_UNITS, loadExportLog, loadOpsLog } from "@/lib/mkt-ops-log";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminPageHead, AdminEmptyState } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/ops-log")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "سجل العمليات الموحّد — إدارة كَحيل" },
      {
        name: "description",
        content:
          "سجل عمليات كَحيل الموحّد: كل عملية إدارية حسّاسة بمنفّذها ووقتها، إضافة فقط بلا تعديل أو حذف.",
      },
      { property: "og:title", content: "سجل العمليات الموحّد — إدارة كَحيل" },
      { property: "og:description", content: "سجل تدقيق إضافة فقط لعمليات المنصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOpsLogPage,
});

function AdminOpsLogPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState<string | null>(null);

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("audit.view") || staff.can("reports.audit_view");

  const rows = useQuery({
    queryKey: ["mkt", "admin", "ops-log", search, unit],
    enabled: canView,
    queryFn: () => loadOpsLog({ search, ...(unit ? { unit } : {}) }, 100),
  });

  const exports = useQuery({
    queryKey: ["mkt", "admin", "export-log"],
    enabled: canView,
    queryFn: () => loadExportLog(50),
  });

  return (
    <AdminShell title={t("admin.opsLog.title")}>
      <AdminPageHead title={t("admin.opsLog.title")} description={t("admin.opsLog.hint")} />

      {!canView ? (
        <AdminCard>
          <p className="text-[14px] text-muted-foreground">{t("admin.opsLog.noAccess")}</p>
        </AdminCard>
      ) : (
        <div className="grid gap-[var(--sp-4)]">
          <AdminCard title={t("admin.opsLog.filter")}>
            <div className="grid gap-[var(--sp-2)]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.opsLog.searchPlaceholder")}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={unit === null ? "default" : "outline"}
                  onClick={() => setUnit(null)}
                >
                  {t("admin.opsLog.allUnits")}
                </Button>
                {OPS_LOG_UNITS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={unit === value ? "default" : "outline"}
                    onClick={() => setUnit(value)}
                  >
                    {t(`admin.opsLog.unit.${value}`)}
                  </Button>
                ))}
              </div>
              <p className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                {t("admin.opsLog.appendOnly")}
              </p>
            </div>
          </AdminCard>

          <AdminCard title={t("admin.opsLog.entries")}>
            {rows.isLoading ? (
              <div className="grid gap-[var(--sp-2)]">
                <Skeleton className="h-12 w-full rounded-[var(--r-inner)]" />
                <Skeleton className="h-12 w-full rounded-[var(--r-inner)]" />
              </div>
            ) : (rows.data ?? []).length === 0 ? (
              <AdminEmptyState
                icon={Activity}
                title={t("admin.opsLog.empty")}
                hint={t("admin.opsLog.emptyHint")}
              />
            ) : (
              <ul className="grid gap-[var(--sp-2)]">
                {(rows.data ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-[var(--r-inner)] bg-muted p-[var(--sp-3)] text-[14px]"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                      <span className="font-bold text-foreground">{row.action}</span>
                      <span>{t(`admin.opsLog.unit.${row.unit}`)}</span>
                      <span>{formatDateTime(row.at)}</span>
                      {row.entity ? <span>{row.entity}</span> : null}
                    </div>
                    {row.summary ? (
                      <p className="mt-1 break-words leading-relaxed text-foreground">
                        {row.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title={t("admin.opsLog.exports")}>
            {exports.isLoading ? (
              <Skeleton className="h-12 w-full rounded-[var(--r-inner)]" />
            ) : (exports.data ?? []).length === 0 ? (
              <p className="text-[14px] text-muted-foreground">{t("admin.opsLog.noExports")}</p>
            ) : (
              <ul className="grid gap-[var(--sp-2)]">
                {(exports.data ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-[var(--r-inner)] bg-muted p-[var(--sp-3)] text-[14px]"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                      <Download className="size-3.5" aria-hidden />
                      <span className="font-bold text-foreground">{row.kind}</span>
                      <span>{formatDateTime(row.at)}</span>
                      <span>
                        {t("admin.opsLog.rows")} {row.row_count}
                      </span>
                    </div>
                    <p className="mt-1 break-words leading-relaxed text-foreground">{row.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}
