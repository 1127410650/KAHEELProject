import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Paperclip, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  REQUEST_KIND_LABELS_AR,
  REQUEST_KIND_LABELS_EN,
  type RequestKind,
} from "@/lib/permissions";
import {
  PORTAL_KINDS,
  PRIORITIES,
  kindNeedsAmount,
  kindNeedsProject,
  requestProgress,
} from "@/lib/requests";
import { ACCEPT, isAllowedFile, isAllowedSize, uploadAttachments } from "@/lib/attachments";
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
  title: string;
  project_id: string;
  amount: string;
  priority: string;
  authority: string;
  beneficiary: string;
  account_ref: string;
  service_type: string;
  need_date: string;
  reason: string;
  notes_ar: string;
  request_date: string;
}

const EMPTY: PortalForm = {
  kind: "general",
  title: "",
  project_id: "",
  amount: "",
  priority: "normal",
  authority: "",
  beneficiary: "",
  account_ref: "",
  service_type: "",
  need_date: "",
  reason: "",
  notes_ar: "",
  request_date: todayInRiyadh(),
};

function PortalPage() {
  const { t, locale } = useI18n();
  const { supervisorId, isSupervisor, session, role } = useSession();
  const queryClient = useQueryClient();
  const kindLabels = locale === "ar" ? REQUEST_KIND_LABELS_AR : REQUEST_KIND_LABELS_EN;
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<PortalForm>(EMPTY);

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
        .select("*, projects!requests_project_id_fkey(code, name_ar, name_en)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async (values: PortalForm) => {
      if (files.some((f) => !isAllowedFile(f))) throw new Error("FILE_TYPE");
      if (files.some((f) => !isAllowedSize(f))) throw new Error("FILE_SIZE");

      const { data, error } = await supabase.rpc("submit_request", {
        _kind: values.kind,
        _request_type: kindLabels[values.kind],
        _title: values.title.trim() || kindLabels[values.kind],
        _priority: values.priority,
        _request_date: values.request_date,
        ...(kindNeedsProject(values.kind) && values.project_id
          ? { _project_id: values.project_id }
          : {}),
        ...(values.amount ? { _amount: Number(values.amount) } : {}),
        ...(values.authority ? { _authority: values.authority.trim() } : {}),
        ...(values.beneficiary ? { _beneficiary: values.beneficiary.trim() } : {}),
        ...(values.account_ref ? { _account_ref: values.account_ref.trim() } : {}),
        ...(values.service_type ? { _service_type: values.service_type.trim() } : {}),
        ...(values.need_date ? { _need_date: values.need_date } : {}),
        ...(values.reason ? { _reason: values.reason.trim() } : {}),
        ...(values.notes_ar ? { _notes_ar: values.notes_ar.trim() } : {}),
      });
      if (error) throw error;

      const requestId = data as string;
      if (files.length && requestId) {
        await uploadAttachments(files, {
          projectId: kindNeedsProject(values.kind) ? values.project_id || null : null,
          requestId,
          entityType: "request",
          entityId: requestId,
          kind: "supervisor_doc",
          uploaderRole: role,
          userId: session?.user.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success(t("portal.submitted"));
      setOpen(false);
      setForm(EMPTY);
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["portal"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (error: Error) => {
      const message = error.message ?? "";
      if (message.includes("PROJECT_REQUIRED")) toast.error(t("requests.projectRequired"));
      else if (message.includes("AMOUNT_REQUIRED")) toast.error(t("common.required"));
      else if (message.includes("DUPLICATE_FILE")) toast.error(t("attachments.duplicate"));
      else if (message.includes("FILE_TYPE")) toast.error(t("attachments.fileType"));
      else if (message.includes("FILE_SIZE")) toast.error(t("attachments.fileSize"));
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

  const needsProject = kindNeedsProject(form.kind);
  const amountRequired = kindNeedsAmount(form.kind);

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
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("portal.newRequest")}</DialogTitle>
              </DialogHeader>
              <form
                id="portal-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (needsProject && !form.project_id) {
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
                      {PORTAL_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {kindLabels[kind as RequestKind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p_title">{t("requests.title")} *</Label>
                  <Input
                    id="p_title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                {needsProject && (
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
                    <Label>{t("requests.priority")}</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {t(`priority.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="space-y-2">
                    <Label htmlFor="p_need">{t("requests.needDate")}</Label>
                    <Input
                      id="p_need"
                      type="date"
                      dir="ltr"
                      className="num"
                      value={form.need_date}
                      onChange={(e) => setForm({ ...form, need_date: e.target.value })}
                    />
                  </div>
                </div>

                {form.kind === "payment" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="p_ben">{t("requests.beneficiary")}</Label>
                      <Input
                        id="p_ben"
                        value={form.beneficiary}
                        onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p_acc">{t("requests.accountRef")}</Label>
                      <Input
                        id="p_acc"
                        dir="ltr"
                        className="num"
                        value={form.account_ref}
                        onChange={(e) => setForm({ ...form, account_ref: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {(form.kind === "project_service" || form.kind === "utility_meter") && (
                  <div className="space-y-2">
                    <Label htmlFor="p_service">{t("requests.serviceType")}</Label>
                    <Input
                      id="p_service"
                      value={form.service_type}
                      onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="p_authority">{t("requests.authority")}</Label>
                  <Input
                    id="p_authority"
                    value={form.authority}
                    onChange={(e) => setForm({ ...form, authority: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p_reason">{t("requests.reason")}</Label>
                  <Input
                    id="p_reason"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
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

                <div className="space-y-2">
                  <Label htmlFor="p_files">{t("attachments.add")}</Label>
                  <Input
                    id="p_files"
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                  {files.length > 0 && (
                    <p className="num flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="size-3" aria-hidden />
                      {files.length}
                    </p>
                  )}
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
                <th className="px-4 py-3 text-start font-semibold">{t("requests.progress")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
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
                      {row.payment_no && <PaymentNoBadge paymentNo={row.payment_no} />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${requestProgress(row.status)}%` }}
                        />
                      </span>
                      <span className="num text-xs text-muted-foreground">
                        {requestProgress(row.status)}%
                      </span>
                    </div>
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
