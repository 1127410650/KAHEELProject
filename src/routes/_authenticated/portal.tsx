import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  REQUEST_KINDS,
  REQUEST_KIND_LABELS_AR,
  REQUEST_KIND_LABELS_EN,
  type RequestKind,
} from "@/lib/permissions";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMoney, pickName, todayInRiyadh } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "بوابة المشرف — تحقّق | Supervisor portal — Tahqaq" },
      {
        name: "description",
        content: "بوابة المشرف لإرسال طلبات إضافة الرصيد والصرف والمشاريع ومتابعة حالتها.",
      },
      { property: "og:title", content: "بوابة المشرف — تحقّق" },
      { property: "og:description", content: "Submit and track supervisor requests in Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

interface PortalForm {
  kind: RequestKind;
  project_id: string;
  amount: string;
  authority: string;
  notes_ar: string;
  request_date: string;
}

function PortalPage() {
  const { t, locale } = useI18n();
  const { supervisorId, isSupervisor, session } = useSession();
  const queryClient = useQueryClient();
  const kindLabels = locale === "ar" ? REQUEST_KIND_LABELS_AR : REQUEST_KIND_LABELS_EN;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PortalForm>({
    kind: "custody_topup",
    project_id: "",
    amount: "",
    authority: "",
    notes_ar: "",
    request_date: todayInRiyadh(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["portal", "projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en")
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ["portal", "balance", supervisorId],
    enabled: !!supervisorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_balances")
        .select("balance")
        .eq("supervisor_id", supervisorId!)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["portal", "requests", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, projects(code, name_ar, name_en)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async (values: PortalForm) => {
      const { error } = await supabase.rpc("submit_portal_request", {
        _kind: values.kind,
        _request_type: kindLabels[values.kind],
        _project_id: values.kind === "project_create" ? null : values.project_id || null,
        _amount: values.amount ? Number(values.amount) : null,
        _notes_ar: values.notes_ar || null,
        _authority: values.authority || null,
        _request_date: values.request_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("portal.submitted"));
      setOpen(false);
      setForm({
        kind: "custody_topup",
        project_id: "",
        amount: "",
        authority: "",
        notes_ar: "",
        request_date: todayInRiyadh(),
      });
      void queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (error: Error) => {
      const message = error.message ?? "";
      if (message.includes("PROJECT_REQUIRED")) toast.error(t("requests.projectRequired"));
      else if (message.includes("AMOUNT_REQUIRED")) toast.error(t("common.required"));
      else if (message.includes("FORBIDDEN")) toast.error(t("common.notAllowed"));
      else toast.error(t("portal.submitFailed"));
    },
  });

  if (!isSupervisor) {
    return (
      <>
        <PageHeader title={t("portal.title")} />
        <div className="surface p-10 text-center text-muted-foreground">
          {t("portal.notSupervisor")}
        </div>
      </>
    );
  }

  const amountRequired = form.kind === "custody_topup" || form.kind === "payment";

  return (
    <>
      <PageHeader
        title={t("portal.title")}
        description={t("portal.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("portal.newRequest")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{t("portal.newRequest")}</DialogTitle>
              </DialogHeader>
              <form
                id="portal-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (form.kind !== "project_create" && !form.project_id) {
                    toast.error(t("requests.projectRequired"));
                    return;
                  }
                  if (amountRequired && !(Number(form.amount) > 0)) {
                    toast.error(t("common.required"));
                    return;
                  }
                  if (!submit.isPending) submit.mutate(form);
                }}
              >
                <div className="space-y-2">
                  <Label>{t("portal.kind")} *</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(v) => setForm({ ...form, kind: v as RequestKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {kindLabels[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.kind !== "project_create" && (
                  <div className="space-y-2">
                    <Label>{t("requests.project")} *</Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => setForm({ ...form, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="num">{p.code}</span>{" "}
                            {pickName(locale, p.name_ar, p.name_en)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p_amount">
                      {t("portal.amount")} {amountRequired ? "*" : ""}
                    </Label>
                    <Input
                      id="p_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      className="num"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_date">{t("requests.requestDate")} *</Label>
                    <Input
                      id="p_date"
                      type="date"
                      required
                      dir="ltr"
                      className="num"
                      value={form.request_date}
                      onChange={(e) => setForm({ ...form, request_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p_authority">{t("requests.authority")}</Label>
                  <Input
                    id="p_authority"
                    value={form.authority}
                    onChange={(e) => setForm({ ...form, authority: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p_notes">{t("portal.details")}</Label>
                  <Textarea
                    id="p_notes"
                    rows={3}
                    value={form.notes_ar}
                    onChange={(e) => setForm({ ...form, notes_ar: e.target.value })}
                  />
                </div>

                <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                  {t("portal.awaitingApproval")}
                </p>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form="portal-form" disabled={submit.isPending}>
                  {t("common.submit")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="surface mb-6 flex items-center gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{t("portal.myBalance")}</p>
          <p className="num text-xl font-bold">{formatMoney(balance ?? 0, locale)}</p>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("requests.requestNo")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("portal.kind")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("requests.project")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.amount")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("requests.requestDate")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {t("portal.noRequests")}
                  </td>
                </tr>
              )}
              {requests.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="num px-4 py-3 font-medium">
                    <Link to="/requests/$id" params={{ id: row.id }} className="hover:underline">
                      {row.request_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {kindLabels[row.kind as RequestKind] ?? row.request_type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.projects
                      ? pickName(locale, row.projects.name_ar, row.projects.name_en)
                      : "—"}
                  </td>
                  <td className="num px-4 py-3">
                    {row.amount === null ? "—" : formatMoney(row.amount, locale)}
                  </td>
                  <td className="num px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {formatDate(row.request_date)}
                      {row.payment_no && <PaymentNoBadge value={row.payment_no} />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
