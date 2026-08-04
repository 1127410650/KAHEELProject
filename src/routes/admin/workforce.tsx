import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Shuffle, UserCheck } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  LEAVE_KINDS,
  SELF_WORK_STATES,
  WORK_PRIORITIES,
  WORK_PROGRESS,
  WORK_STATES,
  addLeave,
  cancelLeave,
  distributeWork,
  loadDepartments,
  loadLeaves,
  loadWorkQueue,
  loadWorkforceOverview,
  loadWorkforceStaff,
  saveStaff,
  setWorkPriority,
  setWorkProgress,
  workItemHref,
  workforceErrorKey,
  type LeaveKind,
  type QueueScope,
  type StaffRow,
  type WorkItem,
  type WorkPriority,
  type WorkProgress,
  type WorkState,
} from "@/lib/mkt-workforce";
import { claimSubject, transferSubject } from "@/lib/mkt-admin-queue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/workforce")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "توزيع الأعمال والموظفون — إدارة المنصة" },
      {
        name: "description",
        content:
          "توزيع أعمال الإدارة آليًا وبعدالة بين الموظفين المتاحين، مع حالة العمل والحد التشغيلي والإجازات والقائمة المشتركة.",
      },
      { property: "og:title", content: "توزيع الأعمال والموظفون — إدارة المنصة" },
      { property: "og:description", content: "إدارة القوى العاملة وقائمة الأعمال في منصة تحقّق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminWorkforcePage,
});

const STAFF_KEY = ["mkt", "admin", "workforce", "staff"];
const OVERVIEW_KEY = ["mkt", "admin", "workforce", "overview"];

type Pending =
  | { kind: "staff"; row: StaffRow; state?: WorkState; capacity?: number; auto?: boolean; department?: string }
  | { kind: "leaveCancel"; id: string }
  | { kind: "priority"; item: WorkItem; priority: WorkPriority }
  | { kind: "transfer"; item: WorkItem; to: string };

