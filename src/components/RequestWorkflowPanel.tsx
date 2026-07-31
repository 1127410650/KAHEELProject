import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Check, Lock, Play, RotateCcw, UserCog, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import type { Permission } from "@/lib/permissions";
import { isClosed, nextStatuses } from "@/lib/requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export interface WorkflowRequest {
  id: string;
  kind: string;
  status: string;
  amount: number | null;
  approved_at: string | null;
  executed_at: string | null;
  assigned_to: string | null;
}

/** Execution permission required per request kind. */
const EXECUTE_PERM: Record<string, Permission> = {
  custody_topup: "custody.execute_topup",
  payment: "payment.execute",
  project_create: "project.approve_create",
  document_upload: "documents.approve",
};

export function RequestWorkflowPanel({
  request,
  onDone,
}: {
  request: WorkflowRequest;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { can } = useSession();
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [followUp, setFollowUp] = useState("");


  const executePerm = EXECUTE_PERM[request.kind];
  const canApprove = can("requests.approve");
  const canReject = can("requests.reject");
  const canExecute =
    request.approved_at !== null &&
    request.executed_at === null &&
    (!executePerm || can(executePerm));
  const canAssign = can("requests.assign");
  const canRemind = can("reminders.send");

  const { data: staff = [] } = useQuery({
    queryKey: ["workflow", "staff"],
    enabled: canAssign,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  function fail(error: Error) {
    const message = error.message ?? "";
    if (message.includes("ALREADY_EXECUTED")) toast.error(t("workflow.alreadyExecuted"));
    else if (message.includes("THROTTLED")) toast.error(t("workflow.reminderThrottled"));
    else if (message.includes("FORBIDDEN")) toast.error(t("common.notAllowed"));
    else toast.error(t("workflow.failed"));
  }

  const decide = useMutation({
    mutationFn: async (decision: "approve" | "reject") => {
      const { error } = await supabase.rpc("request_decide", {
        _request_id: request.id,
        _decision: decision,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
      return decision;
    },
    onSuccess: (decision) => {
      toast.success(decision === "approve" ? t("workflow.approved") : t("workflow.rejected"));
      setNote("");
      onDone();
    },
    onError: fail,
  });

  const execute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_execute", {
        _request_id: request.id,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.executed"));
      setNote("");
      onDone();
    },
    onError: fail,
  });

  const reassign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_reassign", {
        _request_id: request.id,
        _assignee: assignee,
        _reason: note || "—",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.assigned"));
      onDone();
    },
    onError: fail,
  });

  const remind = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("send_request_reminder", {
        _request_id: request.id,
        ...(note ? { _message: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.reminderSent"));
      onDone();
    },
    onError: fail,
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.rpc("request_set_status", {
        _request_id: request.id,
        _status: status,
        ...(note.trim() ? { _note: note.trim() } : {}),
        ...(assignee ? { _assignee: assignee } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.stageChanged"));
      setNote("");
      onDone();
    },
    onError: fail,
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_close", {
        _request_id: request.id,
        ...(note.trim() ? { _note: note.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.closed"));
      setNote("");
      onDone();
    },
    onError: fail,
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error("REASON_REQUIRED");
      const { error } = await supabase.rpc("request_cancel", {
        _request_id: request.id,
        _reason: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.cancelled"));
      setNote("");
      onDone();
    },
    onError: (error: Error) =>
      error.message?.includes("REASON_REQUIRED")
        ? toast.error(t("workflow.reasonRequired"))
        : fail(error),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error("REASON_REQUIRED");
      const { error } = await supabase.rpc("request_reopen", {
        _request_id: request.id,
        _reason: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("workflow.reopened"));
      setNote("");
      onDone();
    },
    onError: (error: Error) =>
      error.message?.includes("REASON_REQUIRED")
        ? toast.error(t("workflow.reasonRequired"))
        : fail(error),
  });

  if (!canApprove && !canReject && !canExecute && !canAssign && !canRemind) return null;

  const pending = request.status !== "approved" && request.status !== "rejected";
  const closed = isClosed(request.status);
  const transitions = nextStatuses(request.status);

  return (
    <div className="surface mb-4 space-y-3 p-4">
      <div className="space-y-2">
        <Label htmlFor="wf-note">{t("workflow.decisionNote")}</Label>
        <Textarea
          id="wf-note"

          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {canAssign && (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="w-full max-w-64 space-y-2">
            <Label>{t("workflow.moveStage")}</Label>
            <Select
              value=""
              onValueChange={(v) => {
                if (!setStatus.isPending) setStatus.mutate(v);
              }}
              disabled={transitions.length === 0}
            >
              <SelectTrigger aria-label={t("workflow.moveStage")}>
                <SelectValue placeholder={t("common.select")} />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="wf-followup">{t("workflow.followUpDate")}</Label>
            <Input
              id="wf-followup"
              type="date"
              dir="ltr"
              className="num"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </div>
          {!closed && request.status === "executed" && (
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={close.isPending}
              onClick={() => close.mutate()}
            >
              <Lock className="size-4" aria-hidden />
              {t("workflow.close")}
            </Button>
          )}
          {!closed && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              <X className="size-4" aria-hidden />
              {t("workflow.cancel")}
            </Button>
          )}
          {closed && can("requests.reopen") && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("workflow.reopen")}
            </Button>
          )}
        </div>
      )}



      <div className="flex flex-wrap items-end gap-2">
        {canApprove && pending && (
          <Button
            className="gap-2"
            disabled={decide.isPending}
            onClick={() => decide.mutate("approve")}
          >
            <Check className="size-4" aria-hidden />
            {t("workflow.approve")}
          </Button>
        )}
        {canReject && pending && (
          <Button
            variant="destructive"
            className="gap-2"
            disabled={decide.isPending}
            onClick={() => {
              if (!note.trim()) {
                toast.error(t("workflow.reasonRequired"));
                return;
              }
              decide.mutate("reject");
            }}
          >
            <X className="size-4" aria-hidden />
            {t("workflow.reject")}
          </Button>
        )}
        {canExecute && (
          <Button
            variant="secondary"
            className="gap-2"
            disabled={execute.isPending}
            onClick={() => execute.mutate()}
          >
            <Play className="size-4" aria-hidden />
            {request.kind === "custody_topup"
              ? t("workflow.executeCustody")
              : request.kind === "project_create"
                ? t("workflow.executeProject")
                : t("workflow.execute")}
          </Button>
        )}
        {canRemind && (
          <Button
            variant="outline"
            className="gap-2"
            disabled={remind.isPending}
            onClick={() => remind.mutate()}
          >
            <BellRing className="size-4" aria-hidden />
            {t("workflow.remind")}
          </Button>
        )}
        {canAssign && (
          <div className="flex items-end gap-2">
            <div className="w-52 space-y-2">
              <Label>{t("workflow.assignTo")}</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!assignee || reassign.isPending}
              onClick={() => reassign.mutate()}
            >
              <UserCog className="size-4" aria-hidden />
              {t("workflow.reassign") || t("workflow.assignTo")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
