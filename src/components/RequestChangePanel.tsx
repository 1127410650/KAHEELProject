import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FilePenLine, History, ShieldCheck, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDateTime } from "@/lib/format";

/** Fields a requester may ask to change; the accountant executes the approved change. */
const EDITABLE_FIELDS = [
  "title",
  "notes_ar",
  "amount",
  "need_date",
  "authority",
  "beneficiary",
  "account_ref",
  "service_type",
  "reference_no",
] as const;

interface ChangeRow {
  id: string;
  request_id: string;
  target_type: string;
  target_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  status: string;
  requested_by: string | null;
  requested_role: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  executed_at: string | null;
  created_at: string;
}

interface VersionRow {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  target_type: string;
}

export function RequestChangePanel({
  requestId,
  currentValues,
  canRequest,
}: {
  requestId: string;
  currentValues: Record<string, string | null>;
  canRequest: boolean;
}) {
  const { t } = useI18n();
  const { isAccountant } = useSession();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"edit" | "delete">("edit");
  const [field, setField] = useState<string>(EDITABLE_FIELDS[0]);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");

  const changesQuery = useQuery({
    queryKey: ["request", requestId, "changes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_change_requests")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChangeRow[];
    },
  });

  const versionsQuery = useQuery({
    queryKey: ["request", requestId, "versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_field_versions")
        .select("id, field_name, old_value, new_value, created_at, target_type")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VersionRow[];
    },
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["request", requestId] });
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
  }

  function fail(error: Error) {
    const message = error.message ?? "";
    if (message.includes("REASON_REQUIRED")) toast.error(t("changes.reasonRequired"));
    else if (message.includes("FORBIDDEN")) toast.error(t("common.notAllowed"));
    else if (message.includes("NOT_APPROVED")) toast.error(t("changes.notApproved"));
    else toast.error(t("changes.failed"));
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("REASON_REQUIRED");
      const { error } = await supabase.rpc("change_request_create", {
        _request_id: requestId,
        _target_type: "request",
        _action: action,
        _reason: reason.trim(),
        ...(action === "edit"
          ? {
              _field_name: field,
              _old_value: currentValues[field] ?? "",
              _new_value: newValue,
            }
          : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("changes.submitted"));
      setOpen(false);
      setReason("");
      setNewValue("");
      invalidate();
    },
    onError: fail,
  });

  const decide = useMutation({
    mutationFn: async (params: { id: string; decision: "approved" | "rejected" }) => {
      const { error } = await supabase.rpc("change_request_decide", {
        _change_id: params.id,
        _decision: params.decision,
        ...(decisionReason.trim() ? { _reason: decisionReason.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("changes.decided"));
      setDecisionReason("");
      invalidate();
    },
    onError: fail,
  });

  const execute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("change_request_execute", { _change_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("changes.executed"));
      invalidate();
    },
    onError: fail,
  });

  const changes = changesQuery.data ?? [];
  const versions = versionsQuery.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          {t("changes.title")}
        </CardTitle>
        {canRequest && (
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <FilePenLine className="size-4" aria-hidden />
            {t("changes.request")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
          {t("changes.policy")}
        </p>

        <ul className="space-y-2">
          {changes.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {t("changes.empty")}
            </li>
          )}
          {changes.map((row) => (
            <li key={row.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {row.action === "delete" ? t("changes.actionDelete") : t("changes.actionEdit")}
                </span>
                {row.field_name && <span>· {t(`requests.${row.field_name}`)}</span>}
                <span>· {t(`changes.status.${row.status}`)}</span>
                <span className="num">· {formatDateTime(row.created_at)}</span>
              </div>
              {row.action === "edit" && (
                <p className="mt-1 text-xs">
                  <span className="text-muted-foreground">{row.old_value || "—"}</span>
                  {" → "}
                  <span className="font-medium">{row.new_value || "—"}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {t("changes.reason")}: {row.reason}
              </p>
              {row.decision_reason && (
                <p className="text-xs text-muted-foreground">
                  {t("changes.decisionReason")}: {row.decision_reason}
                </p>
              )}
              {isAccountant && row.status === "pending" && (
                <div className="mt-3 space-y-2">
                  <Input
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={t("changes.decisionReason")}
                    aria-label={t("changes.decisionReason")}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => decide.mutate({ id: row.id, decision: "approved" })}
                      disabled={decide.isPending}
                    >
                      {t("common.approve")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => decide.mutate({ id: row.id, decision: "rejected" })}
                      disabled={decide.isPending}
                    >
                      {t("changes.reject")}
                    </Button>
                  </div>
                </div>
              )}
              {isAccountant && row.status === "approved" && !row.executed_at && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => execute.mutate(row.id)}
                  disabled={execute.isPending}
                >
                  {row.action === "delete" ? (
                    <Trash2 className="size-4" aria-hidden />
                  ) : (
                    <FilePenLine className="size-4" aria-hidden />
                  )}
                  {t("changes.execute")}
                </Button>
              )}
            </li>
          ))}
        </ul>

        {versions.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-muted-foreground" aria-hidden />
              {t("changes.versions")}
            </h3>
            <ul className="space-y-1 text-xs">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap gap-2 border-b border-border pb-1">
                  <span className="font-medium">{t(`requests.${v.field_name}`)}</span>
                  <span className="text-muted-foreground">{v.old_value || "—"}</span>
                  <span>→</span>
                  <span>{v.new_value || "—"}</span>
                  <span className="num ms-auto text-muted-foreground">
                    {formatDateTime(v.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changes.request")}</DialogTitle>
          </DialogHeader>
          <form
            id="change-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!create.isPending) create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>{t("changes.action")} *</Label>
              <Select value={action} onValueChange={(v) => setAction(v as "edit" | "delete")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">{t("changes.actionEdit")}</SelectItem>
                  <SelectItem value="delete">{t("changes.actionDelete")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {action === "edit" && (
              <>
                <div className="space-y-2">
                  <Label>{t("changes.field")} *</Label>
                  <Select value={field} onValueChange={setField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITABLE_FIELDS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`requests.${f}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ch_old">{t("changes.currentValue")}</Label>
                  <Input id="ch_old" readOnly value={currentValues[field] ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ch_new">{t("changes.newValue")} *</Label>
                  <Input
                    id="ch_new"
                    required
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="ch_reason">{t("changes.reason")} *</Label>
              <Textarea
                id="ch_reason"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              {t("changes.awaitingAccountant")}
            </p>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="change-form" disabled={create.isPending}>
              {t("common.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
