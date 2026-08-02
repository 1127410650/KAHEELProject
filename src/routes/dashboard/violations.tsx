import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  loadAppeals,
  loadMyEnforcement,
  loadMyModerationCases,
  loadMyRestrictions,
  reportErrorKey,
  submitAppeal,
  type MktModerationCase,
} from "@/lib/mkt-reports";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ReportThread } from "@/components/marketplace/ReportThread";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/violations")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مخالفاتي — سوق تحقّق" },
      {
        name: "description",
        content: "الإجراءات المتخذة على إعلاناتك في سوق تحقّق وقيود الحساب وتقديم الاعتراضات.",
      },
      { property: "og:title", content: "مخالفاتي — سوق تحقّق" },
      { property: "og:description", content: "قرارات المراجعة على إعلاناتك وحالة الاعتراضات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ViolationsPage,
});

function ViolationsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [appealFor, setAppealFor] = useState<MktModerationCase | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [busy, setBusy] = useState(false);

  const cases = useQuery({
    queryKey: ["mkt", "my-violations", session?.user.id],
    enabled: !!session,
    queryFn: loadMyModerationCases,
  });
  const reportIds = (cases.data ?? []).map((c) => c.report_id);
  const appeals = useQuery({
    queryKey: ["mkt", "my-appeals", reportIds.join(",")],
    enabled: reportIds.length > 0,
    queryFn: () => loadAppeals(reportIds),
  });
  const actions = useQuery({
    queryKey: ["mkt", "my-enforcement", reportIds.join(",")],
    enabled: reportIds.length > 0,
    queryFn: () => loadMyEnforcement(reportIds),
  });
  const restrictions = useQuery({
    queryKey: ["mkt", "my-restrictions", session?.user.id],
    enabled: !!session,
    queryFn: loadMyRestrictions,
  });

  async function sendAppeal() {
    if (!appealFor || appealReason.trim().length < 10) {
      toast.error(t("market.reports.err.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await submitAppeal(appealFor.report_id, appealReason.trim());
      toast.success(t("market.reports.violations.appealSent"));
      setAppealFor(null);
      setAppealReason("");
      void appeals.refetch();
      void cases.refetch();
    } catch (error) {
      toast.error(t(`market.reports.err.${reportErrorKey(error)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title={t("market.reports.violations.title")}>
      <p className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        {t("market.reports.violations.hint")}
      </p>

      {(restrictions.data ?? []).length > 0 && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldAlert className="size-4 text-destructive" aria-hidden />
            {t("market.reports.violations.restrictions")}
          </h2>
          <ul className="mt-2 space-y-2">
            {(restrictions.data ?? []).map((item) => (
              <li key={item.id} className="text-xs text-foreground">
                <span className="font-semibold">
                  {t(`market.reports.restriction.${item.restriction}`)}
                </span>
                {item.lifted_at ? (
                  <span className="ms-2 text-muted-foreground">
                    {t("market.reports.violations.lifted")} · {formatDate(item.lifted_at)}
                  </span>
                ) : (
                  <span className="ms-2 text-muted-foreground">
                    {item.expires_at
                      ? `${t("market.reports.violations.expires")}: ${formatDate(item.expires_at)}`
                      : t("market.reports.violations.permanent")}
                  </span>
                )}
                <p className="mt-0.5 text-muted-foreground">{item.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cases.isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (cases.data ?? []).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("market.reports.violations.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {(cases.data ?? []).map((item) => {
            const appeal = (appeals.data ?? []).find((a) => a.report_id === item.report_id);
            const caseActions = (actions.data ?? []).filter((a) => a.report_id === item.report_id);
            return (
              <li key={item.report_id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p dir="ltr" className="font-mono text-xs font-bold text-foreground">
                      {item.ref_no ?? "—"}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {item.listing_title ?? "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("market.reports.violations.anonymous")} ·{" "}
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {t(`market.reports.status.${item.status}`)}
                  </span>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("market.reports.violations.decision")}
                    </dt>
                    <dd className="text-foreground">
                      {item.decision
                        ? t(`market.reports.admin.decisionOptions.${item.decision}`)
                        : t("market.reports.violations.noDecision")}
                    </dd>
                  </div>
                  {item.decision_reason && (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {item.decision_reason}
                    </p>
                  )}
                  {caseActions.length > 0 && (
                    <div>
                      <dt className="text-muted-foreground">
                        {t("market.reports.violations.actions")}
                      </dt>
                      <dd className="text-foreground">
                        {caseActions
                          .map((a) => t(`market.reports.action.${a.action}`))
                          .join(" · ")}
                      </dd>
                    </div>
                  )}
                  {appeal && (
                    <div>
                      <dt className="text-muted-foreground">
                        {t("market.reports.violations.appealStatus")}
                      </dt>
                      <dd className="text-foreground">
                        {t(`market.reports.appealStatus.${appeal.status}`)}
                        {appeal.decision_reason ? ` — ${appeal.decision_reason}` : ""}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setOpenThread(openThread === item.report_id ? null : item.report_id)
                    }
                  >
                    {t("market.reports.violations.channel")}
                  </Button>
                  {item.can_appeal && !appeal && (
                    <Button size="sm" variant="outline" onClick={() => setAppealFor(item)}>
                      {t("market.reports.violations.appeal")}
                    </Button>
                  )}
                </div>

                {openThread === item.report_id && (
                  <div className="mt-3">
                    <ReportThread reportId={item.report_id} side="advertiser" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!appealFor}
        onOpenChange={(open) => {
          if (!open) {
            setAppealFor(null);
            setAppealReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("market.reports.violations.appealTitle")}</DialogTitle>
            <DialogDescription>{appealFor?.listing_title ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={5}
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder={t("market.reports.violations.appealPlaceholder")}
            />
            <Button className="w-full" disabled={busy} onClick={() => void sendAppeal()}>
              {t("market.reports.violations.appealSubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
