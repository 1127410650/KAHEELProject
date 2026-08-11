import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, HeartPulse, Play, RefreshCw, Timer } from "lucide-react";

import { useSession } from "@/lib/session";
import { formatDateTime, formatNumber } from "@/lib/format";
import { loadStaffAccess, makeStaffAccess } from "@/lib/mkt-reports";
import {
  INCIDENT_STATUS_LABEL_AR,
  JOB_STATUS_LABEL_AR,
  SEVERITY_LABEL_AR,
  loadAlertRules,
  loadHealthSummary,
  loadIncidents,
  loadJobDefinitions,
  loadJobQueue,
  requeueJob,
  setIncidentStatus,
  setJobEnabled,
} from "@/lib/mkt-reliability";
import { AdminShell } from "@/components/marketplace/AdminShell";
import {
  AdminCard,
  AdminEmptyState,
  AdminPageHead,
  AdminTableScroll,
} from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/reliability")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "صحة المنصة والحوادث — إدارة كَحيل" },
      {
        name: "description",
        content:
          "لوحة موثوقية كَحيل: أهداف الخدمة، فحوص الصحة، طابور المهام الخلفية، والحوادث المفتوحة بأرقام فعلية.",
      },
      { property: "og:title", content: "صحة المنصة والحوادث — إدارة كَحيل" },
      { property: "og:description", content: "أهداف خدمة، فحوص صحة، مهام خلفية، وحوادث." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReliabilityPage,
});

