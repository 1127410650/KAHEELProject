import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, FileText, History, Paperclip, Receipt } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { RequestWorkflowPanel } from "@/components/RequestWorkflowPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCEPT, isAllowedFile, openAttachment, uploadAttachments } from "@/lib/attachments";
import { formatDate, formatDateTime, formatMoney, pickName } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type RequestStatus = Database["public"]["Enums"]["request_status"];

const statuses: RequestStatus[] = [
  "new",
  "processing",
  "needs_info",
  "awaiting_payment",
  "paid",
  "completed",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/requests/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل الطلب — تحقّق | Request details — Tahqaq" },
      {
        name: "description",
        content: "تفاصيل الطلب: المشروع والمشرف وبيانات السداد والمرفقات وسجل المراحل.",
      },
      { property: "og:title", content: "تفاصيل الطلب — تحقّق" },
      {
        property: "og:description",
        content: "Request details with payment data, documents and stage timeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestDetailPage,
});

interface PaymentDraft {
  payment_no: string;
  payment_amount: string;
  payment_beneficiary: string;
  payment_expiry: string;
  payment_note: string;
  paid_at: string;
  payment_method: string;
  payment_reference: string;
}

const emptyPayment: PaymentDraft = {
  payment_no: "",
  payment_amount: "",
  payment_beneficiary: "",
  payment_expiry: "",
  payment_note: "",
  paid_at: "",
  payment_method: "",
  payment_reference: "",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function RequestDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();

  const [targetStatus, setTargetStatus] = useState<RequestStatus | null>(null);
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment);
  const [files, setFiles] = useState<File[]>([]);
  const [stageFiles, setStageFiles] = useState<File[]>([]);
  const loggedOpen = useRef(false);

  const requestQuery = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(
          "*, projects(id, code, name_ar, name_en), supervisors(id, name_ar, name_en, national_id, phone)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const request = requestQuery.data;

  const { data: history = [] } = useQuery({
    queryKey: ["request-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_status_history")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["request-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("entity_type", "request")
        .eq("entity_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!request || loggedOpen.current) return;
    loggedOpen.current = true;
    void logAudit({
      actorId: session?.user.id,
      entityType: "request",
      entityId: request.id,
      action: "open",
      newValue: { request_no: request.request_no },
    });
  }, [request, session?.user.id]);

  useEffect(() => {
    if (!request) return;
    setPayment({
      payment_no: request.payment_no ?? "",
      payment_amount: request.payment_amount != null ? String(request.payment_amount) : "",
      payment_beneficiary: request.payment_beneficiary ?? "",
      payment_expiry: request.payment_expiry ?? "",
      payment_note: request.payment_note ?? "",
      paid_at: request.paid_at ?? "",
      payment_method: request.payment_method ?? "",
      payment_reference: request.payment_reference ?? "",
    });
  }, [request]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["request", id] });
    void queryClient.invalidateQueries({ queryKey: ["request-history", id] });
    void queryClient.invalidateQueries({ queryKey: ["request-attachments", id] });
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
    void queryClient.invalidateQueries({ queryKey: ["project-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["supervisor-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const changeStatus = useMutation({
    mutationFn: async () => {
      if (!request || !targetStatus) return;
      if (targetStatus === "awaiting_payment" && !payment.payment_no.trim())
        throw new Error("PAYMENT_NO_REQUIRED");
      if (targetStatus === "paid") {
        if (!payment.paid_at) throw new Error("PAID_DATE_REQUIRED");
        const hasReceipt =
          files.length > 0 || attachments.some((a) => a.kind === "payment_receipt");
        if (!hasReceipt) throw new Error("PAYMENT_RECEIPT_REQUIRED");
      }
      if (files.some((f) => !isAllowedFile(f))) throw new Error("FILE_TYPE");
      if (files.length && !request.project_id) throw new Error("NO_PROJECT");

      // Upload first so mandatory receipts already exist when the status flips.
      const projectId = request.project_id;
      const uploadedIds = files.length && projectId
        ? await uploadAttachments(files, {
            projectId,
            entityType: "request",
            entityId: request.id,
            note: note,
            kind: targetStatus === "paid" ? "payment_receipt" : "stage_doc",
            userId: session?.user.id ?? null,
          })
        : [];

      const amount = payment.payment_amount ? Number(payment.payment_amount) : null;
      const payload: Database["public"]["Tables"]["requests"]["Update"] = {
        status: targetStatus,
        status_note: note.trim() || null,
        ...(targetStatus === "awaiting_payment"
          ? {
              payment_no: payment.payment_no.trim(),
              payment_amount: amount,
              payment_beneficiary: payment.payment_beneficiary.trim() || null,
              payment_expiry: payment.payment_expiry || null,
              payment_note: payment.payment_note.trim() || null,
            }
          : {}),
        ...(targetStatus === "paid"
          ? {
              paid_at: payment.paid_at,
              payment_amount: amount,
              payment_method: payment.payment_method.trim() || null,
              payment_reference: payment.payment_reference.trim() || null,
              payment_note: payment.payment_note.trim() || null,
            }
          : {}),
      };

      const { error } = await supabase.from("requests").update(payload).eq("id", request.id);

      if (error) throw error;

      // Link the uploaded documents to the stage that was just created.
      if (uploadedIds.length) {
        const { data: stage } = await supabase
          .from("request_status_history")
          .select("id")
          .eq("request_id", request.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (stage?.id) {
          await supabase.from("attachments").update({ stage_id: stage.id }).in("id", uploadedIds);
        }
        await logAudit({
          actorId: session?.user.id,
          entityType: "request",
          entityId: request.id,
          action: "upload",
          newValue: { count: uploadedIds.length, kind: targetStatus === "paid" ? "payment_receipt" : "stage_doc" },
        });
      }

      await logAudit({
        actorId: session?.user.id,
        entityType: "request",
        entityId: request.id,
        action: "update",
        oldValue: { status: request.status },
        newValue: payload,
      });
    },
    onSuccess: () => {
      toast.success(t("requests.statusUpdated"));
      setTargetStatus(null);
      setNote("");
      setFiles([]);
      invalidate();
    },
    onError: (error: Error) => toast.error(mapError(error, t)),
  });

  const addStageDocs = useMutation({
    mutationFn: async () => {
      if (!request || stageFiles.length === 0) return;
      if (stageFiles.some((f) => !isAllowedFile(f))) throw new Error("FILE_TYPE");
      if (!request.project_id) throw new Error("NO_PROJECT");
      const currentStage = history.length ? history[history.length - 1]?.id : null;
      const ids = await uploadAttachments(stageFiles, {
        projectId: request.project_id!,
        entityType: "request",
        entityId: request.id,
        stageId: currentStage ?? null,
        kind: "stage_doc",
        userId: session?.user.id ?? null,
      });
      await logAudit({
        actorId: session?.user.id,
        entityType: "request",
        entityId: request.id,
        action: "upload",
        newValue: { count: ids.length, kind: "stage_doc" },
      });
    },
    onSuccess: () => {
      toast.success(t("requests.uploaded"));
      setStageFiles([]);
      invalidate();
    },
    onError: (error: Error) => toast.error(mapError(error, t)),
  });

  if (!requestQuery.isPending && !request) {
    return (
      <>
        <PageHeader title={t("requests.details")} description={t("requests.notFound")} />
        <Button asChild variant="outline">
          <Link to="/requests">{t("common.back")}</Link>
        </Button>
      </>
    );
  }

  const project = request?.projects as { code?: string; name_ar?: string; name_en?: string } | null;
  const supervisor = request?.supervisors as
    | { name_ar?: string; name_en?: string; national_id?: string; phone?: string }
    | null;

  const receipts = attachments.filter((a) => a.kind === "payment_receipt");

  return (
    <>
      <PageHeader
        title={`${t("requests.requestNo")} ${request?.request_no ?? ""}`}
        description={request?.request_type ?? t("requests.details")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {request?.payment_no && <PaymentNoBadge paymentNo={request.payment_no} />}
            {request && <StatusBadge status={request.status} />}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/requests">
                <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
                {t("common.back")}
              </Link>
            </Button>
          </div>
        }
      />

      {request && (
        <RequestWorkflowPanel
          request={{
            id: request.id,
            kind: request.kind,
            status: request.status,
            amount: request.amount,
            approved_at: request.approved_at,
            executed_at: request.executed_at,
            assigned_to: request.assigned_to,
          }}
          onDone={invalidate}
        />
      )}

      {isAccountant && request && (
        <div className="surface mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="w-full max-w-56 space-y-2">
            <Label>{t("requests.changeStatusTo")}</Label>
            <Select
              value={request.status}
              onValueChange={(v) => {
                setNote("");
                setFiles([]);
                setTargetStatus(v as RequestStatus);
              }}
            >
              <SelectTrigger aria-label={t("requests.changeStatus")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("common.details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
              <div className="divide-y divide-border">
                <Row
                  label={t("requests.requestNo")}
                  value={<span className="num">{request?.request_no}</span>}
                />
                <Row label={t("requests.requestType")} value={request?.request_type} />
                <Row
                  label={t("requests.project")}
                  value={
                    request ? (
                      <Link
                        to="/projects/$id"
                        params={{ id: request.project_id }}
                        className="text-primary hover:underline"
                      >
                        <span className="num">{project?.code}</span>{" "}
                        {pickName(locale, project?.name_ar, project?.name_en)}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label={t("requests.supervisor")}
                  value={
                    request?.supervisor_id ? (
                      <Link
                        to="/supervisors/$id"
                        params={{ id: request.supervisor_id }}
                        className="text-primary hover:underline"
                      >
                        {pickName(locale, supervisor?.name_ar, supervisor?.name_en)}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label={t("supervisors.nationalId")}
                  value={<span className="num">{supervisor?.national_id ?? "—"}</span>}
                />
                <Row
                  label={t("supervisors.phone")}
                  value={
                    <span className="num" dir="ltr">
                      {supervisor?.phone ?? "—"}
                    </span>
                  }
                />
              </div>
              <div className="divide-y divide-border">
                <Row
                  label={t("requests.requestDate")}
                  value={<span className="num">{formatDate(request?.request_date)}</span>}
                />
                <Row
                  label={t("requests.referenceNo")}
                  value={<span className="num">{request?.reference_no ?? "—"}</span>}
                />
                <Row label={t("requests.authority")} value={request?.authority ?? "—"} />
                <Row label={t("common.notes")} value={request?.notes_ar ?? "—"} />
                <Row label={t("requests.finalResult")} value={request?.final_result ?? "—"} />
                <Row
                  label={t("requests.lastUpdate")}
                  value={<span className="num">{formatDateTime(request?.updated_at)}</span>}
                />
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" aria-hidden />
              {t("requests.paymentInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              <Row
                label={t("requests.paymentNo")}
                value={
                  request?.payment_no ? (
                    <PaymentNoBadge paymentNo={request.payment_no} withLabel={false} />
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label={t("requests.paymentAmount")}
                value={
                  request?.payment_amount != null ? (
                    <span className="num">{formatMoney(request.payment_amount, locale)}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label={t("requests.beneficiary")} value={request?.payment_beneficiary ?? "—"} />
              <Row
                label={t("requests.paymentExpiry")}
                value={<span className="num">{formatDate(request?.payment_expiry)}</span>}
              />
              <Row
                label={t("requests.paidAt")}
                value={<span className="num">{formatDate(request?.paid_at)}</span>}
              />
              <Row label={t("requests.paymentMethod")} value={request?.payment_method ?? "—"} />
              <Row
                label={t("requests.paymentReference")}
                value={<span className="num">{request?.payment_reference ?? "—"}</span>}
              />
              <Row label={t("requests.paymentNote")} value={request?.payment_note ?? "—"} />
            </dl>
            {receipts.length > 0 && (
              <div className="mt-3 space-y-2">
                {receipts.map((r) => (
                  <Button
                    key={r.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => void openAttachment(r.storage_path)}
                  >
                    <Download className="size-4" aria-hidden />
                    {t("requests.viewReceipt")}
                    <span className="num text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" aria-hidden />
              {t("requests.timeline")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
            ) : (
              <ol className="relative space-y-5 border-s border-border ps-5">
                {history.map((h) => {
                  const stageDocs = attachments.filter((a) => a.stage_id === h.id);
                  return (
                    <li key={h.id} className="relative">
                      <span className="absolute -inset-inline-start-[27px] top-1.5 size-2.5 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        {h.from_status && (
                          <>
                            <StatusBadge status={h.from_status} />
                            <span className="text-muted-foreground">→</span>
                          </>
                        )}
                        <StatusBadge status={h.to_status} />
                        <span className="num text-xs text-muted-foreground">
                          {formatDateTime(h.created_at)}
                        </span>
                      </div>
                      {h.note && <p className="mt-1.5 text-sm">{h.note}</p>}
                      {stageDocs.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {stageDocs.map((d) => (
                            <li key={d.id}>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                onClick={() => void openAttachment(d.storage_path)}
                              >
                                <FileText className="size-3.5" aria-hidden />
                                {d.file_name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" aria-hidden />
              {t("requests.attachments")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("requests.noAttachments")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {attachments.map((a) => (
                  <li key={a.id} className="py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-start text-primary hover:underline"
                      onClick={() => void openAttachment(a.storage_path)}
                    >
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="break-all">{a.file_name}</span>
                    </button>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                      {a.kind === "payment_receipt" ? ` · ${t("requests.receipt")}` : ""}
                    </p>
                    {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 border-t border-border pt-3">
              <Label htmlFor="stage-files">{t("requests.addFiles")}</Label>
              <Input
                id="stage-files"
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => setStageFiles(Array.from(e.target.files ?? []))}
              />
              <Button
                type="button"
                className="w-full"
                disabled={stageFiles.length === 0 || addStageDocs.isPending}
                onClick={() => addStageDocs.mutate()}
              >
                {t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!targetStatus}
        onOpenChange={(v) => {
          if (!v) setTargetStatus(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("requests.changeStatusTo")} — {targetStatus ? t(`status.${targetStatus}`) : ""}
            </DialogTitle>
          </DialogHeader>
          <form
            id="status-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!changeStatus.isPending) changeStatus.mutate();
            }}
          >
            {targetStatus === "awaiting_payment" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pay_no">{t("requests.paymentNo")} *</Label>
                  <Input
                    id="pay_no"
                    required
                    dir="ltr"
                    value={payment.payment_no}
                    onChange={(e) => setPayment({ ...payment, payment_no: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_amount">{t("requests.paymentAmount")}</Label>
                  <Input
                    id="pay_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    value={payment.payment_amount}
                    onChange={(e) => setPayment({ ...payment, payment_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_benef">{t("requests.beneficiary")}</Label>
                  <Input
                    id="pay_benef"
                    value={payment.payment_beneficiary}
                    onChange={(e) =>
                      setPayment({ ...payment, payment_beneficiary: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_exp">{t("requests.paymentExpiry")}</Label>
                  <Input
                    id="pay_exp"
                    type="date"
                    lang="en-GB"
                    dir="ltr"
                    value={payment.payment_expiry}
                    onChange={(e) => setPayment({ ...payment, payment_expiry: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pay_note">{t("requests.paymentNote")}</Label>
                  <Textarea
                    id="pay_note"
                    value={payment.payment_note}
                    onChange={(e) => setPayment({ ...payment, payment_note: e.target.value })}
                  />
                </div>
              </div>
            )}

            {targetStatus === "paid" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paid_at">{t("requests.paidAt")} *</Label>
                  <Input
                    id="paid_at"
                    required
                    type="date"
                    lang="en-GB"
                    dir="ltr"
                    value={payment.paid_at}
                    onChange={(e) => setPayment({ ...payment, paid_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid_amount">{t("requests.paymentAmount")}</Label>
                  <Input
                    id="paid_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    value={payment.payment_amount}
                    onChange={(e) => setPayment({ ...payment, payment_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid_method">{t("requests.paymentMethod")}</Label>
                  <Input
                    id="paid_method"
                    value={payment.payment_method}
                    onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid_ref">{t("requests.paymentReference")}</Label>
                  <Input
                    id="paid_ref"
                    dir="ltr"
                    value={payment.payment_reference}
                    onChange={(e) => setPayment({ ...payment, payment_reference: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="stage_note">{t("requests.stageNote")}</Label>
              <Textarea
                id="stage_note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status_files">
                {targetStatus === "paid"
                  ? `${t("requests.receiptUpload")} *`
                  : t("requests.stageDocs")}
              </Label>
              <Input
                id="status_files"
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <p className="text-xs text-muted-foreground">PDF · JPG · JPEG · PNG</p>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTargetStatus(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="status-form" disabled={changeStatus.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function mapError(error: Error, t: (key: string) => string): string {
  const message = error.message ?? "";
  if (message.includes("PAYMENT_NO_REQUIRED")) return t("requests.paymentNoRequired");
  if (message.includes("PAID_DATE_REQUIRED")) return t("requests.paidAtRequired");
  if (message.includes("PAYMENT_RECEIPT_REQUIRED")) return t("requests.receiptRequired");
  if (message.includes("STATUS_CHANGE_FORBIDDEN")) return t("requests.statusChangeForbidden");
  if (message.includes("PAYMENT_LOCKED")) return t("requests.paymentLocked");
  if (message.includes("FILE_TYPE")) return t("requests.fileTypeInvalid");
  return t("errors.saveFailed");
}
