import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, ShieldOff } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import {
  adminErrorMessage,
  notifyUser,
  runSubjectAction,
  type SubjectAction,
} from "@/lib/mkt-platform";
import type { AdminRestrictionRow } from "@/lib/mkt-admin-detail";
import { Chip, EmptyState, Panel } from "@/components/marketplace/AdminDetail";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Enforcement on a subject, with its full history.
 *
 * Two guards are deliberately duplicated here for clarity, and enforced again
 * in the database: an administrator can never act on their own account, and a
 * system owner can never be restricted from the console. Every action demands a
 * reason, which the database rejects when empty, and a restriction is lifted by
 * an explicit "lift" — never by deleting the row.
 */
const ACTION_KEYS: Record<SubjectAction, string> = {
  restrict: "admin.action.restrict",
  suspend: "admin.action.suspend",
  ban: "admin.action.ban",
  revoke_verification: "admin.action.revokeVerification",
  lift: "admin.action.lift",
};

export function AdminEnforcement({
  subjectType,
  subjectId,
  subjectName,
  restrictions,
  canManage,
  isSelf = false,
  isSystemOwnerSubject = false,
  notifiableUserId,
  invalidateKey,
}: {
  subjectType: "user" | "business";
  subjectId: string;
  subjectName: string;
  restrictions: AdminRestrictionRow[];
  canManage: boolean;
  isSelf?: boolean;
  isSystemOwnerSubject?: boolean;
  notifiableUserId?: string | null | undefined;
  invalidateKey: readonly unknown[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<SubjectAction | null>(null);
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");

  const active = restrictions.filter(
    (row) => !row.lifted_at && (!row.expires_at || new Date(row.expires_at) > new Date()),
  );
  const blocked = isSelf || (isSystemOwnerSubject && subjectType === "user");

  const available: SubjectAction[] =
    active.length > 0
      ? subjectType === "user"
        ? ["lift", "ban"]
        : ["lift"]
      : subjectType === "user"
        ? ["restrict", "suspend", "ban"]
        : ["restrict", "revoke_verification"];

  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      await runSubjectAction({
        subjectType,
        subjectId,
        action: pending,
        reason,
        ...(days.trim() && Number(days) > 0 ? { days: Number(days) } : {}),
      });
      toast.success(t("admin.actionDone"));
      setPending(null);
      setDays("");
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function sendNotice() {
    if (!notifiableUserId) return;
    setBusy(true);
    try {
      await notifyUser(notifiableUserId, notifyTitle.trim(), notifyBody.trim());
      toast.success(t("admin.detail.noticeSent"));
      setNotifyOpen(false);
      setNotifyTitle("");
      setNotifyBody("");
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t("admin.detail.enforcement")}>
      {!canManage ? (
        <p className="text-sm text-muted-foreground">{t("admin.detail.enforcementDenied")}</p>
      ) : blocked ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldOff className="size-4 shrink-0" aria-hidden />
          {isSelf ? t("admin.detail.noSelfAction") : t("admin.detail.ownerProtected")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((action) => (
            <Button
              key={action}
              variant={action === "lift" ? "outline" : "destructive"}
              size="sm"
              className="min-h-11"
              onClick={() => setPending(action)}
            >
              {t(ACTION_KEYS[action])}
            </Button>
          ))}
          {notifiableUserId && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setNotifyOpen(true)}
            >
              <BellRing className="size-4" aria-hidden />
              {t("admin.detail.notifyUser")}
            </Button>
          )}
        </div>
      )}

      <h3 className="mt-4 text-desc font-semibold text-muted-foreground">
        {t("admin.detail.restrictionHistory")}
      </h3>
      {restrictions.length === 0 ? (
        <EmptyState label={t("admin.detail.noRestrictions")} />
      ) : (
        <ul className="mt-2 grid gap-2">
          {restrictions.map((row) => {
            const live = !row.lifted_at && (!row.expires_at || new Date(row.expires_at) > new Date());
            return (
              <li key={row.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {t(`admin.restriction.${row.restriction}`)}
                  </span>
                  <Chip tone={live ? "bad" : "neutral"}>
                    {live ? t("admin.detail.restrictionActive") : t("admin.detail.restrictionEnded")}
                  </Chip>
                </div>
                <p className="mt-1 break-words text-desc text-muted-foreground">
                  {row.reason || "—"}
                </p>
                <p className="mt-1 text-desc tabular-nums text-muted-foreground">
                  {formatDateTime(row.starts_at ?? row.created_at)}
                  {row.expires_at ? ` → ${formatDateTime(row.expires_at)}` : ""}
                  {row.created_by_name ? ` · ${row.created_by_name}` : ""}
                </p>
                {row.lifted_at && (
                  <p className="mt-1 text-desc text-muted-foreground">
                    {t("admin.detail.liftedAt")}: {formatDateTime(row.lifted_at)}
                    {row.lifted_reason ? ` — ${row.lifted_reason}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ReasonDialog
        open={!!pending}
        title={pending ? `${t(ACTION_KEYS[pending])} — ${subjectName}` : ""}
        description={t("admin.detail.actionDescription")}
        confirmLabel={t("common.confirm")}
        destructive={pending !== "lift"}
        pending={busy}
        onCancel={() => {
          setPending(null);
          setDays("");
        }}
        onConfirm={(reason) => void confirm(reason)}
      >
        {pending && pending !== "lift" && pending !== "ban" && (
          <Label className="block text-desc font-medium text-foreground">
            {t("admin.detail.durationDays")}
            <Input
              value={days}
              onChange={(event) => setDays(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder={t("admin.detail.durationHint")}
              className="mt-1.5 tabular-nums"
            />
          </Label>
        )}
      </ReasonDialog>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.detail.notifyUser")}</DialogTitle>
          </DialogHeader>
          <Label className="block text-desc font-medium text-foreground">
            {t("admin.detail.noticeTitle")}
            <Input
              value={notifyTitle}
              onChange={(event) => setNotifyTitle(event.target.value)}
              className="mt-1.5"
            />
          </Label>
          <Label className="block text-desc font-medium text-foreground">
            {t("admin.detail.noticeBody")}
            <Textarea
              value={notifyBody}
              onChange={(event) => setNotifyBody(event.target.value)}
              rows={4}
              className="mt-1.5"
            />
          </Label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={busy || notifyTitle.trim().length < 3 || notifyBody.trim().length < 3}
              onClick={() => void sendNotice()}
            >
              {t("admin.detail.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
