import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Wallet, Send, Check, Undo2, Ban } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, formatMoney, pickName, todayInRiyadh } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type RecordStatus = Database["public"]["Enums"]["record_status"];

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير — تحقّق | Invoices — Tahqaq" },
      {
        name: "description",
        content:
          "تسجيل فواتير الموردين وربطها بالمشاريع والمشرفين مع دورة مراجعة واعتماد وتسوية من العهدة.",
      },
      { property: "og:title", content: "الفواتير — تحقّق" },
      {
        property: "og:description",
        content: "Supplier invoices with review workflow and custody settlement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});

interface InvoiceForm {
  id?: string;
  supplier_id: string;
  invoice_no: string;
  invoice_date: string;
  project_id: string;
  supervisor_id: string;
  amount_before_tax: string;
  tax_amount: string;
  description: string;
}

const emptyForm: InvoiceForm = {
  supplier_id: "",
  invoice_no: "",
  invoice_date: todayInRiyadh(),
  project_id: "",
  supervisor_id: "",
  amount_before_tax: "",
  tax_amount: "",
  description: "",
};

const statusFilters: (RecordStatus | "all")[] = [
  "all",
  "draft",
  "under_review",
  "returned",
  "approved",
  "cancelled",
];

function InvoicesPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [duplicateReason, setDuplicateReason] = useState("");
  const [showDuplicateOverride, setShowDuplicateOverride] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [statusTarget, setStatusTarget] = useState<{
    id: string;
    from: RecordStatus;
    to: RecordStatus;
  } | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [settleTarget, setSettleTarget] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(todayInRiyadh());
  const [settleNote, setSettleNote] = useState("");
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name_ar, name_en, tax_number, is_active")
        .is("deleted_at", null)
        .order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en, supervisor_id")
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ["supervisors", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("id, name_ar, name_en")
        .is("deleted_at", null)
        .order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      let request = supabase
        .from("invoices")
        .select(
          "*, suppliers(name_ar, name_en, tax_number), projects(code, name_ar, name_en), supervisors(name_ar, name_en)",
        )
        .is("deleted_at", null)
        .order("internal_no", { ascending: false });
      if (statusFilter !== "all") request = request.eq("status", statusFilter);
      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ["invoice-settlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_txn_effects")
        .select("invoice_id, reversal_of_invoice_id, signed_amount, status")
        .eq("status", "approved")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const settledByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of settlements) {
      const key = row.invoice_id ?? row.reversal_of_invoice_id;
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + -Number(row.signed_amount ?? 0));
    }
    return map;
  }, [settlements]);

  const { data: history = [] } = useQuery({
    queryKey: ["invoice-history", historyOf],
    enabled: !!historyOf,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_status_history")
        .select("*")
        .eq("invoice_id", historyOf!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  function invoiceError(error: (Error & { code?: string; message?: string }) | null): string {
    const msg = error?.message ?? "";
    if (error?.code === "23505" || msg.includes("invoices_duplicate_guard"))
      return t("invoices.duplicateBlocked");
    if (msg.includes("settlement_exceeds_invoice_total")) return t("invoices.settleExceeds");
    if (msg.includes("settlement_requires_approved_invoice")) return t("invoices.settleNotApproved");
    if (msg.includes("settlement_requires_accountant") || msg.includes("employee_cannot"))
      return t("common.notAllowed");
    if (msg.includes("approved_invoice_is_locked")) return t("invoices.approvedLocked");
    if (msg.includes("duplicate_override_requires_accountant")) return t("common.notAllowed");
    return t("errors.saveFailed");
  }

  const save = useMutation({
    mutationFn: async (values: InvoiceForm) => {
      const before = Number(values.amount_before_tax);
      const tax = Number(values.tax_amount || "0");
      if (!values.supplier_id || !values.project_id) throw new Error("required");
      if (!Number.isFinite(before) || before <= 0) throw new Error("amount");
      if (!Number.isFinite(tax) || tax < 0) throw new Error("amount");

      const payload = {
        supplier_id: values.supplier_id,
        invoice_no: values.invoice_no.trim(),
        invoice_date: values.invoice_date,
        project_id: values.project_id,
        supervisor_id: values.supervisor_id || null,
        amount_before_tax: before,
        tax_amount: tax,
        total_amount: Number((before + tax).toFixed(2)),
        description: values.description.trim() || null,
        ...(showDuplicateOverride && duplicateReason.trim()
          ? { duplicate_reason: duplicateReason.trim() }
          : {}),
      };

      if (values.id) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", values.id);
        if (error) throw error;
        await logAudit({
          actorId: session?.user.id,
          entityType: "invoice",
          entityId: values.id,
          action: "update",
          newValue: payload,
        });
        return "updated" as const;
      }
      const { data, error } = await supabase
        .from("invoices")
        .insert({ ...payload, created_by: session?.user.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("invoice_status_history").insert({
        invoice_id: data.id,
        to_status: "draft" as RecordStatus,
        actor_id: session?.user.id ?? null,
        note: t("invoices.created"),
      });
      await logAudit({
        actorId: session?.user.id,
        entityType: "invoice",
        entityId: data.id,
        action: "create",
        newValue: payload,
      });
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(t(result === "created" ? "invoices.created" : "invoices.updated"));
      setOpen(false);
      setForm(emptyForm);
      setDuplicateReason("");
      setShowDuplicateOverride(false);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error & { code?: string }) => {
      if (error.message === "amount") toast.error(t("errors.invalidAmount"));
      else if (error.message === "required") toast.error(t("common.required"));
      else {
        const message = invoiceError(error);
        if (message === t("invoices.duplicateBlocked") && isAccountant)
          setShowDuplicateOverride(true);
        toast.error(message);
      }
    },
  });

  const changeStatus = useMutation({
    mutationFn: async () => {
      if (!statusTarget) return;
      if ((statusTarget.to === "returned" || statusTarget.to === "cancelled") && !statusNote.trim())
        throw new Error("note");
      const { error } = await supabase
        .from("invoices")
        .update({ status: statusTarget.to })
        .eq("id", statusTarget.id);
      if (error) throw error;
      const { error: historyError } = await supabase.from("invoice_status_history").insert({
        invoice_id: statusTarget.id,
        from_status: statusTarget.from,
        to_status: statusTarget.to,
        note: statusNote.trim() || null,
        actor_id: session?.user.id ?? null,
      });
      if (historyError) throw historyError;
      await logAudit({
        actorId: session?.user.id,
        entityType: "invoice",
        entityId: statusTarget.id,
        action:
          statusTarget.to === "approved"
            ? "approve"
            : statusTarget.to === "cancelled"
              ? "cancel"
              : "update",
        oldValue: { status: statusTarget.from },
        newValue: { status: statusTarget.to },
        reason: statusNote.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success(t("invoices.statusUpdated"));
      setStatusTarget(null);
      setStatusNote("");
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-history"] });
    },
    onError: (error: Error) =>
      toast.error(error.message === "note" ? t("invoices.noteRequired") : invoiceError(error)),
  });

  const settle = useMutation({
    mutationFn: async () => {
      const invoice = rows.find((r) => r.id === settleTarget);
      if (!invoice) throw new Error("missing");
      if (!invoice.supervisor_id) throw new Error("supervisor");
      const amount = Number(settleAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount");

      const payload = {
        supervisor_id: invoice.supervisor_id,
        project_id: invoice.project_id,
        invoice_id: invoice.id,
        txn_type: "settlement" as Database["public"]["Enums"]["custody_txn_type"],
        amount,
        txn_date: settleDate,
        reason: settleNote.trim() || `${t("invoices.settleFromCustody")} #${invoice.invoice_no}`,
        status: "approved" as RecordStatus,
        approved_at: new Date().toISOString(),
        approved_by: session?.user.id ?? null,
        created_by: session?.user.id ?? null,
        client_token: `settle:${invoice.id}:${amount}:${settleDate}`,
      };
      const { data, error } = await supabase
        .from("custody_transactions")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "custody_transaction",
        entityId: data.id,
        action: "create",
        newValue: payload,
      });
    },
    onSuccess: () => {
      toast.success(t("invoices.settled"));
      setSettleTarget(null);
      setSettleAmount("");
      setSettleNote("");
      void queryClient.invalidateQueries({ queryKey: ["invoice-settlements"] });
      void queryClient.invalidateQueries({ queryKey: ["custody"] });
      void queryClient.invalidateQueries({ queryKey: ["custody-balances"] });
      void queryClient.invalidateQueries({ queryKey: ["custody-effects"] });
    },
    onError: (error: Error) => {
      if (error.message === "amount") toast.error(t("errors.invalidAmount"));
      else if (error.message === "supervisor") toast.error(t("invoices.settleNeedsSupervisor"));
      else toast.error(invoiceError(error));
    },
  });

  const softDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (!deleteReason.trim()) throw new Error("reason");
      const { error } = await supabase
        .from("invoices")
        .update({ deleted_at: new Date().toISOString(), delete_reason: deleteReason.trim() })
        .eq("id", deleteTarget.id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "invoice",
        entityId: deleteTarget.id,
        action: "soft_delete",
        reason: deleteReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success(t("common.delete"));
      setDeleteTarget(null);
      setDeleteReason("");
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) =>
      toast.error(error.message === "reason" ? t("trash.reasonRequired") : invoiceError(error)),
  });

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const supplier = row.suppliers as { name_ar?: string; name_en?: string } | null;
    const project = row.projects as { code?: string; name_ar?: string } | null;
    return [row.invoice_no, String(row.internal_no), supplier?.name_ar, supplier?.name_en, project?.code, project?.name_ar]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const totals = filtered.reduce(
    (acc, row) => {
      acc.before += Number(row.amount_before_tax ?? 0);
      acc.tax += Number(row.tax_amount ?? 0);
      acc.total += Number(row.total_amount ?? 0);
      return acc;
    },
    { before: 0, tax: 0, total: 0 },
  );

  const settleInvoice = rows.find((r) => r.id === settleTarget);
  const settleRemaining = settleInvoice
    ? Number(settleInvoice.total_amount ?? 0) - (settledByInvoice.get(settleInvoice.id) ?? 0)
    : 0;

  return (
    <>
      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setForm(emptyForm);
                setShowDuplicateOverride(false);
                setDuplicateReason("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("invoices.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? t("invoices.edit") : t("invoices.add")}</DialogTitle>
              </DialogHeader>
              <form
                id="invoice-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate(form);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("invoices.supplier")} *</Label>
                    <Select
                      value={form.supplier_id}
                      onValueChange={(v) => setForm({ ...form, supplier_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers
                          .filter((s) => s.is_active)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {pickName(locale, s.name_ar, s.name_en)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="i_no">{t("invoices.invoiceNo")} *</Label>
                    <Input
                      id="i_no"
                      required
                      dir="ltr"
                      className="num"
                      value={form.invoice_no}
                      onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="i_date">{t("invoices.invoiceDate")} *</Label>
                    <Input
                      id="i_date"
                      type="date"
                      lang="en-GB"
                      dir="ltr"
                      required
                      className="num"
                      value={form.invoice_date}
                      onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("invoices.project")} *</Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => {
                        const project = projects.find((p) => p.id === v);
                        setForm({
                          ...form,
                          project_id: v,
                          supervisor_id: form.supervisor_id || project?.supervisor_id || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code} — {pickName(locale, p.name_ar, p.name_en)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("invoices.supervisor")}</Label>
                    <Select
                      value={form.supervisor_id}
                      onValueChange={(v) => setForm({ ...form, supervisor_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {supervisors.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {pickName(locale, s.name_ar, s.name_en)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="i_before">{t("invoices.amountBeforeTax")} *</Label>
                    <Input
                      id="i_before"
                      required
                      dir="ltr"
                      inputMode="decimal"
                      className="num"
                      value={form.amount_before_tax}
                      onChange={(e) => setForm({ ...form, amount_before_tax: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="i_tax">{t("invoices.taxAmount")}</Label>
                    <Input
                      id="i_tax"
                      dir="ltr"
                      inputMode="decimal"
                      className="num"
                      value={form.tax_amount}
                      onChange={(e) => setForm({ ...form, tax_amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("invoices.totalAmount")}</Label>
                    <div className="num flex h-9 items-center rounded-md border border-border bg-secondary/50 px-3 text-sm font-semibold">
                      {formatMoney(
                        Number(form.amount_before_tax || 0) + Number(form.tax_amount || 0),
                        locale,
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="i_desc">{t("invoices.descriptionField")}</Label>
                  <Textarea
                    id="i_desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                {showDuplicateOverride && isAccountant && (
                  <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <Label htmlFor="i_dup">{t("invoices.duplicateOverride")} *</Label>
                    <Textarea
                      id="i_dup"
                      value={duplicateReason}
                      onChange={(e) => setDuplicateReason(e.target.value)}
                    />
                  </div>
                )}
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form="invoice-form" disabled={save.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as RecordStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? t("common.all") : t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3 text-start font-semibold">{t("invoices.internalNo")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("invoices.invoiceNo")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("invoices.supplier")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("invoices.project")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("invoices.supervisor")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("invoices.invoiceDate")}</th>
                <th className="px-3 py-3 text-end font-semibold">{t("invoices.totalAmount")}</th>
                <th className="px-3 py-3 text-end font-semibold">{t("invoices.settledAmount")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-3 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {t("invoices.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const supplier = row.suppliers as { name_ar?: string; name_en?: string } | null;
                const project = row.projects as {
                  code?: string;
                  name_ar?: string;
                  name_en?: string;
                } | null;
                const supervisor = row.supervisors as {
                  name_ar?: string;
                  name_en?: string;
                } | null;
                const settled = settledByInvoice.get(row.id) ?? 0;
                const canEdit = isAccountant || row.status === "draft" || row.status === "returned";
                return (
                  <tr key={row.id} className="hover:bg-secondary/40">
                    <td className="num px-3 py-3 font-medium">{row.internal_no}</td>
                    <td className="num px-3 py-3" dir="ltr">
                      {row.invoice_no}
                    </td>
                    <td className="px-3 py-3">
                      {pickName(locale, supplier?.name_ar, supplier?.name_en)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {project?.code ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {pickName(locale, supervisor?.name_ar, supervisor?.name_en)}
                    </td>
                    <td className="num px-3 py-3">{formatDate(row.invoice_date)}</td>
                    <td className="num px-3 py-3 text-end font-semibold">
                      {formatMoney(row.total_amount, locale)}
                    </td>
                    <td className="num px-3 py-3 text-end">
                      {formatMoney(settled, locale)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                      {row.duplicate_reason && (
                        <span className="mt-1 block text-xs text-warning-foreground">
                          {t("invoices.duplicateApproved")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(row.status === "draft" || row.status === "returned") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("invoices.sendToReview")}
                            title={t("invoices.sendToReview")}
                            onClick={() => {
                              setStatusTarget({
                                id: row.id,
                                from: row.status,
                                to: "under_review",
                              });
                              setStatusNote("");
                            }}
                          >
                            <Send className="size-4 text-info" aria-hidden />
                          </Button>
                        )}
                        {isAccountant && row.status === "under_review" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("invoices.approve")}
                              title={t("invoices.approve")}
                              onClick={() => {
                                setStatusTarget({ id: row.id, from: row.status, to: "approved" });
                                setStatusNote("");
                              }}
                            >
                              <Check className="size-4 text-success" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("invoices.returnForFix")}
                              title={t("invoices.returnForFix")}
                              onClick={() => {
                                setStatusTarget({ id: row.id, from: row.status, to: "returned" });
                                setStatusNote("");
                              }}
                            >
                              <Undo2 className="size-4 text-warning-foreground" aria-hidden />
                            </Button>
                          </>
                        )}
                        {isAccountant && row.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("invoices.cancel")}
                            title={t("invoices.cancel")}
                            onClick={() => {
                              setStatusTarget({ id: row.id, from: row.status, to: "cancelled" });
                              setStatusNote("");
                            }}
                          >
                            <Ban className="size-4 text-destructive" aria-hidden />
                          </Button>
                        )}
                        {isAccountant && row.status === "approved" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("invoices.settleFromCustody")}
                            title={t("invoices.settleFromCustody")}
                            onClick={() => {
                              setSettleTarget(row.id);
                              setSettleAmount(
                                String(
                                  Math.max(
                                    Number(row.total_amount ?? 0) - settled,
                                    0,
                                  ).toFixed(2),
                                ),
                              );
                              setSettleDate(todayInRiyadh());
                              setSettleNote("");
                            }}
                          >
                            <Wallet className="size-4 text-primary" aria-hidden />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("common.edit")}
                            onClick={() => {
                              setForm({
                                id: row.id,
                                supplier_id: row.supplier_id,
                                invoice_no: row.invoice_no,
                                invoice_date: row.invoice_date,
                                project_id: row.project_id,
                                supervisor_id: row.supervisor_id ?? "",
                                amount_before_tax: String(row.amount_before_tax ?? ""),
                                tax_amount: String(row.tax_amount ?? ""),
                                description: row.description ?? "",
                              });
                              setShowDuplicateOverride(!!row.duplicate_reason);
                              setDuplicateReason(row.duplicate_reason ?? "");
                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryOf(row.id)}
                        >
                          {t("invoices.history")}
                        </Button>
                        {isAccountant && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("common.delete")}
                            onClick={() =>
                              setDeleteTarget({
                                id: row.id,
                                label: `#${row.internal_no} — ${row.invoice_no}`,
                              })
                            }
                          >
                            <Trash2 className="size-4 text-destructive" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-secondary/60">
                <tr>
                  <td colSpan={6} className="px-3 py-3 font-semibold">
                    {t("common.total")}
                  </td>
                  <td className="num px-3 py-3 text-end font-bold">
                    {formatMoney(totals.total, locale)}
                  </td>
                  <td className="num px-3 py-3 text-end text-muted-foreground">
                    {t("invoices.taxAmount")}: {formatMoney(totals.tax, locale)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <Dialog open={!!statusTarget} onOpenChange={(v) => !v && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusTarget ? t(`status.${statusTarget.to}`) : t("invoices.statusUpdated")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="i_status_note">{t("invoices.statusNote")}</Label>
            <Textarea
              id="i_status_note"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={changeStatus.isPending}
              onClick={() => changeStatus.mutate()}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!settleTarget} onOpenChange={(v) => !v && setSettleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invoices.settleFromCustody")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("invoices.totalAmount")}</span>
                <span className="num font-semibold">
                  {formatMoney(settleInvoice?.total_amount ?? 0, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("invoices.remainingAmount")}</span>
                <span className="num font-semibold text-primary">
                  {formatMoney(settleRemaining, locale)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i_settle_amount">{t("invoices.settleAmount")} *</Label>
              <Input
                id="i_settle_amount"
                dir="ltr"
                inputMode="decimal"
                className="num"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i_settle_date">{t("custody.txnDate")} *</Label>
              <Input
                id="i_settle_date"
                type="date"
                lang="en-GB"
                dir="ltr"
                className="num"
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i_settle_note">{t("invoices.statusNote")}</Label>
              <Textarea
                id="i_settle_note"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettleTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={settle.isPending} onClick={() => settle.mutate()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyOf} onOpenChange={(v) => !v && setHistoryOf(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("invoices.history")}</DialogTitle>
          </DialogHeader>
          <ol className="space-y-3">
            {history.length === 0 && (
              <li className="text-sm text-muted-foreground">{t("common.noData")}</li>
            )}
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={h.to_status} />
                  <span className="num text-xs text-muted-foreground">
                    {formatDate(h.created_at)}
                  </span>
                </div>
                {h.note && <p className="mt-2 text-muted-foreground">{h.note}</p>}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("trash.confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="num text-sm text-muted-foreground">{deleteTarget?.label}</p>
          <div className="space-y-2">
            <Label htmlFor="i_del_reason">{t("trash.deleteReason")} *</Label>
            <Textarea
              id="i_del_reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={softDelete.isPending}
              onClick={() => softDelete.mutate()}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
