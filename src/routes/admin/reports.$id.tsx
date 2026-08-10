import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import {
  ACCOUNT_RESTRICTIONS,
  addInternalNote,
  assignReport,
  closeReport,
  enforceListing,
  isOverdue,
  liftRestriction,
  LISTING_ENFORCEMENTS,
  loadAppeals,
  loadEnforcementActions,
  loadReportFiles,
  loadReportMessages,
  loadReportNotes,
  loadReportReasons,
  loadReportRestrictions,
  loadStaffAccess,
  loadStatusHistory,
  makeStaffAccess,
  mergeReport,
  REPORT_ADMIN_COLUMNS,
  REPORT_PRIORITIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  reopenReport,
  reportErrorKey,
  reportFileUrl,
  restrictSubject,
  reviewAppeal,
  setReportPriority,
  setReportStatus,
  slaRemainingHours,
  staffMessage,
  type AccountRestriction,
  type AppealStatus,
  type ListingEnforcement,
  type MktReportAdmin,
  type ReportPriority,
  type ReportSeverity,
  type ReportStatus,
  type StaffAccess,
} from "@/lib/mkt-reports";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminAssignmentBar } from "@/components/marketplace/AdminAssignmentBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/reports/$id")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "بطاقة البلاغ — إدارة كَحيل" },
      {
        name: "description",
        content: "بطاقة البلاغ في كَحيل: التقييم، المراسلات، الإجراءات على الإعلان والحساب.",
      },
      { property: "og:title", content: "بطاقة البلاغ — إدارة كَحيل" },
      { property: "og:description", content: "معالجة البلاغ واتخاذ الإجراءات وتسجيل القرار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReportCardPage,
});

const DECISIONS = ["violation", "no_violation", "duplicate", "invalid", "out_of_scope"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-section font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AdminReportCardPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("reports.inbox_view");

  const report = useQuery({
    queryKey: ["mkt", "admin-report", id],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_reports")
        .select(REPORT_ADMIN_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MktReportAdmin | null;
    },
  });

  return (
    <AdminShell
      title={t("market.reports.admin.case")}
      staffAccess={canView}
      staffChecking={access.isLoading}
    >
      <Link
        to="/admin/reports"
        className="inline-flex items-center gap-1 text-desc font-medium text-primary hover:underline"
      >
        <ChevronRight className="size-3 rtl:rotate-180" aria-hidden />
        {t("market.reports.admin.backToInbox")}
      </Link>

      <div className="mt-3">
        <AdminAssignmentBar kind="report" subjectId={id} onChanged={() => void report.refetch()} />
      </div>

      {report.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full rounded-xl" />

      ) : !report.data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("market.reports.detail.notFound")}
        </p>
      ) : (
        <CaseBody
          report={report.data}
          staff={staff}
          currentUserId={session?.user.id ?? null}
          onChanged={() => void report.refetch()}
          t={t}
          locale={locale}
        />
      )}
    </AdminShell>
  );
}

interface BodyProps {
  report: MktReportAdmin;
  staff: StaffAccess;
  currentUserId: string | null;
  onChanged: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: "ar" | "en";
}