function StatTile({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "plain" | "warn" | "good";
}) {
  return (
    <div
      className={
        "rounded-[var(--r-inner)] border p-[var(--sp-3)] " +
        (tone === "warn"
          ? "border-destructive/40 bg-destructive/5"
          : tone === "good"
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-secondary/40")
      }
    >
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[18px] font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AdminReliabilityPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"health" | "jobs" | "incidents">("health");

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("platform.health.view") || staff.can("settings.manage");
  const canJobs = staff.can("jobs.manage") || staff.can("settings.manage");
  const canIncidents = staff.can("platform.incidents.manage") || staff.can("settings.manage");

  const health = useQuery({
    queryKey: ["mkt", "admin", "health-summary"],
    enabled: canView,
    queryFn: loadHealthSummary,
    refetchInterval: 60_000,
  });
  const jobDefs = useQuery({
    queryKey: ["mkt", "admin", "job-definitions"],
    enabled: canView,
    queryFn: loadJobDefinitions,
  });
  const jobQueue = useQuery({
    queryKey: ["mkt", "admin", "job-queue"],
    enabled: canView,
    queryFn: () => loadJobQueue(60),
  });
  const incidents = useQuery({
    queryKey: ["mkt", "admin", "incidents"],
    enabled: canView,
    queryFn: () => loadIncidents(50),
  });
  const rules = useQuery({
    queryKey: ["mkt", "admin", "alert-rules"],
    enabled: canView,
    queryFn: loadAlertRules,
  });

  const toggleJob = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => setJobEnabled(input.id, input.enabled),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "job-definitions"] }),
  });
  const requeue = useMutation({
    mutationFn: (id: string) => requeueJob(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "job-queue"] }),
  });
  const changeIncident = useMutation({
    mutationFn: (input: {
      id: string;
      status: "open" | "mitigating" | "monitoring" | "resolved";
    }) => setIncidentStatus(input.id, input.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "health-summary"] });
    },
  });

  const summary = health.data;
  const staleJobs = useMemo(
    () => (summary?.job_freshness ?? []).filter((row) => row.enabled && row.last_success_at === null),
    [summary],
  );

  return (
    <AdminShell
      title="صحة المنصة والحوادث"
      staffAccess={canView}
      staffChecking={access.isLoading}
      actions={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void health.refetch()}
          disabled={health.isFetching}
        >
          <RefreshCw className={"size-4 " + (health.isFetching ? "animate-spin" : "")} aria-hidden />
          تحديث
        </Button>
      }
    >
      <AdminPageHead
        title="صحة المنصة والحوادث"
        description="أرقام فعلية من خطّ الأحداث وطابور المهام وسجل العمليات — لا قيم تجريبية."
      />

      {!canView ? (
        <AdminCard>
          <p className="text-[14px] text-muted-foreground">
            تحتاج صلاحية «عرض صحة المنصة» للوصول إلى هذه الشاشة.
          </p>
        </AdminCard>
      ) : (
        <div className="grid gap-[var(--sp-4)]">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["health", "الصحة والأهداف"],
                ["jobs", "المهام الخلفية"],
                ["incidents", "الحوادث والتنبيهات"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                className="k-press"
                variant={tab === value ? "default" : "outline"}
                onClick={() => setTab(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {health.isLoading ? (
            <AdminCard>
              <div className="grid gap-[var(--sp-2)]">
                <Skeleton className="h-16 w-full rounded-[var(--r-inner)]" />
                <Skeleton className="h-16 w-full rounded-[var(--r-inner)]" />
              </div>
            </AdminCard>
          ) : null}

          {tab === "health" && summary ? (
            <>
              <AdminCard
                title="نظرة الآن"
                description={`آخر تحديث: ${formatDateTime(summary.generated_at)}`}
              >
                <div className="grid gap-[var(--sp-2)] sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="أحداث آخر ساعة"
                    value={formatNumber(summary.ingest.events_last_hour)}
                    hint={
                      summary.ingest.last_event_at
                        ? `آخر حدث: ${formatDateTime(summary.ingest.last_event_at)}`
                        : "لا أحداث بعد"
                    }
                  />
                  <StatTile
                    label="أحداث آخر يوم"
                    value={formatNumber(summary.ingest.events_last_day)}
                  />
                  <StatTile
                    label="حوادث مفتوحة"
                    value={formatNumber(summary.incidents.open)}
                    hint={`منها حرِج/عالٍ: ${formatNumber(summary.incidents.p0_p1_open)}`}
                    tone={summary.incidents.p0_p1_open > 0 ? "warn" : "plain"}
                  />
                  <StatTile
                    label="عمليات إدارية آخر يوم"
                    value={formatNumber(summary.ops.actions_last_day)}
                  />
                </div>
              </AdminCard>

              <AdminCard
                title="أهداف مستوى الخدمة"
                description="كل هدف مرتبط بدليل معالجة؛ خط الأساس يُقاس فعليًا ولا يُفترض."
              >
                <AdminTableScroll>
                  <table className="w-full text-[14px]">
                    <thead className="text-start text-[13px] text-muted-foreground">
                      <tr>
                        <th className="p-2 text-start">الخدمة</th>
                        <th className="p-2 text-start">المؤشّر</th>
                        <th className="p-2 text-start">الهدف</th>
                        <th className="p-2 text-start">خط الأساس</th>
                        <th className="p-2 text-start">دليل المعالجة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.slos.map((slo) => (
                        <tr key={slo.service_key} className="border-t border-border">
                          <td className="p-2 font-semibold">{slo.name_ar}</td>
                          <td className="p-2 text-muted-foreground">{slo.indicator}</td>
                          <td className="p-2 tabular-nums">
                            {slo.target_value === null
                              ? "—"
                              : `${formatNumber(slo.target_value)} ${slo.target_unit ?? ""}`}
                          </td>
                          <td className="p-2 tabular-nums">
                            {slo.baseline_value === null ? (
                              <span className="text-muted-foreground">لم يُقس بعد</span>
                            ) : (
                              formatNumber(slo.baseline_value)
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground">{slo.runbook_slug ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableScroll>
              </AdminCard>

              <AdminCard title="فحوص الصحة">
                {summary.checks.length === 0 ? (
                  <AdminEmptyState
                    icon={HeartPulse}
                    title="لا فحوص صحة مفعّلة بعد"
                    hint="تُضاف الفحوص وتُشغّل في دفعة الأداء والوضع الآمن."
                  />
                ) : (
                  <div className="grid gap-[var(--sp-2)] sm:grid-cols-2 lg:grid-cols-3">
                    {summary.checks.map((check) => (
                      <StatTile
                        key={check.check_key}
                        label={check.check_key}
                        value={check.value === null ? check.state : formatNumber(check.value)}
                        hint={
                          check.observed_at ? formatDateTime(check.observed_at) : "لم يُشغّل بعد"
                        }
                        tone={check.state === "fail" ? "warn" : check.state === "ok" ? "good" : "plain"}
                      />
                    ))}
                  </div>
                )}
              </AdminCard>
            </>
          ) : null}

          {tab === "jobs" && summary ? (
            <>
              <AdminCard title="حالة الطابور">
                <div className="grid gap-[var(--sp-2)] sm:grid-cols-3 lg:grid-cols-6">
                  <StatTile label="في الطابور" value={formatNumber(summary.jobs.queued)} />
                  <StatTile label="قيد التنفيذ" value={formatNumber(summary.jobs.running)} />
                  <StatTile
                    label="فشلت"
                    value={formatNumber(summary.jobs.failed)}
                    tone={summary.jobs.failed > 0 ? "warn" : "plain"}
                  />
                  <StatTile
                    label="رسائل ميتة"
                    value={formatNumber(summary.jobs.dead_letter)}
                    tone={summary.jobs.dead_letter > 0 ? "warn" : "plain"}
                  />
                  <StatTile
                    label="نجحت آخر يوم"
                    value={formatNumber(summary.jobs.succeeded_last_day)}
                  />
                  <StatTile
                    label="زمن التنفيذ p95"
                    value={`${formatNumber(summary.jobs.p95_duration_ms)} ms`}
                  />
                </div>
                {staleJobs.length > 0 ? (
                  <p className="mt-[var(--sp-3)] inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    مهام مفعّلة بلا أي تنفيذ ناجح حتى الآن: {formatNumber(staleJobs.length)}
                  </p>
                ) : null}
              </AdminCard>

              <AdminCard
                title="تعريفات المهام"
                description="إيقاف مهمة يمنع سحبها من الطابور دون فقدان صفوفها."
              >
                <AdminTableScroll>
                  <table className="w-full text-[14px]">
                    <thead className="text-[13px] text-muted-foreground">
                      <tr>
                        <th className="p-2 text-start">المهمة</th>
                        <th className="p-2 text-start">الجدولة</th>
                        <th className="p-2 text-start">محاولات/تأجيل</th>
                        <th className="p-2 text-start">آخر نجاح</th>
                        <th className="p-2 text-start">مفعّلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(jobDefs.data ?? []).map((def) => {
                        const fresh = summary.job_freshness.find((row) => row.job_key === def.job_key);
                        return (
                          <tr key={def.id} className="border-t border-border">
                            <td className="p-2">
                              <span className="font-semibold">{def.name_ar}</span>
                              <span className="block text-[12px] text-muted-foreground">
                                {def.job_key}
                              </span>
                            </td>
                            <td className="p-2 text-muted-foreground">{def.schedule_cron ?? "—"}</td>
                            <td className="p-2 tabular-nums text-muted-foreground">
                              {formatNumber(def.max_attempts)} / {formatNumber(def.backoff_seconds)}s
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {fresh?.last_success_at
                                ? formatDateTime(fresh.last_success_at)
                                : "لم تنجح بعد"}
                            </td>
                            <td className="p-2">
                              <Switch
                                checked={def.is_enabled}
                                disabled={!canJobs || toggleJob.isPending}
                                onCheckedChange={(checked) =>
                                  toggleJob.mutate({ id: def.id, enabled: checked })
                                }
                                aria-label={`تفعيل ${def.name_ar}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </AdminTableScroll>
              </AdminCard>

              <AdminCard title="آخر صفوف الطابور">
                {(jobQueue.data ?? []).length === 0 ? (
                  <AdminEmptyState
                    icon={Timer}
                    title="الطابور فارغ"
                    hint="لم تُدرج مهام بعد — الإدراج يتم بمفتاح تفرّد فلا تتكرر المهمة نفسها."
                  />
                ) : (
                  <AdminTableScroll>
                    <table className="w-full text-[14px]">
                      <thead className="text-[13px] text-muted-foreground">
                        <tr>
                          <th className="p-2 text-start">المهمة</th>
                          <th className="p-2 text-start">الحالة</th>
                          <th className="p-2 text-start">المحاولات</th>
                          <th className="p-2 text-start">الموعد</th>
                          <th className="p-2 text-start">الخطأ</th>
                          <th className="p-2 text-start"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(jobQueue.data ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="p-2">
                              <span className="font-semibold">{row.job_key}</span>
                              <span className="block text-[12px] text-muted-foreground">
                                {row.idempotency_key}
                              </span>
                            </td>
                            <td className="p-2">
                              {JOB_STATUS_LABEL_AR[row.status] ?? row.status}
                            </td>
                            <td className="p-2 tabular-nums">{formatNumber(row.attempts)}</td>
                            <td className="p-2 text-muted-foreground">
                              {formatDateTime(row.scheduled_for)}
                            </td>
                            <td className="p-2 text-[13px] text-muted-foreground">
                              {row.error_summary ?? "—"}
                            </td>
                            <td className="p-2">
                              {canJobs &&
                              (row.status === "failed" || row.status === "dead_letter") ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="k-press"
                                  disabled={requeue.isPending}
                                  onClick={() => requeue.mutate(row.id)}
                                >
                                  <Play className="size-3.5" aria-hidden />
                                  إعادة
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableScroll>
                )}
              </AdminCard>
            </>
          ) : null}

          {tab === "incidents" ? (
            <>
              <AdminCard
                title="الحوادث"
                description="التنبيه المتكرر داخل نافذة التجميع يزيد عدّاد التكرار ولا يفتح حادثة ثانية."
              >
                {(incidents.data ?? []).length === 0 ? (
                  <AdminEmptyState
                    icon={Activity}
                    title="لا حوادث مسجّلة"
                    hint="تُفتح الحوادث من قواعد التنبيه أو يدويًا عند الحاجة."
                  />
                ) : (
                  <AdminTableScroll>
                    <table className="w-full text-[14px]">
                      <thead className="text-[13px] text-muted-foreground">
                        <tr>
                          <th className="p-2 text-start">#</th>
                          <th className="p-2 text-start">الحادثة</th>
                          <th className="p-2 text-start">الشدّة</th>
                          <th className="p-2 text-start">الحالة</th>
                          <th className="p-2 text-start">التكرار</th>
                          <th className="p-2 text-start">البداية</th>
                          <th className="p-2 text-start"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(incidents.data ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="p-2 tabular-nums">{formatNumber(row.incident_number)}</td>
                            <td className="p-2 font-semibold">{row.title}</td>
                            <td className="p-2">{SEVERITY_LABEL_AR[row.severity] ?? row.severity}</td>
                            <td className="p-2">
                              {INCIDENT_STATUS_LABEL_AR[row.status] ?? row.status}
                            </td>
                            <td className="p-2 tabular-nums">
                              {formatNumber(row.occurrence_count)}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {formatDateTime(row.started_at)}
                            </td>
                            <td className="p-2">
                              {canIncidents && row.status !== "resolved" ? (
                                <div className="flex flex-wrap gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="k-press"
                                    disabled={changeIncident.isPending}
                                    onClick={() =>
                                      changeIncident.mutate({ id: row.id, status: "mitigating" })
                                    }
                                  >
                                    معالجة
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="k-press"
                                    disabled={changeIncident.isPending}
                                    onClick={() =>
                                      changeIncident.mutate({ id: row.id, status: "resolved" })
                                    }
                                  >
                                    إغلاق
                                  </Button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableScroll>
                )}
              </AdminCard>

              <AdminCard
                title="قواعد التنبيه"
                description="لكل قاعدة نافذة تجميع ودليل معالجة — لا تنبيه بلا إجراء واضح."
              >
                {(rules.data ?? []).length === 0 ? (
                  <AdminEmptyState icon={AlertTriangle} title="لا قواعد تنبيه بعد" />
                ) : (
                  <AdminTableScroll>
                    <table className="w-full text-[14px]">
                      <thead className="text-[13px] text-muted-foreground">
                        <tr>
                          <th className="p-2 text-start">القاعدة</th>
                          <th className="p-2 text-start">الشدّة</th>
                          <th className="p-2 text-start">الشرط</th>
                          <th className="p-2 text-start">نافذة التجميع</th>
                          <th className="p-2 text-start">دليل المعالجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rules.data ?? []).map((rule) => (
                          <tr key={rule.id} className="border-t border-border">
                            <td className="p-2 font-semibold">{rule.rule_key}</td>
                            <td className="p-2">
                              {SEVERITY_LABEL_AR[rule.severity] ?? rule.severity}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {rule.condition_note ?? "—"}
                            </td>
                            <td className="p-2 tabular-nums">
                              {formatNumber(rule.dedupe_window_minutes)} د
                            </td>
                            <td className="p-2 text-muted-foreground">{rule.runbook_slug ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminTableScroll>
                )}
              </AdminCard>
            </>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
