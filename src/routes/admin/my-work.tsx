import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { formatDateTime } from "@/lib/format";
import { claimSubject, releaseSubject } from "@/lib/mkt-admin-queue";
import {
  SELF_WORK_STATES,
  WORK_PROGRESS,
  loadMyWorkStatus,
  loadWorkQueue,
  setMyWorkState,
  setWorkProgress,
  workItemHref,
  workforceErrorKey,
  type WorkItem,
  type WorkProgress,
  type WorkState,
} from "@/lib/mkt-workforce";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/my-work")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "أعمالي — إدارة المنصة" },
      {
        name: "description",
        content:
          "حالة عملي الحالية، الأعمال المُسندة إليّ، والقائمة المشتركة التي يمكنني الاستلام منها في منصة تحقّق.",
      },
      { property: "og:title", content: "أعمالي — إدارة المنصة" },
      { property: "og:description", content: "متابعة الأعمال المُسندة إليّ وحالة عملي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyWorkPage,
});

const STATUS_KEY = ["mkt", "admin", "myWork", "status"];

function MyWorkPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState<WorkItem | null>(null);

  const status = useQuery({ queryKey: STATUS_KEY, queryFn: loadMyWorkStatus });
  const mine = useQuery({
    queryKey: ["mkt", "admin", "myWork", "mine"],
    queryFn: () => loadWorkQueue("mine"),
  });
  const shared = useQuery({
    queryKey: ["mkt", "admin", "myWork", "unassigned"],
    queryFn: () => loadWorkQueue("unassigned"),
  });

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      toast.success(t("admin.actionDone"));
      setReleasing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "myWork"] }),
      ]);
    } catch (error) {
      toast.error(t(workforceErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  const me = status.data;
  const onLeave = me?.on_leave === true;

  return (
    <AdminShell title={t("admin.myWork.title")} staffAccess>
      <p className="text-xs text-muted-foreground">{t("admin.myWork.hint")}</p>

      {status.isLoading ? (
        <Skeleton className="mt-4 h-24 w-full rounded-xl" />
      ) : !me ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("admin.myWork.notStaff")}</p>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{t("admin.myWork.myState")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {t(`admin.workforce.state.${me.effective_state}`)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
              <span>
                {t("admin.myWork.load")}: {me.open_count}/{me.capacity_limit}
              </span>
              <span>
                {t("admin.myWork.doneToday")}: {me.done_today}
              </span>
            </div>
            <Select
              value={SELF_WORK_STATES.includes(me.work_state) ? me.work_state : ""}
              disabled={busy || onLeave}
              onValueChange={(value) => void run(() => setMyWorkState(value as WorkState))}
            >
              <SelectTrigger className="h-10 w-40" aria-label={t("admin.myWork.myState")}>
                <SelectValue placeholder={t("admin.workforce.stateLabel")} />
              </SelectTrigger>
              <SelectContent>
                {SELF_WORK_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {t(`admin.workforce.state.${state}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {onLeave && (
            <p className="mt-2 text-[11px] text-muted-foreground">{t("admin.myWork.onLeaveNote")}</p>
          )}
        </div>
      )}

      <WorkList
        title={t("admin.myWork.mineTitle")}
        loading={mine.isLoading}
        items={mine.data ?? []}
        renderActions={(item) => (
          <>
            <Select
              value={item.progress}
              disabled={busy}
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
            <Button
              size="sm"
              variant="outline"
              className="min-h-10"
              disabled={busy}
              onClick={() => setReleasing(item)}
            >
              {t("admin.queue.release")}
            </Button>
          </>
        )}
      />

      <WorkList
        title={t("admin.myWork.sharedTitle")}
        loading={shared.isLoading}
        items={shared.data ?? []}
        renderActions={(item) => (
          <Button
            size="sm"
            className="min-h-10"
            disabled={busy || onLeave}
            onClick={() => void run(() => claimSubject(item.kind, item.subject_id))}
          >
            {t("admin.queue.claim")}
          </Button>
        )}
      />

      <ReasonDialog
        open={releasing !== null}
        title={t("admin.queue.release")}
        confirmLabel={t("admin.queue.release")}
        pending={busy}
        onCancel={() => setReleasing(null)}
        onConfirm={(reason) => {
          const item = releasing;
          if (!item) return;
          void run(() => releaseSubject(item.kind, item.subject_id, reason));
        }}
      />
    </AdminShell>
  );
}

function WorkList({
  title,
  loading,
  items,
  renderActions,
}: {
  title: string;
  loading: boolean;
  items: WorkItem[];
  renderActions: (item: WorkItem) => React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="mt-6">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {loading ? (
        <Skeleton className="mt-3 h-24 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("admin.myWork.empty")}</p>
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
                    <span>{t(`admin.workforce.priority.${item.priority}`)}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                    {item.auto_assigned && <span>{t("admin.workforce.autoAssigned")}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">{renderActions(item)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
