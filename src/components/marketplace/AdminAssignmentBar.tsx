import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { HandMetal, RotateCcw, UserCheck, UserPlus2 } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  claimSubject,
  loadAssignments,
  queueErrorKey,
  releaseSubject,
  transferSubject,
  type QueueKind,
} from "@/lib/mkt-admin-queue";
import { loadAdminRoles } from "@/lib/mkt-platform";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { Button } from "@/components/ui/button";

/**
 * Claim / transfer / release for one queue item.
 *
 * The point is that two administrators can never decide the same item: the
 * database holds one assignment row per (kind, subject) and rejects a second
 * claim, so this bar reflects server state instead of guessing. When somebody
 * else holds the item the actions are disabled and the reason is shown — the
 * page stays readable, it just stops being actionable.
 */
export function AdminAssignmentBar({
  kind,
  subjectId,
  onChanged,
}: {
  kind: QueueKind;
  subjectId: string;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"transfer" | "release" | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const assignment = useQuery({
    queryKey: ["mkt", "admin", "assignment", kind, subjectId],
    queryFn: async () => (await loadAssignments(kind, [subjectId]))[subjectId] ?? null,
    staleTime: 10_000,
  });

  // Candidate officers are only fetched when a transfer is actually started.
  const officers = useQuery({
    queryKey: ["mkt", "admin", "roles"],
    enabled: dialog === "transfer",
    staleTime: 60_000,
    queryFn: loadAdminRoles,
  });

  const row = assignment.data ?? null;
  const mine = row?.is_mine === true || (!!row?.assignee && row.assignee === session?.user.id);
  const held = !!row?.assignee && !mine;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      toast.success(t("admin.actionDone"));
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "assignment", kind, subjectId] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "overview"] });
      onChanged?.();
    } catch (error) {
      toast.error(t(queueErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      <span className="inline-flex min-w-0 items-center gap-[var(--sp-2)] text-desc text-muted-foreground">
        <UserCheck className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          {mine
            ? t("admin.queue.mine")
            : row?.assignee
              ? `${t("admin.queue.assignedTo")}: ${row.assignee_label ?? "—"}`
              : t("admin.queue.unassigned")}
        </span>
      </span>

      <div className="ms-auto flex flex-wrap items-center gap-2">
        {!row?.assignee && (
          <Button
            size="sm"
            className="min-h-11"
            disabled={busy}
            onClick={() => void run(() => claimSubject(kind, subjectId))}
          >
            <HandMetal className="size-4" aria-hidden />
            {t("admin.queue.claim")}
          </Button>
        )}
        {mine && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => setDialog("transfer")}
            >
              <UserPlus2 className="size-4" aria-hidden />
              {t("admin.queue.transfer")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => setDialog("release")}
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("admin.queue.release")}
            </Button>
          </>
        )}
        {held && <span className="text-desc text-admin-urgent">{t("admin.queue.readOnly")}</span>}
      </div>

      <ReasonDialog
        open={dialog === "release"}
        title={t("admin.queue.release")}
        confirmLabel={t("admin.queue.release")}
        pending={busy}
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => void run(() => releaseSubject(kind, subjectId, reason))}
      />
      <ReasonDialog
        open={dialog === "transfer"}
        title={t("admin.queue.transfer")}
        confirmLabel={t("admin.queue.transfer")}
        pending={busy || !target}
        onCancel={() => {
          setDialog(null);
          setTarget("");
        }}
        onConfirm={(reason) => void run(() => transferSubject(kind, subjectId, target, reason))}
      >
        <label className="block text-desc font-medium text-foreground">
          {t("admin.queue.transferTo")}
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="mt-[var(--sp-2)] h-11 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">—</option>
            {(officers.data ?? [])
              .filter((row) => row.user_id !== session?.user.id)
              .map((row) => (
                <option key={row.user_id} value={row.user_id}>
                  {row.display_name || row.email || row.user_id}
                </option>
              ))}
          </select>
        </label>
      </ReasonDialog>
    </div>
  );
}
