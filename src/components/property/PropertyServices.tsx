import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { InfoTable } from "@/components/InfoTable";
import { PropertySection } from "@/components/property/PropertySection";
import { PropertyFormDialog, type FieldDef } from "@/components/property/PropertyFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import {
  SERVICE_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  labelOf,
  pdb,
  pick,
  type PropertyRow,
} from "@/lib/property";

const SERVICE_FIELDS: FieldDef[] = [
  { name: "service_type", label: ["نوع الخدمة", "Service type"], type: "select", required: true, options: SERVICE_TYPE_LABELS },
  { name: "service_status", label: ["الحالة", "Status"], type: "select", required: true, options: SERVICE_STATUS_LABELS },
  { name: "account_no", label: ["رقم الحساب", "Account no."] },
  { name: "meter_no", label: ["رقم العداد", "Meter no."] },
  { name: "subscription_no", label: ["رقم الاشتراك", "Subscription no."] },
  { name: "request_no", label: ["رقم الطلب لدى الجهة", "External request no."] },
  { name: "payment_no", label: ["رقم السداد", "Payment no."] },
  { name: "capacity", label: ["السعة / القدرة", "Capacity"] },
  { name: "installed_at", label: ["تاريخ التركيب", "Installed on"], type: "date" },
  { name: "activated_at", label: ["تاريخ التفعيل", "Activated on"], type: "date" },
  { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
];

/** Services & meters plus the review queue for results coming from executed requests. */
export function PropertyServices({
  projectId,
  canEdit,
  canApprove,
  isAccountant,
}: {
  projectId: string;
  canEdit: boolean;
  canApprove: boolean;
  isAccountant: boolean;
}) {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["property-service-requests", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_no, title, status")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["property-service-results", projectId],
    queryFn: async () => {
      const { data, error } = await pdb
        .from("property_service_results")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["property-service-results", projectId] });
    await qc.invalidateQueries({ queryKey: ["property", "property_services", projectId] });
    await qc.invalidateQueries({ queryKey: ["property-summary", projectId] });
  };

  const addResult = useMutation({
    mutationFn: async (values: Record<string, string | number | null>) => {
      if (!requestId) throw new Error(locale === "ar" ? "اختر الطلب المصدر" : "Pick the source request");
      const { error } = await pdb.from("property_service_results").insert({
        ...values,
        project_id: projectId,
        source_request_id: requestId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setOpen(false);
      setRequestId("");
      await invalidate();
      toast.success(locale === "ar" ? "أُضيفت النتيجة للمراجعة" : "Result queued for review");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; approve: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("property_service_result_decide", {
        _id: input.id,
        _approve: input.approve,
        ...(input.reason ? { _reason: input.reason } : {}),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("property_service_result_apply", { _id: id });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(locale === "ar" ? "تم ربط النتيجة بالمشروع" : "Result linked to the project");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <PropertySection
        table="property_services"
        projectId={projectId}
        title={["الخدمات والعدادات", "Services & meters"]}
        hint={[
          "رقم العداد أو الحساب لا يمكن تكراره داخل نفس نوع الخدمة.",
          "Meter and account numbers cannot repeat inside the same service type.",
        ]}
        fields={SERVICE_FIELDS}
        canEdit={canEdit}
        canDelete={isAccountant}
        primary={(r) => labelOf(locale, SERVICE_TYPE_LABELS, r["service_type"] as string)}
        secondary={(r) =>
          `${labelOf(locale, SERVICE_STATUS_LABELS, r["service_status"] as string)} · ${
            (r["meter_no"] as string) ?? "—"
          }`
        }
        details={(r) => [
          { label: locale === "ar" ? "الحالة" : "Status", value: labelOf(locale, SERVICE_STATUS_LABELS, r["service_status"] as string) },
          { label: locale === "ar" ? "رقم الحساب" : "Account no.", value: (r["account_no"] as string) ?? "—" },
          { label: locale === "ar" ? "رقم العداد" : "Meter no.", value: (r["meter_no"] as string) ?? "—" },
          { label: locale === "ar" ? "رقم الاشتراك" : "Subscription", value: (r["subscription_no"] as string) ?? "—" },
          { label: locale === "ar" ? "رقم السداد" : "Payment no.", value: (r["payment_no"] as string) ?? "—" },
          { label: locale === "ar" ? "تاريخ التركيب" : "Installed", value: formatDate(r["installed_at"] as string) },
          { label: locale === "ar" ? "تاريخ التفعيل" : "Activated", value: formatDate(r["activated_at"] as string) },
          { label: locale === "ar" ? "ملاحظات" : "Notes", value: (r["notes"] as string) ?? "—", hideIfEmpty: true },
        ]}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">
              {locale === "ar" ? "نتائج تنفيذ الطلبات" : "Request execution results"}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {locale === "ar"
                ? "لا تُربط النتيجة بملف المشروع إلا بعد الاعتماد، ولا تُربط مرتين."
                : "A result is linked to the project only after approval, and never twice."}
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 px-2 text-xs"
              onClick={() => setOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden />
              {locale === "ar" ? "إدخال نتيجة" : "Add result"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "لا توجد نتائج." : "No results yet."}
            </p>
          ) : (
            results.map((r) => {
              const status = r["status"] as string;
              const req = requests.find((x) => x.id === r["source_request_id"]);
              return (
                <div key={String(r["id"])} className="rounded-md border border-border p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {labelOf(locale, SERVICE_TYPE_LABELS, r["service_type"] as string)}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                      {status === "pending"
                        ? locale === "ar"
                          ? "بانتظار المراجعة"
                          : "Pending review"
                        : status === "approved"
                          ? locale === "ar"
                            ? "معتمدة — بانتظار الربط"
                            : "Approved — awaiting link"
                          : status === "applied"
                            ? locale === "ar"
                              ? "مرتبطة بالملف"
                              : "Linked"
                            : locale === "ar"
                              ? "مرفوضة"
                              : "Rejected"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <InfoTable
                      dense
                      rows={[
                        {
                          label: locale === "ar" ? "الطلب المصدر" : "Source request",
                          value: req ? `${req.request_no}` : "—",
                        },
                        { label: locale === "ar" ? "رقم العداد" : "Meter no.", value: (r["meter_no"] as string) ?? "—" },
                        { label: locale === "ar" ? "رقم الحساب" : "Account no.", value: (r["account_no"] as string) ?? "—" },
                        { label: locale === "ar" ? "تاريخ التنفيذ" : "Executed on", value: formatDate(r["executed_at"] as string) },
                        { label: locale === "ar" ? "سبب القرار" : "Decision reason", value: (r["decision_reason"] as string) ?? "—", hideIfEmpty: true },
                      ]}
                    />
                  </div>
                  {canApprove && status === "pending" && (
                    <DecisionRow
                      onApprove={() => decide.mutate({ id: String(r["id"]), approve: true })}
                      onReject={(reason) =>
                        decide.mutate({ id: String(r["id"]), approve: false, reason })
                      }
                    />
                  )}
                  {canApprove && status === "approved" && (
                    <Button
                      size="sm"
                      className="mt-2 h-8 px-2 text-xs"
                      disabled={apply.isPending}
                      onClick={() => apply.mutate(String(r["id"]))}
                    >
                      {locale === "ar" ? "ربط بالملف" : "Link to file"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <PropertyFormDialog
        open={open}
        onOpenChange={setOpen}
        title={locale === "ar" ? "إدخال نتيجة تنفيذ" : "Add execution result"}
        fields={[
          { name: "service_type", label: ["نوع الخدمة", "Service type"], type: "select", required: true, options: SERVICE_TYPE_LABELS },
          { name: "service_status", label: ["الحالة", "Status"], type: "select", required: true, options: SERVICE_STATUS_LABELS },
          { name: "account_no", label: ["رقم الحساب", "Account no."] },
          { name: "meter_no", label: ["رقم العداد", "Meter no."] },
          { name: "subscription_no", label: ["رقم الاشتراك", "Subscription no."] },
          { name: "request_no", label: ["رقم الطلب لدى الجهة", "External request no."] },
          { name: "payment_no", label: ["رقم السداد", "Payment no."] },
          { name: "executed_at", label: ["تاريخ التنفيذ", "Executed on"], type: "date" },
          { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
        ]}
        submitting={addResult.isPending}
        onSubmit={(values) => addResult.mutate(values)}
      />

      {open && (
        <div className="fixed bottom-3 z-[60] w-full px-4 sm:hidden">
          <p className="rounded-md bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
            {locale === "ar" ? "اختر الطلب المصدر من القائمة أدناه." : "Pick the source request below."}
          </p>
        </div>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card p-3 shadow-lg">
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="src-req">
            {locale === "ar" ? "الطلب المصدر" : "Source request"}
          </label>
          <select
            id="src-req"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
          >
            <option value="">—</option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.request_no} — {r.title ?? ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function DecisionRow({
  onApprove,
  onReject,
}: {
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const { locale } = useI18n();
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button size="sm" className="h-8 gap-1 px-2 text-xs" onClick={onApprove}>
        <Check className="size-3.5" aria-hidden />
        {locale === "ar" ? "اعتماد" : "Approve"}
      </Button>
      <Input
        className="h-8 w-40 text-xs"
        placeholder={locale === "ar" ? "سبب الرفض" : "Rejection reason"}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs text-destructive"
        disabled={!reason.trim()}
        onClick={() => onReject(reason.trim())}
      >
        <X className="size-3.5" aria-hidden />
        {pick(locale, ["رفض", "Reject"])}
      </Button>
    </div>
  );
}