function AdminWorkforcePage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<QueueScope>("all");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveFor, setLeaveFor] = useState<StaffRow | null>(null);

  const staff = useQuery({ queryKey: STAFF_KEY, queryFn: loadWorkforceStaff });
  const overview = useQuery({ queryKey: OVERVIEW_KEY, queryFn: loadWorkforceOverview });
  const departments = useQuery({
    queryKey: ["mkt", "admin", "workforce", "departments"],
    queryFn: loadDepartments,
  });
  const leaves = useQuery({ queryKey: ["mkt", "admin", "workforce", "leaves"], queryFn: () => loadLeaves() });
  const queue = useQuery({
    queryKey: ["mkt", "admin", "workforce", "queue", scope],
    queryFn: () => loadWorkQueue(scope),
  });

  const rows = staff.data ?? [];
  const items = queue.data ?? [];
  const stats = overview.data ?? {};

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: STAFF_KEY }),
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
      queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "workforce", "queue"] }),
      queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "workforce", "leaves"] }),
    ]);
  }

  function fail(error: unknown) {
    toast.error(t(workforceErrorKey(error)));
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      toast.success(t("admin.actionDone"));
      setPending(null);
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending(reason: string) {
    if (!pending) return;
    await run(async () => {
      if (pending.kind === "staff") {
        await saveStaff(
          pending.row.user_id,
          {
            work_state: pending.state ?? null,
            capacity_limit: pending.capacity ?? null,
            accepts_auto: pending.auto ?? null,
            department: pending.department ?? null,
          },
          reason,
        );
      } else if (pending.kind === "leaveCancel") {
        await cancelLeave(pending.id, reason);
      } else if (pending.kind === "priority") {
        await setWorkPriority(pending.item.kind, pending.item.subject_id, pending.priority, reason);
      } else {
        await transferSubject(pending.item.kind, pending.item.subject_id, pending.to, reason);
      }
    });
  }

  const statCards: { key: string; value: number | undefined }[] = [
    { key: "unassigned", value: stats.unassigned },
    { key: "open", value: stats.open },
    { key: "urgent", value: stats.urgent },
    { key: "overdue", value: stats.overdue },
    { key: "availableStaff", value: stats.available_staff },
    { key: "onLeave", value: stats.on_leave },
  ];

  return (
    <AdminShell title={t("admin.nav.workforce")} staffAccess>
      <p className="text-xs text-muted-foreground">{t("admin.workforce.hint")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.key} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{t(`admin.workforce.stat.${card.key}`)}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{card.value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="min-h-10"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const n = await distributeWork();
              toast.message(t("admin.workforce.distributed").replace("{n}", String(n)));
            })
          }
        >
          <Shuffle className="me-1.5 size-4" aria-hidden />
          {t("admin.workforce.distribute")}
        </Button>
      </div>

      {/* ---------------- Staff ---------------- */}
      <h2 className="mt-6 text-sm font-bold text-foreground">{t("admin.workforce.staffTitle")}</h2>
      {staff.isLoading ? (
        <Skeleton className="mt-3 h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {rows.map((row) => (
            <div key={row.user_id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                    <UserCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {row.label}
                  </p>
                  {row.email && <p className="truncate text-xs text-muted-foreground">{row.email}</p>}
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted-foreground">
                    <span>
                      {t("admin.workforce.load")}: {row.open_count}/{row.capacity_limit}
                    </span>
                    <span>
                      {t("admin.workforce.doneToday")}: {row.done_today}
                    </span>
                    {row.last_assigned_at && (
                      <span>
                        {t("admin.workforce.lastAssigned")}: {formatDateTime(row.last_assigned_at)}
                      </span>
                    )}
                  </p>
                  {row.on_leave && row.leave_ends_on && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("admin.workforce.leaveUntil")}: {formatDate(row.leave_ends_on)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {t(`admin.workforce.state.${row.effective_state}`)}
                  </span>
                  <Select
                    value={row.work_state}
                    onValueChange={(value) =>
                      setPending({ kind: "staff", row, state: value as WorkState })
                    }
                  >
                    <SelectTrigger className="h-10 w-[9.5rem]" aria-label={t("admin.workforce.stateLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {t(`admin.workforce.state.${state}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.department ?? ""}
                    onValueChange={(value) => setPending({ kind: "staff", row, department: value })}
                  >
                    <SelectTrigger className="h-10 w-[9.5rem]" aria-label={t("admin.workforce.department")}>
                      <SelectValue placeholder={t("admin.workforce.department")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(departments.data ?? []).map((dep) => (
                        <SelectItem key={dep.code} value={dep.code}>
                          {locale === "ar" ? dep.name_ar : dep.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex min-h-10 items-center gap-1.5 rounded-lg bg-background px-2 text-[11px]">
                    <span className="text-foreground">{t("admin.workforce.acceptsAuto")}</span>
                    <Switch
                      checked={row.accepts_auto}
                      onCheckedChange={(next) => setPending({ kind: "staff", row, auto: next })}
                      aria-label={t("admin.workforce.acceptsAuto")}
                    />
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    defaultValue={row.capacity_limit}
                    className="h-10 w-20 tabular-nums"
                    aria-label={t("admin.workforce.capacity")}
                    onBlur={(event) => {
                      const next = Number(event.currentTarget.value);
                      if (!Number.isFinite(next) || next === row.capacity_limit) return;
                      setPending({ kind: "staff", row, capacity: Math.max(1, Math.min(200, next)) });
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => setLeaveFor(row)}
                  >
                    <CalendarOff className="me-1.5 size-4" aria-hidden />
                    {t("admin.workforce.addLeave")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Leaves ---------------- */}
      <h2 className="mt-6 text-sm font-bold text-foreground">{t("admin.workforce.leavesTitle")}</h2>
      {(leaves.data ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("admin.workforce.noLeaves")}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {(leaves.data ?? []).map((leave) => {
            const person = rows.find((row) => row.user_id === leave.user_id);
            return (
              <div
                key={leave.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {person?.label ?? leave.user_id}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {t(`admin.workforce.leaveKind.${leave.kind}`)} · {formatDate(leave.starts_on)} —{" "}
                    {formatDate(leave.ends_on)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-10"
                  onClick={() => setPending({ kind: "leaveCancel", id: leave.id })}
                >
                  {t("admin.workforce.cancelLeave")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- Shared queue ---------------- */}
      <h2 className="mt-6 text-sm font-bold text-foreground">{t("admin.workforce.queueTitle")}</h2>
      <Tabs value={scope} onValueChange={(value) => setScope(value as QueueScope)} className="mt-3">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">{t("admin.workforce.scope.all")}</TabsTrigger>
          <TabsTrigger value="unassigned">{t("admin.workforce.scope.unassigned")}</TabsTrigger>
          <TabsTrigger value="mine">{t("admin.workforce.scope.mine")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {queue.isLoading ? (
        <Skeleton className="mt-3 h-40 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("admin.workforce.emptyQueue")}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={workItemHref(item)}
                    className="truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    {t(`admin.workforce.kind.${item.kind}`)}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted-foreground">
                    <span>
                      {t("admin.workforce.assignee")}:{" "}
                      {item.assignee_label ?? t("admin.workforce.scope.unassigned")}
                    </span>
                    <span>{formatDateTime(item.created_at)}</span>
                    {item.auto_assigned && <span>{t("admin.workforce.autoAssigned")}</span>}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {t(`admin.workforce.priority.${item.priority}`)}
                  </span>
                  <Select
                    value={item.priority}
                    onValueChange={(value) =>
                      setPending({ kind: "priority", item, priority: value as WorkPriority })
                    }
                  >
                    <SelectTrigger className="h-10 w-32" aria-label={t("admin.workforce.priorityLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {t(`admin.workforce.priority.${priority}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={item.progress}
                    onValueChange={(value) =>
                      void run(() => setWorkProgress(item.kind, item.subject_id, value as WorkProgress))
                    }
                  >
                    <SelectTrigger className="h-10 w-36" aria-label={t("admin.workforce.progressLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_PROGRESS.map((progress) => (
                        <SelectItem key={progress} value={progress}>
                          {t(`admin.workforce.progress.${progress}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!item.assignee && (
                    <Button
                      size="sm"
                      className="min-h-10"
                      disabled={busy}
                      onClick={() => void run(() => claimSubject(item.kind, item.subject_id))}
                    >
                      {t("admin.queue.claim")}
                    </Button>
                  )}
                  <Select
                    value=""
                    onValueChange={(value) => setPending({ kind: "transfer", item, to: value })}
                  >
                    <SelectTrigger className="h-10 w-36" aria-label={t("admin.queue.transfer")}>
                      <SelectValue placeholder={t("admin.queue.transfer")} />
                    </SelectTrigger>
                    <SelectContent>
                      {rows
                        .filter((row) => row.user_id !== item.assignee)
                        .map((row) => (
                          <SelectItem key={row.user_id} value={row.user_id}>
                            {row.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LeaveDialog
        row={leaveFor}
        pending={busy}
        onCancel={() => setLeaveFor(null)}
        onSubmit={(values) =>
          void run(async () => {
            await addLeave({ userId: leaveFor!.user_id, ...values });
            setLeaveFor(null);
          })
        }
      />

      <ReasonDialog
        open={!!pending}
        title={t("admin.workforce.confirmTitle")}
        confirmLabel={t("common.confirm")}
        pending={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirmPending(reason)}
      />
    </AdminShell>
  );
}

function LeaveDialog({
  row,
  pending,
  onCancel,
  onSubmit,
}: {
  row: StaffRow | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: { kind: LeaveKind; startsOn: string; endsOn: string; note?: string }) => void;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<LeaveKind>("annual");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");

  const valid = startsOn !== "" && endsOn !== "" && endsOn >= startsOn;

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("admin.workforce.addLeave")} — {row?.label}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("admin.workforce.leaveKindLabel")}</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as LeaveKind)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_KINDS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`admin.workforce.leaveKind.${item}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="leave-start">{t("admin.workforce.from")}</Label>
              <Input
                id="leave-start"
                type="date"
                className="h-11 tabular-nums"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="leave-end">{t("admin.workforce.to")}</Label>
              <Input
                id="leave-end"
                type="date"
                className="h-11 tabular-nums"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="leave-note">{t("admin.workforce.noteLabel")}</Label>
            <Input
              id="leave-note"
              className="h-11"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            className="min-h-11"
            disabled={!valid || pending}
            onClick={() => onSubmit({ kind, startsOn, endsOn, ...(note ? { note } : {}) })}
          >
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Self-service states a staff member may set on themselves. */
export const selfStates = SELF_WORK_STATES;
