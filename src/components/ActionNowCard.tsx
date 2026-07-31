import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveNextAction, type NextAction } from "@/lib/request-ui";

export interface ActionRequest {
  id: string;
  status: string;
  info_state?: string | null;
  reject_reason?: string | null;
  requester_id?: string | null;
  created_by?: string | null;
}

const TONE_STYLES: Record<NextAction["tone"], string> = {
  info: "border-info/30 bg-info/5",
  warning: "border-warning/50 bg-warning/10",
  success: "border-success/30 bg-success/5",
  danger: "border-destructive/30 bg-destructive/5",
};

const TONE_ICON = {
  info: Info,
  warning: CircleAlert,
  success: CheckCircle2,
  danger: XCircle,
};

/**
 * "What should I do now?" card — one sentence and at most one primary button.
 * Every button calls an existing RPC; nothing about the lifecycle changes here.
 */
export function ActionNowCard({
  request,
  onDone,
  onOpenPayment,
  onReply,
}: {
  request: ActionRequest;
  onDone: () => void;
  onOpenPayment?: (status: string) => void;
  onReply?: () => void;
}) {
  const { t } = useI18n();
  const { role, isSupervisor, session, can } = useSession();

  const isRequester =
    request.requester_id === session?.user.id || request.created_by === session?.user.id;

  const action = resolveNextAction(request, {
    role,
    isSupervisorView: isSupervisor,
    isRequester,
    can: (perm) => can(perm as never),
  });

  const run = useMutation({
    mutationFn: async () => {
      if (action.kind === "set_status") {
        const { error } = await supabase.rpc("request_set_status", {
          _request_id: request.id,
          _status: action.target!,
        });
        if (error) throw error;
        return;
      }
      if (action.kind === "approve") {
        const { error } = await supabase.rpc("request_decide", {
          _request_id: request.id,
          _decision: "approve",
        });
        if (error) throw error;
        return;
      }
      if (action.kind === "close") {
        const { error } = await supabase.rpc("request_close", { _request_id: request.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("workflow.stageChanged"));
      onDone();
    },
    onError: (error: Error) => {
      const message = error.message ?? "";
      if (message.includes("FORBIDDEN")) toast.error(t("common.notAllowed"));
      else toast.error(t("workflow.failed"));
    },
  });

  const Icon = TONE_ICON[action.tone];
  const rejectReason = request.status === "rejected" ? request.reject_reason : null;

  function onClick() {
    if (action.kind === "reply_info") {
      onReply?.();
      return;
    }
    if (action.kind === "payment_dialog") {
      onOpenPayment?.(action.target ?? "paid");
      return;
    }
    if (!run.isPending) run.mutate();
  }

  return (
    <section
      className={cn("mb-4 rounded-2xl border p-4 sm:p-5", TONE_STYLES[action.tone])}
      aria-labelledby="action-now-title"
    >
      <div className="flex flex-wrap items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-foreground/70" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="action-now-title" className="text-sm font-bold">
            {t("action.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground/90">{t(action.messageKey)}</p>
          {rejectReason && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("workflow.reasonRequired")}: {rejectReason}
            </p>
          )}
        </div>
        {action.buttonKey && (
          <Button type="button" className="gap-2" disabled={run.isPending} onClick={onClick}>
            {t(action.buttonKey)}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        )}
      </div>
    </section>
  );
}
