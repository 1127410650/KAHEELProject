import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { usePlatformIdentity } from "@/lib/mkt-platform";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  addDays,
  adminSetAttendance,
  approveAttendance,
  attendanceErrorKey,
  formatMinutes,
  loadAttendance,
  loadAttendanceEdits,
  loadShiftTemplates,
  loadShifts,
  riyadhToday,
  setShift,
  type AttendanceRow,
  type ShiftRow,
} from "@/lib/mkt-attendance";
import { loadWorkforceStaff, type StaffRow } from "@/lib/mkt-workforce";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/attendance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الحضور والمناوبات — إدارة المنصة" },
      {
        name: "description",
        content:
          "متابعة حضور موظفي المنصة وانصرافهم، وتخطيط المناوبات، والتعديل الإداري المسبَّب بتوقيت الرياض.",
      },
      { property: "og:title", content: "الحضور والمناوبات — إدارة المنصة" },
      { property: "og:description", content: "حضور الموظفين والمناوبات والتعديلات الإدارية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttendanceAdminPage,
});

type Tab = "attendance" | "shifts";

function AttendanceAdminPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { identity, loading } = usePlatformIdentity();

  const today = riyadhToday();
  const [tab, setTab] = useState<Tab>("attendance");
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [planning, setPlanning] = useState<{ userId: string; date: string } | null>(null);
  const [trail, setTrail] = useState<AttendanceRow | null>(null);

  const perms = identity?.staff_perms ?? [];
  const owner = identity?.platform_role === "system_owner";
  const canView = owner || perms.some((p) => p.startsWith("attendance."));
  const canManage = owner || perms.includes("attendance.manage");

  const staff = useQuery({
    queryKey: ["mkt", "admin", "attendance", "staff"],
    queryFn: loadWorkforceStaff,
    enabled: canView,
    retry: false,
  });
  const templates = useQuery({
    queryKey: ["mkt", "admin", "attendance", "templates"],
    queryFn: loadShiftTemplates,
    enabled: canView,
  });
  const rows = useQuery({
    queryKey: ["mkt", "admin", "attendance", "rows", from, to, staffFilter],
    queryFn: () => loadAttendance(from, to, staffFilter === "all" ? null : staffFilter),
    enabled: canView && tab === "attendance",
  });
  const shifts = useQuery({
    queryKey: ["mkt", "admin", "attendance", "shifts", from, to, staffFilter],
    queryFn: () => loadShifts(from, to, staffFilter === "all" ? null : staffFilter),
    enabled: canView && tab === "shifts",
  });
  const edits = useQuery({
    queryKey: ["mkt", "admin", "attendance", "edits", trail?.id ?? ""],
    queryFn: () => loadAttendanceEdits(trail?.id ?? ""),
    enabled: trail !== null,
  });

  const staffList = useMemo<StaffRow[]>(() => staff.data ?? [], [staff.data]);
  const staffName = (row: { user_id: string; label?: string | null }) =>
    row.label?.trim() ||
    staffList.find((s) => s.user_id === row.user_id)?.label ||
    t("admin.attendance.unnamed");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      toast.success(t("admin.actionDone"));
      setEditing(null);
      setPlanning(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "attendance"] });
    } catch (error) {
      toast.error(t(attendanceErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title={t("admin.attendance.title")} staffAccess={canView} staffChecking={loading}>
      <p className="text-xs text-muted-foreground">{t("admin.attendance.hint")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["attendance", "shifts"] as Tab[]).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={tab === item ? "default" : "outline"}
            className="min-h-10"
            onClick={() => setTab(item)}
          >
            {t(`admin.attendance.tab.${item}`)}
          </Button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="att-from" className="text-[11px]">
            {t("admin.attendance.from")}
          </Label>
          <Input
            id="att-from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 h-10"
          />
        </div>
        <div>
          <Label htmlFor="att-to" className="text-[11px]">
            {t("admin.attendance.to")}
          </Label>
          <Input
            id="att-to"
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 h-10"
          />
        </div>
        <div>
          <Label className="text-[11px]">{t("admin.attendance.staff")}</Label>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="mt-1 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.attendance.allStaff")}</SelectItem>
              {staffList.map((row) => (
                <SelectItem key={row.user_id} value={row.user_id}>
                  {row.label || row.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tab === "attendance" ? (
        rows.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full rounded-xl" />
        ) : (rows.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("admin.attendance.empty")}</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {(rows.data ?? []).map((row) => (
              <article key={row.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {staffName(row)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatDate(row.work_date)}</span>
                      <span>{t(`admin.attendance.status.${row.status}`)}</span>
                      {row.remote && <span>{t("admin.attendance.remote")}</span>}
                      {row.source === "admin" && <span>{t("admin.attendance.adminEdited")}</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted-foreground">
                      <span>
                        {t("admin.attendance.in")}:{" "}
                        {row.checked_in_at ? formatDateTime(row.checked_in_at) : "—"}
                      </span>
                      <span>
                        {t("admin.attendance.out")}:{" "}
                        {row.checked_out_at ? formatDateTime(row.checked_out_at) : "—"}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted-foreground">
                      <span>
                        {t("admin.attendance.planned")}: {formatMinutes(row.planned_minutes)}
                      </span>
                      <span>
                        {t("admin.attendance.actual")}: {formatMinutes(row.actual_minutes)}
                      </span>
                      {row.late_minutes > 0 && (
                        <span>
                          {t("admin.attendance.late")}: {formatMinutes(row.late_minutes)}
                        </span>
                      )}
                      {row.early_leave_minutes > 0 && (
                        <span>
                          {t("admin.attendance.early")}: {formatMinutes(row.early_leave_minutes)}
                        </span>
                      )}
                      {row.overtime_minutes > 0 && (
                        <span>
                          {t("admin.attendance.overtime")}: {formatMinutes(row.overtime_minutes)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {row.edits_count > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-10"
                        onClick={() => setTrail(row)}
                      >
                        {t("admin.attendance.trail")} ({row.edits_count})
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-10"
                          onClick={() => setEditing(row)}
                        >
                          {t("admin.attendance.correct")}
                        </Button>
                        {!row.approved_at && (
                          <Button
                            size="sm"
                            className="min-h-10"
                            disabled={busy}
                            onClick={() => void run(() => approveAttendance(row.id))}
                          >
                            {t("admin.attendance.approve")}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : shifts.isLoading ? (
        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
      ) : (
        <div className="mt-4 grid gap-2">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-10 justify-self-start"
              onClick={() =>
                setPlanning({
                  userId: staffFilter === "all" ? (staffList[0]?.user_id ?? ""), date: to },
                )
              }
              disabled={staffList.length === 0}
            >
              {t("admin.attendance.planShift")}
            </Button>
          )}
          {(shifts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.attendance.noShifts")}</p>
          ) : (
            (shifts.data ?? []).map((row: ShiftRow) => (
              <article key={row.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {staffName(row)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatDate(row.work_date)}</span>
                      <span>{t(`admin.attendance.shiftKind.${row.kind}`)}</span>
                      {row.planned_start && row.planned_end && (
                        <span>
                          {row.planned_start.slice(0, 5)} – {row.planned_end.slice(0, 5)}
                        </span>
                      )}
                      <span>
                        {t("admin.attendance.planned")}: {formatMinutes(row.planned_minutes)}
                      </span>
                      {row.remote && <span>{t("admin.attendance.remote")}</span>}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-10 shrink-0"
                      onClick={() => setPlanning({ userId: row.user_id, date: row.work_date })}
                    >
                      {t("common.edit")}
                    </Button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      <CorrectionDialog
        row={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSubmit={(values) =>
          void run(() =>
            adminSetAttendance({
              userId: editing!.user_id,
              workDate: editing!.work_date,
              checkedIn: values.checkedIn,
              checkedOut: values.checkedOut,
              remote: values.remote,
              note: values.note,
              reason: values.reason,
            }),
          )
        }
      />

      <ShiftDialog
        target={planning}
        busy={busy}
        staff={staffList}
        templates={templates.data ?? []}
        lang={lang}
        onCancel={() => setPlanning(null)}
        onSubmit={(values) =>
          void run(() =>
            setShift({
              userId: values.userId,
              workDate: values.date,
              template: values.template,
              remote: values.remote,
              note: values.note,
              reason: values.reason,
            }),
          )
        }
      />

      <Dialog open={trail !== null} onOpenChange={(open) => !open && setTrail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.attendance.trail")}</DialogTitle>
          </DialogHeader>
          {edits.isLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : (
            <ul className="grid max-h-72 gap-2 overflow-y-auto text-[11px]">
              {(edits.data ?? []).map((edit) => (
                <li key={edit.id} className="rounded-lg border border-border p-2">
                  <p className="tabular-nums text-muted-foreground">
                    {formatDateTime(edit.created_at)}
                  </p>
                  <p className="mt-1 text-foreground">{edit.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Riyadh wall-clock input back to an absolute instant (+03:00, no DST). */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return `${value}:00+03:00`;
}

function CorrectionDialog({
  row,
  busy,
  onCancel,
  onSubmit,
}: {
  row: AttendanceRow | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    checkedIn: string | null;
    checkedOut: string | null;
    remote: boolean;
    note: string | null;
    reason: string;
  }) => void;
}) {
  const { t } = useI18n();
  const [checkedIn, setCheckedIn] = useState("");
  const [checkedOut, setCheckedOut] = useState("");
  const [remote, setRemote] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [key, setKey] = useState<string | null>(null);

  if (row && key !== row.id) {
    setKey(row.id);
    setCheckedIn(toLocalInput(row.checked_in_at));
    setCheckedOut(toLocalInput(row.checked_out_at));
    setRemote(row.remote);
    setNote(row.note ?? "");
    setReason("");
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.attendance.correct")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="corr-in" className="text-[11px]">
              {t("admin.attendance.in")}
            </Label>
            <Input
              id="corr-in"
              type="datetime-local"
              value={checkedIn}
              onChange={(event) => setCheckedIn(event.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label htmlFor="corr-out" className="text-[11px]">
              {t("admin.attendance.out")}
            </Label>
            <Input
              id="corr-out"
              type="datetime-local"
              value={checkedOut}
              onChange={(event) => setCheckedOut(event.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="corr-remote" className="text-[11px]">
              {t("admin.attendance.remote")}
            </Label>
            <Switch id="corr-remote" checked={remote} onCheckedChange={setRemote} />
          </div>
          <div>
            <Label htmlFor="corr-note" className="text-[11px]">
              {t("admin.attendance.note")}
            </Label>
            <Textarea
              id="corr-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 min-h-16"
            />
          </div>
          <div>
            <Label htmlFor="corr-reason" className="text-[11px]">
              {t("admin.reasonLabel")}
            </Label>
            <Textarea
              id="corr-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 min-h-16"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-10" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            className="min-h-10"
            disabled={busy || reason.trim().length < 3}
            onClick={() =>
              onSubmit({
                checkedIn: fromLocalInput(checkedIn),
                checkedOut: fromLocalInput(checkedOut),
                remote,
                note: note.trim() || null,
                reason: reason.trim(),
              })
            }
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftDialog({
  target,
  busy,
  staff,
  templates,
  lang,
  onCancel,
  onSubmit,
}: {
  target: { userId: string; date: string } | null;
  busy: boolean;
  staff: StaffRow[];
  templates: { code: string; name_ar: string; name_en: string }[];
  lang: string;
  onCancel: () => void;
  onSubmit: (values: {
    userId: string;
    date: string;
    template: string | null;
    remote: boolean;
    note: string | null;
    reason: string | null;
  }) => void;
}) {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState("");
  const [template, setTemplate] = useState("");
  const [remote, setRemote] = useState(false);
  const [note, setNote] = useState("");
  const [key, setKey] = useState<string | null>(null);

  const currentKey = target ? `${target.userId}:${target.date}` : null;
  if (target && key !== currentKey) {
    setKey(currentKey);
    setUserId(target.userId);
    setDate(target.date);
    setTemplate("");
    setRemote(false);
    setNote("");
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.attendance.planShift")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="text-[11px]">{t("admin.attendance.staff")}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="mt-1 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staff.map((row) => (
                  <SelectItem key={row.user_id} value={row.user_id}>
                    {row.label || row.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="shift-date" className="text-[11px]">
              {t("admin.attendance.date")}
            </Label>
            <Input
              id="shift-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 h-10"
            />
          </div>
          <div>
            <Label className="text-[11px]">{t("admin.attendance.template")}</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="mt-1 h-10">
                <SelectValue placeholder={t("admin.attendance.template")} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {lang === "en" ? item.name_en : item.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="shift-remote" className="text-[11px]">
              {t("admin.attendance.remote")}
            </Label>
            <Switch id="shift-remote" checked={remote} onCheckedChange={setRemote} />
          </div>
          <div>
            <Label htmlFor="shift-note" className="text-[11px]">
              {t("admin.attendance.note")}
            </Label>
            <Textarea
              id="shift-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 min-h-16"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-10" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            className="min-h-10"
            disabled={busy || !userId || !date || !template}
            onClick={() =>
              onSubmit({
                userId,
                date,
                template,
                remote,
                note: note.trim() || null,
                reason: null,
              })
            }
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
