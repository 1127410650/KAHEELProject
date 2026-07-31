import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Check, Printer, Undo2, Ban } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { CustodyVoucher, type VoucherData } from "@/components/CustodyVoucher";
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

type TxnType = Database["public"]["Enums"]["custody_txn_type"];

export const Route = createFileRoute("/_authenticated/custody")({
  head: () => ({
    meta: [
      { title: "عهد المشرفين — تحقّق | Custody — Tahqaq" },
      {
        name: "description",
        content: "سندات إضافة العهدة والتسوية والخصم والاسترداد مع رصيد مستقل لكل مشرف.",
      },
      { property: "og:title", content: "عهد المشرفين — تحقّق" },
      { property: "og:description", content: "Custody vouchers and per-supervisor balances." },
    ],
  }),
  component: CustodyPage,
});

const txnTypes: TxnType[] = ["add", "settlement", "deduction", "refund"];

interface TxnForm {
  supervisor_id: string;
  project_id: string;
  txn_type: TxnType;
  amount: string;
  txn_date: string;
  reason: string;
  notes_ar: string;
}

function CustodyPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();

  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [voucher, setVoucher] = useState<VoucherData | null>(null);
  const [reversalTarget, setReversalTarget] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [form, setForm] = useState<TxnForm>({
    supervisor_id: "",
    project_id: "",
    txn_type: "add",
    amount: "",
    txn_date: todayInRiyadh(),
    reason: "",
    notes_ar: "",
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ["supervisors", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("id, name_ar, name_en")
        .is("deleted_at", null)
        .eq("is_active", true)
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

  const { data: balances = [] } = useQuery({
    queryKey: ["custody-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custody_balances").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["custody", supervisorFilter, statusFilter],
    queryFn: async () => {
      let request = supabase
        .from("custody_transactions")
        .select(
          "*, supervisors(name_ar, name_en, national_id, phone), projects(code, name_ar, name_en)",
        )
        .is("deleted_at", null)
        .order("serial_no", { ascending: false });
      if (supervisorFilter !== "all") request = request.eq("supervisor_id", supervisorFilter);
      if (statusFilter !== "all")
        request = request.eq("status", statusFilter as Database["public"]["Enums"]["record_status"]);
      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
  });

  const filteredProjects = useMemo(
    () =>
      form.supervisor_id
        ? projects.filter((p) => p.supervisor_id === form.supervisor_id)
        : projects,
    [projects, form.supervisor_id],
  );

  const selectedBalance = balances.find((b) => b.supervisor_id === supervisorFilter);

  const create = useMutation({
    mutationFn: async (values: TxnForm) => {
      const amount = Number(values.amount);
      if (!values.supervisor_id) throw new Error("supervisor");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount");
      const payload = {
        supervisor_id: values.supervisor_id,
        project_id: values.project_id || null,
        txn_type: values.txn_type,
        amount,
        txn_date: values.txn_date,
        reason: values.reason.trim() || null,
        notes_ar: values.notes_ar.trim() || null,
        created_by: session?.user.id ?? null,
        client_token: `${values.supervisor_id}:${values.txn_type}:${amount}:${values.txn_date}`,
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
      toast.success(t("custody.created"));
      setOpen(false);
      setForm({
        supervisor_id: "",
        project_id: "",
        txn_type: "add",
        amount: "",
        txn_date: todayInRiyadh(),
        reason: "",
        notes_ar: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["custody"] });
      void queryClient.invalidateQueries({ queryKey: ["custody-balances"] });
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === "23505") toast.error(t("custody.duplicateBlocked"));
      else if (error.message === "amount") toast.error(t("errors.invalidAmount"));
      else if (error.message === "supervisor") toast.error(t("common.required"));
      else toast.error(t("errors.saveFailed"));
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Database["public"]["Enums"]["record_status"];
    }) => {
      const patch =
        status === "approved"
          ? {
              status,
              approved_at: new Date().toISOString(),
              approved_by: session?.user.id ?? null,
            }
          : { status };
      const { error } = await supabase.from("custody_transactions").update(patch).eq("id", id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "custody_transaction",
        entityId: id,
        action: status === "approved" ? "approve" : "cancel",
        newValue: patch,
      });
      return status;
    },
    onSuccess: (status) => {
      toast.success(t(status === "approved" ? "custody.approved" : "custody.cancelled"));
      void queryClient.invalidateQueries({ queryKey: ["custody"] });
      void queryClient.invalidateQueries({ queryKey: ["custody-balances"] });
    },
    onError: () => toast.error(t("errors.saveFailed")),
  });

  const createReversal = useMutation({
    mutationFn: async () => {
      if (!reversalTarget) return;
      if (!reversalReason.trim()) throw new Error("reason");
      const source = rows.find((r) => r.id === reversalTarget);
      if (!source) throw new Error("missing");
      const payload = {
        supervisor_id: source.supervisor_id,
        project_id: source.project_id,
        txn_type: "reversal" as TxnType,
        amount: source.amount,
        txn_date: todayInRiyadh(),
        reason: reversalReason.trim(),
        reversal_of_id: source.id,
        status: "approved" as Database["public"]["Enums"]["record_status"],
        approved_at: new Date().toISOString(),
        approved_by: session?.user.id ?? null,
        created_by: session?.user.id ?? null,
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
        reason: reversalReason.trim(),
        newValue: payload,
      });
    },
    onSuccess: () => {
      toast.success(t("custody.reversalCreated"));
      setReversalTarget(null);
      setReversalReason("");
      void queryClient.invalidateQueries({ queryKey: ["custody"] });
      void queryClient.invalidateQueries({ queryKey: ["custody-balances"] });
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === "23505") toast.error(t("custody.reversalExists"));
      else if (error.message === "reason") toast.error(t("trash.reasonRequired"));
      else toast.error(t("errors.saveFailed"));
    },
  });

  return (
    <>
      <PageHeader
        title={t("custody.title")}
        description={t("custody.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("custody.newTransaction")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("custody.newTransaction")}</DialogTitle>
              </DialogHeader>
              <form
                id="custody-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate(form);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("custody.supervisor")} *</Label>
                    <Select
                      value={form.supervisor_id}
                      onValueChange={(v) => setForm({ ...form, supervisor_id: v, project_id: "" })}
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
                    <Label>{t("custody.project")}</Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => setForm({ ...form, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code} — {pickName(locale, p.name_ar, p.name_en)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("custody.type")} *</Label>
                    <Select
                      value={form.txn_type}
                      onValueChange={(v) => setForm({ ...form, txn_type: v as TxnType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {txnTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`custody.types.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("common.amount")} *</Label>
                    <Input
                      id="amount"
                      required
                      dir="ltr"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="txn_date">{t("custody.txnDate")} *</Label>
                    <Input
                      id="txn_date"
                      required
                      type="date"
                      dir="ltr"
                      value={form.txn_date}
                      onChange={(e) => setForm({ ...form, txn_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">{t("common.reason")}</Label>
                    <Input
                      id="reason"
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c_notes">{t("common.notes")}</Label>
                  <Textarea
                    id="c_notes"
                    value={form.notes_ar}
                    onChange={(e) => setForm({ ...form, notes_ar: e.target.value })}
                  />
                </div>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form="custody-form" disabled={create.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-56 space-y-2">
          <Label>{t("custody.supervisor")}</Label>
          <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {supervisors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {pickName(locale, s.name_ar, s.name_en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-44 space-y-2">
          <Label>{t("common.status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {["draft", "under_review", "approved", "cancelled"].map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedBalance && (
          <div className="surface px-4 py-2">
            <p className="text-xs text-muted-foreground">{t("custody.balance")}</p>
            <p className="num text-lg font-bold text-primary">
              {formatMoney(selectedBalance.balance, locale)}
            </p>
          </div>
        )}
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("custody.serial")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.supervisor")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.type")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.amount")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("custody.txnDate")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {t("custody.empty")}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const supervisor = row.supervisors as {
                  name_ar?: string;
                  name_en?: string;
                  national_id?: string;
                  phone?: string;
                } | null;
                const project = row.projects as {
                  code?: string;
                  name_ar?: string;
                  name_en?: string;
                } | null;
                return (
                  <tr key={row.id} className="hover:bg-secondary/40">
                    <td className="num px-4 py-3 font-medium">#{row.serial_no}</td>
                    <td className="px-4 py-3">
                      {pickName(locale, supervisor?.name_ar, supervisor?.name_en)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t(`custody.types.${row.txn_type}`)}
                    </td>
                    <td className="num px-4 py-3 font-semibold">
                      {formatMoney(row.amount, locale)}
                    </td>
                    <td className="num px-4 py-3">{formatDate(row.txn_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("custody.printVoucher")}
                          onClick={() =>
                            setVoucher({
                              serial: row.serial_no,
                              type: row.txn_type,
                              amount: Number(row.amount),
                              date: row.txn_date,
                              status: row.status,
                              supervisorName: pickName(
                                locale,
                                supervisor?.name_ar,
                                supervisor?.name_en,
                              ),
                              nationalId: supervisor?.national_id ?? "—",
                              phone: supervisor?.phone ?? "—",
                              projectName: project
                                ? `${project.code} — ${pickName(locale, project.name_ar, project.name_en)}`
                                : "—",
                              reason: row.reason,
                              notes: row.notes_ar,
                            })
                          }
                        >
                          <Printer className="size-4" aria-hidden />
                        </Button>
                        {isAccountant && row.status !== "approved" && row.status !== "cancelled" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("common.approve")}
                              onClick={() =>
                                changeStatus.mutate({ id: row.id, status: "approved" })
                              }
                            >
                              <Check className="size-4 text-success" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("common.cancel")}
                              onClick={() =>
                                changeStatus.mutate({ id: row.id, status: "cancelled" })
                              }
                            >
                              <Ban className="size-4 text-destructive" aria-hidden />
                            </Button>
                          </>
                        )}
                        {isAccountant && row.status === "approved" && row.txn_type !== "reversal" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("custody.reversal")}
                            onClick={() => setReversalTarget(row.id)}
                          >
                            <Undo2 className="size-4 text-warning-foreground" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!reversalTarget} onOpenChange={(v) => !v && setReversalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("custody.reversal")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("custody.approvedLocked")}</p>
          <div className="space-y-2">
            <Label htmlFor="rev_reason">{t("custody.reversalReason")} *</Label>
            <Textarea
              id="rev_reason"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversalTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={createReversal.isPending} onClick={() => createReversal.mutate()}>
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustodyVoucher data={voucher} onClose={() => setVoucher(null)} />
    </>
  );
}
