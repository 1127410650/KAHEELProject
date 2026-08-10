import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Filter, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import {
  addInternalNote,
  assignReport,
  loadReportNotes,
  loadReportReasons,
  loadStatusHistory,
  loadStaffAccess,
  makeStaffAccess,
  staffMessage,
  REPORT_PRIORITIES,
  type StaffPerm,
} from "@/lib/mkt-reports";
import {
  LR_EXTEND_DAYS,
  LR_LISTING_ACTIONS,
  LR_REASON_REQUIRED,
  LR_STATUSES,
  loadListingReports,
  loadReportStaffOptions,
  lrErrorKey,
  nextStatuses,
  reportListingAction,
  transitionPerm,
  transitionReport,
  type AdminListingReport,
  type LrFilters,
  type LrListingAction,
} from "@/lib/mkt-listing-reports";
import { AdminShell } from "@/components/marketplace/AdminShell";
import {
  AdminListingLink,
  AdminUserLink,
} from "@/components/marketplace/AdminEntityLink";
import { loadAdminSubjectIds, subjectKey } from "@/lib/mkt-admin-subjects";
import { readAdminListState, useAdminListMemory } from "@/lib/use-admin-list-memory";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/admin/listing-reports")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "بلاغات الإعلانات — إدارة كَحيل" },
      {
        name: "description",
        content:
          "لوحة بلاغات الإعلانات في كَحيل: دورة حالات مقيّدة، إجراءات موثّقة بسبب، وحماية كاملة لهوية المبلّغ.",
      },
      { property: "og:title", content: "بلاغات الإعلانات — إدارة كَحيل" },
      { property: "og:description", content: "معالجة بلاغات الإعلانات مع حماية هوية المبلّغ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminListingReportsPage,
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
const PAGE_SIZE = 25;

function AdminListingReportsPage() {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { status: statusParam } = Route.useSearch();
  const remembered = readAdminListState<LrFilters>("listing-reports", {
    page: 0,
    pageSize: PAGE_SIZE,
  });
  const [filters, setFilters] = useState<LrFilters>(
    statusParam ? { ...remembered, status: statusParam, page: 0 } : remembered,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const can = (perm: string) => staff.can(perm as StaffPerm);
  const canView = can("ads.reports_view") || can("reports.inbox_view");

  const reasons = useQuery({ queryKey: ["mkt", "report-reasons"], queryFn: loadReportReasons });
  const staffOptions = useQuery({
    queryKey: ["mkt", "report-staff-options"],
    enabled: canView,
    queryFn: loadReportStaffOptions,
  });
  const rows = useQuery({
    queryKey: ["mkt", "listing-reports", filters],
    enabled: canView,
    queryFn: () => loadListingReports(filters),
  });

  const list = rows.data ?? [];
  const total = list[0]?.total_count ?? 0;
  const current = list.find((r) => r.id === openId) ?? null;

  useAdminListMemory("listing-reports", filters, !rows.isLoading);

  // Identifiers only: the server withholds the reporter unless this admin may
  // unmask reporters, so an unauthorised reviewer simply gets no link.
  const reportIds = useMemo(() => list.map((r) => r.id), [list]);
  const subjects = useQuery({
    queryKey: ["mkt", "admin", "report-subjects", reportIds],
    enabled: canView && reportIds.length > 0,
    queryFn: () => loadAdminSubjectIds({ reportIds }),
  });
  const subjectMap = subjects.data ?? {};

  function set<K extends keyof LrFilters>(key: K, value: LrFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
  }


  const filterFields = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="lr-status" className="text-desc">
          {t("market.lr.filters.status")}
        </Label>
        <select
          id="lr-status"
          value={filters.status ?? ""}
          onChange={(e) => set("status", e.target.value)}
          className={selectClass}
        >
          <option value="">{t("market.lr.filters.all")}</option>
          {LR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`market.lr.status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lr-reason" className="text-desc">
          {t("market.lr.filters.reason")}
        </Label>
        <select
          id="lr-reason"
          value={filters.reason ?? ""}
          onChange={(e) => set("reason", e.target.value)}
          className={selectClass}
        >
          <option value="">{t("market.lr.filters.all")}</option>
          {(reasons.data ?? []).map((r) => (
            <option key={r.code} value={r.code}>
              {locale === "ar" ? r.name_ar : r.name_en}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lr-priority" className="text-desc">
          {t("market.lr.filters.priority")}
        </Label>
        <select
          id="lr-priority"
          value={filters.priority ?? ""}
          onChange={(e) => set("priority", e.target.value)}
          className={selectClass}
        >
          <option value="">{t("market.lr.filters.all")}</option>
          {REPORT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`market.reports.priority.${p}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lr-assignee" className="text-desc">
          {t("market.lr.filters.assignee")}
        </Label>
        <select
          id="lr-assignee"
          value={filters.assignee ?? ""}
          onChange={(e) => set("assignee", e.target.value)}
          className={selectClass}
        >
          <option value="">{t("market.lr.filters.all")}</option>
          {(staffOptions.data ?? []).map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lr-from" className="text-desc">
          {t("market.lr.filters.from")}
        </Label>
        <Input
          id="lr-from"
          type="date"
          dir="ltr"
          value={filters.from ?? ""}
          onChange={(e) => set("from", e.target.value)}
          className="h-10"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lr-to" className="text-desc">
          {t("market.lr.filters.to")}
        </Label>
        <Input
          id="lr-to"
          type="date"
          dir="ltr"
          value={filters.to ?? ""}
          onChange={(e) => set("to", e.target.value)}
          className="h-10"
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 self-end text-desc text-foreground">
        <input
          type="checkbox"
          checked={filters.suspendedOnly ?? false}
          onChange={(e) => set("suspendedOnly", e.target.checked)}
          className="size-4"
        />
        {t("market.lr.filters.suspendedOnly")}
      </label>
      <div className="self-end">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => setFilters({ page: 0, pageSize: PAGE_SIZE })}
        >
          {t("market.lr.filters.clear")}
        </Button>
      </div>
    </div>
  );

  return (
    <AdminShell
      title={t("market.lr.title")}
      staffAccess={canView}
      staffChecking={access.isLoading}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="lr-search" className="text-desc">
            {t("market.lr.searchLabel")}
          </Label>
          <Input
            id="lr-search"
            value={filters.search ?? ""}
            onChange={(e) => set("search", e.target.value)}
            placeholder={t("market.lr.searchPlaceholder")}
            className="h-10"
          />
        </div>
        <Button
          variant="outline"
          className="min-h-11 lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <Filter className="me-1 size-4" aria-hidden />
          {t("market.lr.filters.open")}
        </Button>
      </div>

      <div className="mt-3 hidden rounded-xl border border-border bg-card p-3 lg:block">
        {filterFields}
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("market.lr.filters.open")}</SheetTitle>
          </SheetHeader>
          <div className="mt-3">{filterFields}</div>
          <Button className="mt-4 min-h-11 w-full" onClick={() => setFiltersOpen(false)}>
            {t("market.lr.filters.apply")}
          </Button>
        </SheetContent>
      </Sheet>

      {rows.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      ) : rows.isError ? (
        <p className="mt-8 text-center text-sm text-destructive">
          {t(`market.lr.err.${lrErrorKey(rows.error)}`)}
        </p>
      ) : list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">{t("market.lr.empty")}</p>
      ) : (
        <>
          {/* mobile: cards */}
          <ul className="mt-4 space-y-2 lg:hidden">
            {list.map((r) => (
              <li key={r.id}>
                <ReportCard
                  report={r}
                  ownerUserId={subjectMap[subjectKey("report_owner", r.id)] ?? null}
                  onOpen={() => setOpenId(r.id)}
                />
              </li>
            ))}

          </ul>

          {/* desktop: table */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border border-border lg:block">
            <table className="w-full text-start text-desc">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.ref")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.listing")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.owner")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.reason")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.status")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.priority")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.count")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.assignee")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.lastAction")}</th>
                  <th className="p-2 text-start font-medium">{t("market.lr.col.updated")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td dir="ltr" className="p-2 font-mono font-bold text-foreground">
                      {r.ref_no ?? "—"}
                    </td>
                    <td className="max-w-[220px] p-2">
                      <AdminListingLink
                        id={r.listing_id}
                        name={r.listing_title}
                        truncate
                        className="text-desc"
                      />
                      <p dir="ltr" className="font-mono text-desc text-muted-foreground">
                        {r.listing_ref ?? "—"}
                      </p>
                    </td>
                    <td className="max-w-[160px] p-2">
                      <AdminUserLink
                        id={subjectMap[subjectKey("report_owner", r.id)] ?? null}
                        name={r.owner_label}
                        truncate
                        className="text-desc"
                      />
                      <p className="truncate text-desc text-muted-foreground">
                        {r.owner_business ?? "—"}
                      </p>
                    </td>

                    <td className="p-2 text-foreground">
                      {(locale === "ar" ? r.reason_name_ar : r.reason_name_en) ?? r.reason_code ?? "—"}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{t(`market.lr.status.${r.status}`)}</Badge>
                    </td>
                    <td className="p-2 text-foreground">
                      {t(`market.reports.priority.${r.priority}`)}
                    </td>
                    <td dir="ltr" className="p-2 text-foreground">
                      {r.listing_report_count}
                    </td>
                    <td className="p-2 text-foreground">
                      {r.assignee_label ?? t("market.lr.unassigned")}
                    </td>
                    <td className="p-2 text-foreground">
                      {r.last_action ? t(`market.lr.status.${r.last_action}`) : "—"}
                    </td>
                    <td dir="ltr" className="p-2 text-muted-foreground">
                      {formatDateTime(r.updated_at)}
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
                        {t("market.lr.openCase")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={(filters.page ?? 0) === 0}
              onClick={() => setFilters((p) => ({ ...p, page: Math.max((p.page ?? 0) - 1, 0) }))}
            >
              {t("market.lr.prev")}
            </Button>
            <span dir="ltr" className="text-desc text-muted-foreground">
              {(filters.page ?? 0) * PAGE_SIZE + 1}–{(filters.page ?? 0) * PAGE_SIZE + list.length}{" "}
              / {total}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={((filters.page ?? 0) + 1) * PAGE_SIZE >= total}
              onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 0) + 1 }))}
            >
              {t("market.lr.next")}
            </Button>
          </div>
        </>
      )}

      <Sheet open={!!current} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto sm:max-w-none">
          {current && (
            <CaseDrawer
              report={current}
              can={can}
              staffOptions={staffOptions.data ?? []}
              ownerUserId={subjectMap[subjectKey("report_owner", current.id)] ?? null}
              reporterUserId={subjectMap[subjectKey("report_reporter", current.id)] ?? null}
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: ["mkt", "listing-reports"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}

function ReportCard({
  report,
  ownerUserId,
  onOpen,
}: {
  report: AdminListingReport;
  ownerUserId: string | null;
  onOpen: () => void;
}) {
  const { t, locale } = useI18n();
  const overdue =
    !!report.sla_due_at &&
    new Date(report.sla_due_at).getTime() < Date.now() &&
    !["closed", "invalid"].includes(report.status);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="ltr" className="font-mono text-desc font-bold text-foreground">
            {report.ref_no ?? "—"}
          </p>
          <AdminListingLink
            id={report.listing_id}
            name={report.listing_title}
            truncate
            className="mt-1 min-h-11 py-2.5 text-sm font-medium"
          />
          <p dir="ltr" className="font-mono text-desc text-muted-foreground">
            {report.listing_ref ?? "—"}
          </p>
        </div>
        <Badge variant="outline">{t(`market.lr.status.${report.status}`)}</Badge>
      </div>
      <p className="mt-2 text-desc text-muted-foreground">
        {(locale === "ar" ? report.reason_name_ar : report.reason_name_en) ??
          report.reason_code ??
          "—"}{" "}
        · {t(`market.reports.priority.${report.priority}`)} ·{" "}
        {t("market.lr.col.count")}: <span dir="ltr">{report.listing_report_count}</span>
      </p>
      <p className="mt-1 text-desc text-muted-foreground">
        <AdminUserLink id={ownerUserId} name={report.owner_label} className="text-desc" />
        {report.owner_business ? ` · ${report.owner_business}` : ""}
      </p>

      <p className="mt-1 text-desc text-muted-foreground">
        {report.assignee_label ?? t("market.lr.unassigned")} · {formatDateTime(report.updated_at)}
        {overdue && (
          <span className="ms-2 font-medium text-destructive">
            <AlertTriangle className="me-1 inline size-3" aria-hidden />
            {t("market.reports.admin.overdue")}
          </span>
        )}
      </p>
      <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={onOpen}>
        {t("market.lr.openCase")}
      </Button>
    </div>
  );
}

function CaseDrawer({
  report,
  can,
  staffOptions,
  ownerUserId,
  reporterUserId,
  onDone,
}: {
  report: AdminListingReport;
  can: (perm: string) => boolean;
  staffOptions: { user_id: string; label: string }[];
  /** Ids only; the server withheld them when this admin may not see them. */
  ownerUserId: string | null;
  reporterUserId: string | null;
  onDone: () => void;
}) {

  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(report.assigned_to ?? "");
  const [listingAction, setListingAction] = useState<LrListingAction>("suspend");
  const [days, setDays] = useState<number>(7);
  const [note, setNote] = useState("");
  const [ownerMsg, setOwnerMsg] = useState("");
  const [reporterMsg, setReporterMsg] = useState("");

  const notes = useQuery({
    queryKey: ["mkt", "lr-notes", report.id],
    enabled: can("ads.reports_internal_notes") || can("reports.add_internal_note"),
    queryFn: () => loadReportNotes(report.id),
  });
  const history = useQuery({
    queryKey: ["mkt", "lr-history", report.id],
    queryFn: () => loadStatusHistory(report.id),
  });

  function run<T>(fn: () => Promise<T>, successKey: string) {
    return {
      mutationFn: fn,
      onSuccess: () => {
        toast.success(t(successKey));
        setReason("");
        void notes.refetch();
        void history.refetch();
        onDone();
      },
      onError: (err: unknown) => toast.error(t(`market.lr.err.${lrErrorKey(err)}`)),
    };
  }

  const transition = useMutation({
    mutationFn: (to: string) => transitionReport(report.id, to, reason),
    onSuccess: () => {
      toast.success(t("market.lr.done"));
      setReason("");
      void history.refetch();
      onDone();
    },
    onError: (err: unknown) => toast.error(t(`market.lr.err.${lrErrorKey(err)}`)),
  });

  const assign = useMutation(
    run(() => assignReport(report.id, assignee), "market.lr.assigned"),
  );
  const listingMut = useMutation({
    mutationFn: () =>
      reportListingAction({
        reportId: report.id,
        action: listingAction,
        reason,
        ...(listingAction === "extend" ? { days } : {}),
      }),
    onSuccess: () => {
      toast.success(t("market.lr.done"));
      setReason("");
      void history.refetch();
      onDone();
    },
    onError: (err: unknown) => toast.error(t(`market.lr.err.${lrErrorKey(err)}`)),
  });
  const noteMut = useMutation({
    mutationFn: () => addInternalNote(report.id, note),
    onSuccess: () => {
      setNote("");
      toast.success(t("market.lr.noteSaved"));
      void notes.refetch();
    },
    onError: (err: unknown) => toast.error(t(`market.lr.err.${lrErrorKey(err)}`)),
  });
  const ownerMut = useMutation({
    mutationFn: () => staffMessage({ reportId: report.id, channel: "advertiser", body: ownerMsg }),
    onSuccess: () => {
      setOwnerMsg("");
      toast.success(t("market.lr.messageSent"));
      onDone();
    },
    onError: (err: unknown) => toast.error(t(`market.lr.err.${lrErrorKey(err)}`)),
  });
  const reporterMut = useMutation({
    mutationFn: () =>
      staffMessage({
        reportId: report.id,
        channel: "reporter",
        body: reporterMsg,
        kind: "info_request",
      }),
    onSuccess: () => {
      setReporterMsg("");
      toast.success(t("market.lr.messageSent"));
      onDone();
    },
    onError: (err: unknown) => toast.error(t(`market.lr.err.${lrErrorKey(err)}`)),
  });

  const busy =
    transition.isPending ||
    assign.isPending ||
    listingMut.isPending ||
    noteMut.isPending ||
    ownerMut.isPending ||
    reporterMut.isPending;

  const nexts = useMemo(() => nextStatuses(report.status), [report.status]);

  return (
    <div className="mx-auto w-full max-w-3xl pb-4">
      <SheetHeader className="px-0">
        <SheetTitle className="text-start text-base">
          <span dir="ltr" className="font-mono">
            {report.ref_no ?? "—"}
          </span>{" "}
          — {report.listing_title ?? "—"}
        </SheetTitle>
      </SheetHeader>

      <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card p-3 text-desc sm:grid-cols-2">
        <Row label={t("market.lr.col.listing")} value={report.listing_ref ?? "—"} ltr />
        <div className="flex items-baseline justify-between gap-2 py-1">
          <span className="text-desc text-muted-foreground">{t("market.lr.col.owner")}</span>
          <AdminUserLink id={ownerUserId} name={report.owner_label} className="text-desc" />
        </div>
        <Row label={t("market.lr.col.business")} value={report.owner_business ?? "—"} />
        <Row
          label={t("market.lr.col.reason")}
          value={
            (locale === "ar" ? report.reason_name_ar : report.reason_name_en) ??
            report.reason_code ??
            "—"
          }
        />
        <Row label={t("market.lr.col.status")} value={t(`market.lr.status.${report.status}`)} />
        <Row
          label={t("market.lr.col.priority")}
          value={t(`market.reports.priority.${report.priority}`)}
        />
        <Row label={t("market.lr.col.count")} value={String(report.listing_report_count)} ltr />
        <Row
          label={t("market.lr.col.assignee")}
          value={report.assignee_label ?? t("market.lr.unassigned")}
        />
        <Row label={t("market.lr.col.created")} value={formatDateTime(report.created_at)} ltr />
        <Row label={t("market.lr.col.updated")} value={formatDateTime(report.updated_at)} ltr />
        <div className="flex items-baseline justify-between gap-2 py-1">
          <span className="text-desc text-muted-foreground">{t("market.lr.reporter")}</span>
          {report.can_view_reporter && reporterUserId ? (
            <AdminUserLink
              id={reporterUserId}
              name={report.reporter_identity ?? report.reporter_alias}
              className="text-desc"
            />
          ) : (
            <span className="text-desc text-foreground">
              {report.can_view_reporter && report.reporter_identity
                ? report.reporter_identity
                : report.reporter_alias}
            </span>
          )}
        </div>
        <Row
          label={t("market.lr.reporterInvalid")}
          value={String(report.reporter_invalid_count)}
          ltr
        />

      </div>

      {report.note && (
        <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 text-desc text-foreground">
          {report.note}
        </p>
      )}

      {!report.can_view_reporter && (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-desc text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("market.lr.identityHidden")}
        </p>
      )}

      {/* stays inside the admin shell instead of opening the public page */}
      <AdminListingLink
        id={report.listing_id}
        name={t("market.lr.openListing")}
        className="mt-3 min-h-11 py-2.5 text-desc font-medium"
      />


      {/* reason shared by every decision */}
      <div className="mt-4 space-y-1">
        <Label htmlFor="lr-reason-input" className="text-desc">
          {t("market.lr.reasonLabel")}
        </Label>
        <Textarea
          id="lr-reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      {/* lifecycle */}
      <section className="mt-4">
        <h2 className="text-section font-bold text-foreground">{t("market.lr.lifecycle")}</h2>
        {nexts.length === 0 ? (
          <p className="mt-1 text-desc text-muted-foreground">{t("market.lr.noTransitions")}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {nexts.map((to) => {
              const needsReason = LR_REASON_REQUIRED.includes(to);
              const allowed = can(transitionPerm(to));
              return (
                <Button
                  key={to}
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy || !allowed || (needsReason && !reason.trim())}
                  onClick={() => transition.mutate(to)}
                >
                  {transition.isPending && <Loader2 className="me-1 size-3 animate-spin" />}
                  {t(`market.lr.to.${to}`)}
                </Button>
              );
            })}
          </div>
        )}
      </section>

      {/* assignment */}
      {(can("ads.reports_assign") || can("reports.assign") || can("ads.reports_manage")) && (
        <section className="mt-4 space-y-2">
          <h2 className="text-section font-bold text-foreground">{t("market.lr.assignment")}</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className={`${selectClass} sm:max-w-xs`}
              aria-label={t("market.lr.assignment")}
            >
              <option value="">{t("market.lr.pickStaff")}</option>
              {staffOptions.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="min-h-11"
              disabled={busy || !assignee}
              onClick={() => assign.mutate()}
            >
              {report.assigned_to ? t("market.lr.transfer") : t("market.lr.assign")}
            </Button>
          </div>
        </section>
      )}

      {/* listing enforcement */}
      <section className="mt-4 space-y-2">
        <h2 className="text-section font-bold text-foreground">{t("market.lr.listingActions")}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={listingAction}
            onChange={(e) => setListingAction(e.target.value as LrListingAction)}
            className={`${selectClass} sm:max-w-xs`}
            aria-label={t("market.lr.listingActions")}
          >
            {LR_LISTING_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`market.lr.action.${a}`)}
              </option>
            ))}
          </select>
          {listingAction === "extend" && (
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={`${selectClass} sm:max-w-[140px]`}
              aria-label={t("market.lr.days")}
            >
              {LR_EXTEND_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            className="min-h-11"
            disabled={busy || !reason.trim()}
            onClick={() => listingMut.mutate()}
          >
            {listingMut.isPending && <Loader2 className="me-1 size-3 animate-spin" />}
            {t("market.lr.apply")}
          </Button>
        </div>
      </section>

      {/* internal note */}
      {(can("ads.reports_internal_notes") || can("reports.add_internal_note")) && (
        <section className="mt-4 space-y-2">
          <h2 className="text-section font-bold text-foreground">{t("market.lr.internalNotes")}</h2>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="text-sm"
            placeholder={t("market.lr.notePlaceholder")}
          />
          <Button
            size="sm"
            className="min-h-11"
            disabled={busy || !note.trim()}
            onClick={() => noteMut.mutate()}
          >
            {t("market.lr.addNote")}
          </Button>
          <ul className="space-y-1">
            {(notes.data ?? []).map((n) => (
              <li key={n.id} className="rounded-lg border border-border bg-muted/40 p-2 text-desc">
                <span dir="ltr" className="text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* owner message */}
      {(can("ads.reports_contact_owner") || can("reports.message_advertiser")) && (
        <section className="mt-4 space-y-2">
          <h2 className="text-section font-bold text-foreground">{t("market.lr.contactOwner")}</h2>
          <Textarea
            value={ownerMsg}
            onChange={(e) => setOwnerMsg(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button
            size="sm"
            className="min-h-11"
            disabled={busy || !ownerMsg.trim()}
            onClick={() => ownerMut.mutate()}
          >
            {t("market.lr.send")}
          </Button>
        </section>
      )}

      {/* reporter reply */}
      {(can("ads.reports_reply_reporter") || can("reports.message_reporter")) && (
        <section className="mt-4 space-y-2">
          <h2 className="text-section font-bold text-foreground">{t("market.lr.replyReporter")}</h2>
          <p className="text-desc text-muted-foreground">{t("market.lr.replyReporterHint")}</p>
          <Textarea
            value={reporterMsg}
            onChange={(e) => setReporterMsg(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button
            size="sm"
            className="min-h-11"
            disabled={busy || !reporterMsg.trim()}
            onClick={() => reporterMut.mutate()}
          >
            {t("market.lr.send")}
          </Button>
        </section>
      )}

      {/* status history */}
      <section className="mt-4">
        <h2 className="text-section font-bold text-foreground">{t("market.lr.history")}</h2>
        <ul className="mt-2 space-y-1">
          {(history.data ?? []).map((h) => (
            <li key={h.id} className="rounded-lg border border-border bg-card p-2 text-desc">
              <span className="text-foreground">
                {h.from_status ? t(`market.lr.status.${h.from_status}`) : "—"} →{" "}
                {t(`market.lr.status.${h.to_status}`)}
              </span>
              <span dir="ltr" className="ms-2 text-muted-foreground">
                {formatDateTime(h.created_at)}
              </span>
              {h.reason && <p className="mt-1 text-muted-foreground">{h.reason}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-desc text-muted-foreground">{label}</p>
      <p
        {...(ltr ? { dir: "ltr" as const } : {})}
        className="truncate text-desc font-medium text-foreground"
      >
        {value}
      </p>
    </div>
  );
}
