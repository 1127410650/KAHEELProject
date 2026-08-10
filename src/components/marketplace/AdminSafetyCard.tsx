import { useQuery } from "@tanstack/react-query";
import { ShieldQuestion } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { loadAdvertiserSafety, RISK_TONE } from "@/lib/mkt-admin-safety";
import { AdminStatusBadge } from "@/components/marketplace/AdminStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Advertiser safety summary for a user or business file.
 *
 * A submitted report is not a violation, so confirmed reports, reports still
 * under review and invalid reports are shown as three separate numbers and only
 * confirmed ones feed the risk level. Internal notes appear as a flag; their
 * text stays behind the notes permission.
 */
export function AdminSafetyCard({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId?: string | null;
}) {
  const { t } = useI18n();
  const safety = useQuery({
    queryKey: ["mkt", "admin", "safety", userId, tenantId ?? null],
    queryFn: () => loadAdvertiserSafety(userId, tenantId ?? null),
    staleTime: 30_000,
  });

  if (safety.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  const data = safety.data;
  if (!data) return null;

  const facts: { label: string; value: string; tone?: "critical" | "urgent" | "pending" }[] = [
    { label: t("admin.safety.confirmedReports"), value: String(data.reports_confirmed), ...(data.reports_confirmed > 0 ? { tone: "critical" as const } : {}) },
    { label: t("admin.safety.reviewingReports"), value: String(data.reports_reviewing), ...(data.reports_reviewing > 0 ? { tone: "pending" as const } : {}) },
    { label: t("admin.safety.invalidReports"), value: String(data.reports_invalid) },
    { label: t("admin.safety.violations"), value: String(data.violations), ...(data.violations > 0 ? { tone: "urgent" as const } : {}) },
    { label: t("admin.safety.restrictions"), value: String(data.active_restrictions), ...(data.active_restrictions > 0 ? { tone: "urgent" as const } : {}) },
    { label: t("admin.safety.suspensions"), value: String(data.suspensions) },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
          <ShieldQuestion className="size-4 shrink-0" aria-hidden />
          {t("admin.safety.title")}
        </h2>
        <AdminStatusBadge tone={RISK_TONE[data.risk_level]} label={t(`admin.state.${data.risk_level}`)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <AdminStatusBadge
          tone={data.verified ? "done" : "idle"}
          label={t(data.verified ? "admin.safety.verified" : "admin.verification.unverified")}
        />
        <AdminStatusBadge
          tone={data.email_confirmed ? "done" : "pending"}
          label={t("admin.safety.emailConfirmed")}
        />
        <AdminStatusBadge
          tone={data.phone_confirmed ? "done" : "pending"}
          label={t("admin.safety.phoneConfirmed")}
        />
        {data.banned && <AdminStatusBadge tone="critical" label={t("admin.safety.banned")} />}
        {data.has_notes && <AdminStatusBadge tone="progress" label={t("admin.safety.hasNotes")} />}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg bg-background px-3 py-2">
            <dt className="truncate text-desc text-muted-foreground">{fact.label}</dt>
            <dd
              className={
                "text-base font-bold tabular-nums " +
                (fact.tone === "critical"
                  ? "text-admin-critical"
                  : fact.tone === "urgent"
                    ? "text-admin-urgent"
                    : fact.tone === "pending"
                      ? "text-admin-pending"
                      : "text-foreground")
              }
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {data.last_violation_at && (
        <p className="mt-2 text-desc tabular-nums text-muted-foreground">
          {t("admin.safety.lastViolation")}: {formatDateTime(data.last_violation_at)}
        </p>
      )}
      <p className="mt-2 text-desc text-muted-foreground">{t("admin.safety.hint")}</p>
    </section>
  );
}