function CaseBody({ report, staff, currentUserId, onChanged, t, locale }: BodyProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [statusReason, setStatusReason] = useState("");
  const [priority, setPriority] = useState<ReportPriority>(report.priority);
  const [severity, setSeverity] = useState<ReportSeverity>(report.severity);
  const [note, setNote] = useState("");
  const [enforceAction, setEnforceAction] = useState<ListingEnforcement>("hide");
  const [enforceReason, setEnforceReason] = useState("");
  const [enforceDays, setEnforceDays] = useState("");
  const [restriction, setRestriction] = useState<AccountRestriction>("warning");
  const [subjectType, setSubjectType] = useState<"user" | "business">("user");
  const [restrictReason, setRestrictReason] = useState("");
  const [restrictDays, setRestrictDays] = useState("");
  const [decision, setDecision] = useState<string>("violation");
  const [decisionReason, setDecisionReason] = useState("");
  const [publicOutcome, setPublicOutcome] = useState("");
  const [reopenReasonText, setReopenReasonText] = useState("");
  const [mergeInto, setMergeInto] = useState("");

  const reasons = useQuery({ queryKey: ["mkt", "report-reasons"], queryFn: loadReportReasons });
  const notes = useQuery({
    queryKey: ["mkt", "report-notes", report.id],
    enabled: staff.can("reports.add_internal_note") || staff.can("reports.audit_view"),
    queryFn: () => loadReportNotes(report.id),
  });
  const history = useQuery({
    queryKey: ["mkt", "report-history", report.id],
    queryFn: () => loadStatusHistory(report.id),
  });
  const actions = useQuery({
    queryKey: ["mkt", "report-actions", report.id],
    queryFn: () => loadEnforcementActions(report.id),
  });
  const restrictions = useQuery({
    queryKey: ["mkt", "report-restrictions", report.id],
    queryFn: () => loadReportRestrictions(report.id),
  });
  const appeals = useQuery({
    queryKey: ["mkt", "report-appeals", report.id],
    queryFn: () => loadAppeals([report.id]),
  });
  const files = useQuery({
    queryKey: ["mkt", "report-all-files", report.id],
    queryFn: () => loadReportFiles(report.id),
  });
  const listing = useQuery({
    queryKey: ["mkt", "report-current-listing", report.listing_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listings")
        .select("id, title, slug, status, tenant_id, owner_user_id")
        .eq("id", report.listing_id)
        .maybeSingle();
      if (!data) return null;
      const row = data as {
        id: string;
        title: string;
        slug: string | null;
        status: string;
        tenant_id: string | null;
        owner_user_id: string;
      };
      // A business subject is identified by its tenant id (mkt_business_profiles PK).
      return { ...row, business_id: row.tenant_id };
    },
  });

  const reason = (reasons.data ?? []).find((r) => r.code === report.reason_code);
  const hours = slaRemainingHours(report.sla_due_at);
  const late = isOverdue(report);
  const snapshot = report.listing_snapshot;

  async function run(action: () => Promise<void>, permitted = true) {
    if (!permitted) {
      toast.error(t("market.reports.admin.noPermission"));
      return;
    }
    setBusy(true);
    try {
      await action();
      toast.success(t("market.reports.admin.saved"));
      onChanged();
    } catch (error) {
      toast.error(t(`market.reports.err.${reportErrorKey(error)}`));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(path: string) {
    const url = await reportFileUrl(path);
    if (!url) {
      toast.error(t("market.reports.err.notAuthorized"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Section title={t("market.reports.admin.snapshot")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p dir="ltr" className="font-mono text-sm font-bold text-foreground">
                {report.ref_no ?? "—"}
              </p>
              <p className="mt-1 text-desc text-muted-foreground">
                {formatDateTime(report.created_at)} ·{" "}
                {reason ? (locale === "ar" ? reason.name_ar : reason.name_en) : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-desc">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                {t(`market.reports.status.${report.status}`)}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                {t(`market.reports.severity.${report.severity}`)}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                {t(`market.reports.priority.${report.priority}`)}
              </span>
              {hours !== null && (
                <span
                  className={
                    late
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive"
                      : "rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground"
                  }
                >
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
            </div>
          </div>

          {report.note && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-desc text-foreground">
              {report.note}
            </p>
          )}

          <dl className="mt-3 grid gap-2 text-desc sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("market.reports.admin.snapshot")}</dt>
              <dd className="mt-0.5 text-foreground">
                {snapshot?.title ?? "—"}
                {snapshot?.price != null && (
                  <span className="ms-2 text-muted-foreground">
                    {formatMoney(snapshot.price, locale)}
                  </span>
                )}
                {snapshot?.city && <span className="ms-2 text-muted-foreground">{snapshot.city}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("market.reports.admin.currentListing")}</dt>
              <dd className="mt-0.5 text-foreground">
                {listing.data?.slug ? (
                  <Link
                    to="/ads/$slug"
                    params={{ slug: listing.data.slug }}
                    className="text-primary hover:underline"
                  >
                    {listing.data.title}
                  </Link>
                ) : (
                  (listing.data?.title ?? "—")
                )}
                {listing.data?.status && (
                  <span className="ms-2 text-muted-foreground">
                    {t(`market.dash.status.${listing.data.status}`)}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("market.reports.admin.reporterIdentity")}</dt>
              <dd dir="ltr" className="mt-0.5 font-mono text-desc text-foreground">
                {staff.can("reports.view_reporter_identity")
                  ? report.reporter_user_id
                  : t("market.reports.admin.hiddenIdentity")}
              </dd>
            </div>
          </dl>

          {(files.data ?? []).length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-desc font-medium text-muted-foreground">
                {t("market.reports.admin.files")}
              </p>
              {(files.data ?? []).map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => void openFile(file.storage_path)}
                  className="flex items-center gap-1 text-desc text-primary hover:underline"
                >
                  <Paperclip className="size-3" aria-hidden />
                  {file.file_name}
                  <span className="text-muted-foreground">
                    ({t(`market.reports.admin.${file.side === "reporter" ? "reporterFiles" : "advertiserFiles"}`)})
                  </span>
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("market.reports.admin.channels")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <StaffChannel
              reportId={report.id}
              channel="reporter"
              label={t("market.reports.admin.reporterChannel")}
              canSend={staff.can("reports.message_reporter")}
              t={t}
            />
            <StaffChannel
              reportId={report.id}
              channel="advertiser"
              label={t("market.reports.admin.advertiserChannel")}
              canSend={staff.can("reports.message_advertiser")}
              t={t}
            />
          </div>
        </Section>

        <Section title={t("market.reports.admin.internalNotes")}>
          <p className="text-desc text-muted-foreground">
            {t("market.reports.admin.internalHint")}
          </p>
          {staff.can("reports.add_internal_note") && (
            <div className="mt-2 space-y-2">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("market.reports.admin.messagePlaceholder")}
              />
              <Button
                size="sm"
                disabled={busy || !note.trim()}
                onClick={() =>
                  void run(async () => {
                    await addInternalNote(report.id, note.trim());
                    setNote("");
                    void notes.refetch();
                  }, staff.can("reports.add_internal_note"))
                }
              >
                {t("market.reports.admin.addNote")}
              </Button>
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {(notes.data ?? []).map((item) => (
              <li key={item.id} className="rounded-lg bg-muted/50 p-2 text-desc text-foreground">
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className="mt-1 text-desc text-muted-foreground">
                  {formatDateTime(item.created_at)}
                </p>
              </li>
            ))}
            {(notes.data ?? []).length === 0 && (
              <li className="text-desc text-muted-foreground">{t("market.reports.admin.noNotes")}</li>
            )}
          </ul>
        </Section>

        <Section title={t("market.reports.admin.enforcement")}>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="enf-action" className="text-desc">
                {t("market.reports.admin.enforceAction")}
              </Label>
              <select
                id="enf-action"
                value={enforceAction}
                onChange={(e) => setEnforceAction(e.target.value as ListingEnforcement)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              >
                {LISTING_ENFORCEMENTS.map((action) => (
                  <option key={action} value={action}>
                    {t(`market.reports.action.${action}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="enf-reason" className="text-desc">
                {t("market.reports.admin.enforceReason")}
              </Label>
              <Input
                id="enf-reason"
                value={enforceReason}
                onChange={(e) => setEnforceReason(e.target.value)}
                className="h-8 text-desc"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="enf-days" className="text-desc">
                {t("market.reports.admin.enforceDays")}
              </Label>
              <Input
                id="enf-days"
                dir="ltr"
                inputMode="numeric"
                value={enforceDays}
                onChange={(e) => setEnforceDays(e.target.value)}
                className="h-8 text-desc"
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      enforceListing({
                        reportId: report.id,
                        action: enforceAction,
                        reason: enforceReason || undefined,
                        days: enforceDays ? Number(enforceDays) : undefined,
                      }).then(() => {
                        void actions.refetch();
                      }),
                    enforceAction === "suspend" || enforceAction === "reject"
                      ? staff.can("ads.moderation_suspend")
                      : staff.can("ads.moderation_hide"),
                  )
                }
              >
                {t("market.reports.admin.apply")}
              </Button>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-desc">
            {(actions.data ?? []).map((action) => (
              <li key={action.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t(`market.reports.action.${action.action}`)}
                </span>{" "}
                · {formatDateTime(action.created_at)}
                {action.expires_at ? ` · ${formatDate(action.expires_at)}` : ""}
                {action.reason ? ` — ${action.reason}` : ""}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("market.reports.admin.restrictAccount")}>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="res-subject" className="text-desc">
                {t("market.reports.admin.subject")}
              </Label>
              <select
                id="res-subject"
                value={subjectType}
                onChange={(e) => setSubjectType(e.target.value as "user" | "business")}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              >
                <option value="user">{t("market.reports.admin.subjectUser")}</option>
                <option value="business">{t("market.reports.admin.subjectBusiness")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="res-type" className="text-desc">
                {t("market.reports.admin.restrictionType")}
              </Label>
              <select
                id="res-type"
                value={restriction}
                onChange={(e) => setRestriction(e.target.value as AccountRestriction)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              >
                {ACCOUNT_RESTRICTIONS.map((item) => (
                  <option key={item} value={item}>
                    {t(`market.reports.restriction.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="res-days" className="text-desc">
                {t("market.reports.admin.restrictDays")}
              </Label>
              <Input
                id="res-days"
                dir="ltr"
                inputMode="numeric"
                value={restrictDays}
                onChange={(e) => setRestrictDays(e.target.value)}
                className="h-8 text-desc"
              />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label htmlFor="res-reason" className="text-desc">
                {t("market.reports.admin.restrictReason")}
              </Label>
              <Input
                id="res-reason"
                value={restrictReason}
                onChange={(e) => setRestrictReason(e.target.value)}
                className="h-8 text-desc"
              />
            </div>
          </div>
          <Button
            className="mt-2"
            size="sm"
            variant="destructive"
            disabled={busy || !restrictReason.trim()}
            onClick={() => {
              const subjectId =
                subjectType === "user"
                  ? (report.owner_user_id ?? listing.data?.owner_user_id ?? "")
                  : (listing.data?.business_id ?? "");
              if (!subjectId) {
                toast.error(t("market.reports.err.generic"));
                return;
              }
              const severe =
                restriction === "suspend_account" || restriction === "permanent_ban";
              const permitted =
                restriction === "revoke_verification"
                  ? staff.can("businesses.revoke_verification")
                  : severe
                    ? staff.can("accounts.suspend")
                    : staff.can("accounts.restrict");
              void run(
                () =>
                  restrictSubject({
                    reportId: report.id,
                    subjectType,
                    subjectId,
                    restriction,
                    reason: restrictReason.trim(),
                    days: restrictDays ? Number(restrictDays) : undefined,
                  }).then(() => {
                    setRestrictReason("");
                    setRestrictDays("");
                    void restrictions.refetch();
                  }),
                permitted,
              );
            }}
          >
            {t("market.reports.admin.restrictApply")}
          </Button>

          <ul className="mt-3 space-y-2 text-desc">
            {(restrictions.data ?? []).map((item) => (
              <li key={item.id} className="rounded-lg bg-muted/50 p-2">
                <p className="font-medium text-foreground">
                  {t(`market.reports.restriction.${item.restriction}`)}
                  <span className="ms-2 font-normal text-muted-foreground">
                    {item.lifted_at
                      ? t("market.reports.violations.lifted")
                      : item.expires_at
                        ? `${t("market.reports.violations.expires")}: ${formatDate(item.expires_at)}`
                        : t("market.reports.violations.permanent")}
                  </span>
                </p>
                <p className="mt-0.5 text-muted-foreground">{item.reason}</p>
                {!item.lifted_at && staff.can("accounts.restrict") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 text-desc"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          liftRestriction(item.id, t("market.reports.admin.lift")).then(() => {
                            void restrictions.refetch();
                          }),
                        staff.can("accounts.restrict"),
                      )
                    }
                  >
                    {t("market.reports.admin.lift")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("market.reports.admin.appeals")}>
          <ul className="space-y-2 text-desc">
            {(appeals.data ?? []).length === 0 && (
              <li className="text-muted-foreground">{t("market.reports.admin.noAppeals")}</li>
            )}
            {(appeals.data ?? []).map((appeal) => (
              <li key={appeal.id} className="rounded-lg border border-border p-2">
                <p className="font-medium text-foreground">
                  {t(`market.reports.appealStatus.${appeal.status}`)} ·{" "}
                  {formatDateTime(appeal.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{appeal.reason}</p>
                {appeal.decision_reason && (
                  <p className="mt-1 text-muted-foreground">{appeal.decision_reason}</p>
                )}
                {staff.can("appeals.review") && !appeal.decided_at && (
                  <AppealDecision
                    appealId={appeal.id}
                    busy={busy}
                    onDone={() => {
                      void appeals.refetch();
                      onChanged();
                    }}
                    run={run}
                    t={t}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <aside className="space-y-4">
        <Section title={t("market.reports.admin.assign")}>
          <p dir="ltr" className="text-desc text-muted-foreground">
            {report.assigned_to
              ? report.assigned_to === currentUserId
                ? t("market.reports.admin.table.me")
                : report.assigned_to
              : t("market.reports.admin.table.unassigned")}
          </p>
          {staff.can("reports.assign") && currentUserId && (
            <Button
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={() =>
                void run(() => assignReport(report.id, currentUserId), staff.can("reports.assign"))
              }
            >
              {t("market.reports.admin.assignToMe")}
            </Button>
          )}
        </Section>

        <Section title={t("market.reports.admin.assessment")}>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="a-priority" className="text-desc">
                {t("market.reports.admin.priority")}
              </Label>
              <select
                id="a-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ReportPriority)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              >
                {REPORT_PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {t(`market.reports.priority.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-severity" className="text-desc">
                {t("market.reports.admin.severity")}
              </Label>
              <select
                id="a-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              >
                {REPORT_SEVERITIES.map((item) => (
                  <option key={item} value={item}>
                    {t(`market.reports.severity.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () => setReportPriority(report.id, priority, severity),
                  staff.can("reports.review"),
                )
              }
            >
              {t("market.reports.admin.apply")}
            </Button>
          </div>
        </Section>

        <Section title={t("market.reports.admin.statusChange")}>
          <div className="space-y-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReportStatus)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              aria-label={t("market.reports.admin.statusChange")}
            >
              {REPORT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(`market.reports.status.${item}`)}
                </option>
              ))}
            </select>
            <Input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder={t("market.reports.admin.statusReason")}
              className="h-8 text-desc"
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () => setReportStatus(report.id, status, statusReason || undefined),
                  status === "escalated"
                    ? staff.can("reports.escalate")
                    : staff.can("reports.review"),
                )
              }
            >
              {t("market.reports.admin.apply")}
            </Button>
          </div>
        </Section>

        <Section title={t("market.reports.admin.closeCase")}>
          <div className="space-y-2">
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
              aria-label={t("market.reports.admin.decision")}
            >
              {DECISIONS.map((item) => (
                <option key={item} value={item}>
                  {t(`market.reports.admin.decisionOptions.${item}`)}
                </option>
              ))}
            </select>
            <Textarea
              rows={3}
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={t("market.reports.admin.decisionReason")}
            />
            <Textarea
              rows={2}
              value={publicOutcome}
              onChange={(e) => setPublicOutcome(e.target.value)}
              placeholder={t("market.reports.admin.publicOutcome")}
            />
            <Button
              size="sm"
              disabled={busy || !decisionReason.trim()}
              onClick={() =>
                void run(
                  () =>
                    closeReport({
                      reportId: report.id,
                      decision,
                      reason: decisionReason.trim(),
                      publicOutcome: publicOutcome.trim() || undefined,
                    }),
                  staff.can("reports.close"),
                )
              }
            >
              {t("market.reports.admin.closeCase")}
            </Button>

            <Input
              value={reopenReasonText}
              onChange={(e) => setReopenReasonText(e.target.value)}
              placeholder={t("market.reports.admin.reopenReason")}
              className="h-8 text-desc"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !reopenReasonText.trim()}
              onClick={() =>
                void run(
                  () => reopenReport(report.id, reopenReasonText.trim()),
                  staff.can("reports.reopen"),
                )
              }
            >
              {t("market.reports.admin.reopen")}
            </Button>

            <Input
              dir="ltr"
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
              placeholder={t("market.reports.admin.mergeInto")}
              className="h-8 text-desc"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !mergeInto.trim()}
              onClick={() =>
                void run(
                  () => mergeReport(report.id, mergeInto.trim()),
                  staff.can("reports.merge"),
                )
              }
            >
              {t("market.reports.admin.merge")}
            </Button>
          </div>
        </Section>

        <Section title={t("market.reports.admin.history")}>
          <ol className="space-y-2 text-desc">
            {(history.data ?? []).map((event) => (
              <li key={event.id} className="border-s-2 border-border ps-2">
                <p className="font-medium text-foreground">
                  {t(`market.reports.status.${event.to_status}`)}
                </p>
                <p className="text-muted-foreground">{formatDateTime(event.created_at)}</p>
                {event.reason && <p className="text-muted-foreground">{event.reason}</p>}
              </li>
            ))}
          </ol>
        </Section>
      </aside>
    </div>
  );
}

function AppealDecision({
  appealId,
  busy,
  onDone,
  run,
  t,
}: {
  appealId: string;
  busy: boolean;
  onDone: () => void;
  run: (action: () => Promise<void>, permitted?: boolean) => Promise<void>;
  t: (key: string) => string;
}) {
  const [status, setStatus] = useState<AppealStatus>("accepted");
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 space-y-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as AppealStatus)}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-desc"
        aria-label={t("market.reports.admin.appealDecide")}
      >
        {(["accepted", "partially_accepted", "rejected", "under_review"] as AppealStatus[]).map(
          (item) => (
            <option key={item} value={item}>
              {t(`market.reports.appealStatus.${item}`)}
            </option>
          ),
        )}
      </select>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("market.reports.admin.appealReason")}
        className="h-8 text-desc"
      />
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await reviewAppeal(appealId, status, reason || undefined);
            onDone();
          })
        }
      >
        {t("market.reports.admin.appealDecide")}
      </Button>
    </div>
  );
}

function StaffChannel({
  reportId,
  channel,
  label,
  canSend,
  t,
}: {
  reportId: string;
  channel: "reporter" | "advertiser";
  label: string;
  canSend: boolean;
  t: (key: string) => string;
}) {
  const [body, setBody] = useState("");
  const [dueDays, setDueDays] = useState("");
  const [busy, setBusy] = useState(false);
  const messages = useQuery({
    queryKey: ["mkt", "admin-thread", reportId, channel],
    queryFn: () => loadReportMessages(reportId, channel),
  });

  async function send(kind: "message" | "info_request") {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await staffMessage({
        reportId,
        channel,
        body: text,
        kind,
        dueDays: kind === "info_request" && dueDays ? Number(dueDays) : undefined,
      });
      setBody("");
      setDueDays("");
      void messages.refetch();
      toast.success(t("market.reports.admin.saved"));
    } catch (error) {
      toast.error(t(`market.reports.err.${reportErrorKey(error)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="text-desc font-semibold text-foreground">{label}</h3>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {(messages.data ?? []).length === 0 ? (
          <p className="text-desc text-muted-foreground">
            {t("market.reports.detail.noMessages")}
          </p>
        ) : (
          (messages.data ?? []).map((message) => (
            <div
              key={message.id}
              className={
                message.sender_side === "staff"
                  ? "rounded-md bg-primary/5 p-2"
                  : "rounded-md bg-muted/60 p-2"
              }
            >
              <p className="whitespace-pre-wrap text-desc text-foreground">{message.body}</p>
              <p className="mt-0.5 text-desc text-muted-foreground">
                {formatDateTime(message.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
      {canSend && (
        <div className="mt-2 space-y-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("market.reports.admin.messagePlaceholder")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              dir="ltr"
              inputMode="numeric"
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
              placeholder={t("market.reports.admin.dueDays")}
              className="h-8 w-28 text-desc"
            />
            <Button size="sm" disabled={busy || !body.trim()} onClick={() => void send("message")}>
              {t("market.reports.admin.send")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !body.trim()}
              onClick={() => void send("info_request")}
            >
              {t("market.reports.admin.requestInfo")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
