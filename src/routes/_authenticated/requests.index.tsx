import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, History } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentNoBadge } from "@/components/PaymentNoBadge";
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
import { formatDate, formatDateTime, pickName, todayInRiyadh } from "@/lib/format";
import {
  ALL_REQUEST_STATUSES,
  INBOX_VIEWS,
  matchesInboxView,
  requestProgress,
  type InboxView,
} from "@/lib/requests";
import { cn } from "@/lib/utils";

import type { Database } from "@/integrations/supabase/types";

type RequestStatus = Database["public"]["Enums"]["request_status"];

export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({
    meta: [
      { title: "الطلبات — تحقّق | Requests — Tahqaq" },
      {
        name: "description",
        content: "إدارة الطلبات ومراحلها وربطها بالمشروع والمشرف داخل تحقّق.",
      },
      { property: "og:title", content: "الطلبات — تحقّق" },
      { property: "og:description", content: "Track requests and their stages per project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

const statuses: RequestStatus[] = ALL_REQUEST_STATUSES as unknown as RequestStatus[];


interface RequestForm {
  id?: string;
  request_no: string;
  request_type: string;
  project_id: string;
  request_date: string;
  reference_no: string;
  notes_ar: string;
  status: RequestStatus;
}

const emptyForm: RequestForm = {
  request_no: "",
  request_type: "",
  project_id: "",
  request_date: todayInRiyadh(),
  reference_no: "",
  notes_ar: "",
  status: "new",
};

function RequestsPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [inboxView, setInboxView] = useState<InboxView>("all");


  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en, supervisor_id, supervisors(name_ar, name_en)")
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["requests", projectFilter, statusFilter],
    queryFn: async () => {
      let request = supabase
        .from("requests")
        .select("*, projects(code, name_ar, name_en), supervisors(name_ar, name_en)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (projectFilter !== "all") request = request.eq("project_id", projectFilter);
      if (statusFilter !== "all") request = request.eq("status", statusFilter as RequestStatus);
      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["request-history", historyOf],
    enabled: !!historyOf,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_status_history")
        .select("*")
        .eq("request_id", historyOf!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.project_id),
    [projects, form.project_id],
  );

  const save = useMutation({
    mutationFn: async (values: RequestForm) => {
      const project = projects.find((p) => p.id === values.project_id);
      if (!project) throw new Error("project");
      const payload = {
        request_no: values.request_no.trim(),
        request_type: values.request_type.trim(),
        project_id: values.project_id,
        supervisor_id: project.supervisor_id,
        request_date: values.request_date,
        reference_no: values.reference_no.trim() || null,
        notes_ar: values.notes_ar.trim() || null,
      };
      if (values.id) {
        const { error } = await supabase.from("requests").update(payload).eq("id", values.id);
        if (error) throw error;
        await logAudit({
          actorId: session?.user.id,
          entityType: "request",
          entityId: values.id,
          action: "update",
          newValue: payload,
        });
        return "updated" as const;
      }
      const { data, error } = await supabase
        .from("requests")
        .insert({ ...payload, status: "new", created_by: session?.user.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "request",
        entityId: data.id,
        action: "create",
        newValue: payload,
      });
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(t(result === "created" ? "requests.created" : "requests.updated"));
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === "23505") toast.error(t("requests.duplicateNo"));
      else if (error.message === "project") toast.error(t("requests.projectRequired"));
      else toast.error(t("errors.saveFailed"));
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const { error } = await supabase.from("requests").update({ status }).eq("id", id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "request",
        entityId: id,
        action: "update",
        newValue: { status },
      });
    },
    onSuccess: () => {
      toast.success(t("requests.statusUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["request-history"] });
    },
    onError: () => toast.error(t("errors.saveFailed")),
  });

  const today = todayInRiyadh();
  const filtered = rows.filter((row) => {
    if (!matchesInboxView(row, inboxView, session?.user.id, today)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.request_no, row.request_type, row.reference_no, row.title]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });


  return (
    <>
      <PageHeader
        title={t("requests.title")}
        description={t("requests.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setForm(emptyForm);
            }}
          >
            <DialogTrigger asChild>
              <Button className="w-full gap-2 sm:w-auto">
                <Plus className="size-4" aria-hidden />
                {t("requests.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? t("requests.edit") : t("requests.add")}</DialogTitle>
              </DialogHeader>
              <form
                id="request-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!form.project_id) {
                    toast.error(t("requests.projectRequired"));
                    return;
                  }
                  save.mutate(form);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="r_no">{t("requests.requestNo")} *</Label>
                    <Input
                      id="r_no"
                      required
                      dir="ltr"
                      value={form.request_no}
                      onChange={(e) => setForm({ ...form, request_no: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r_type">{t("requests.requestType")} *</Label>
                    <Input
                      id="r_type"
                      required
                      value={form.request_type}
                      onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                    />
                  </div>
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
                            {p.code} — {pickName(locale, p.name_ar, p.name_en)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {t("requests.supervisor")}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({t("requests.supervisorFromProject")})
                      </span>
                    </Label>
                    <Input
                      readOnly
                      value={
                        selectedProject
                          ? pickName(
                              locale,
                              (selectedProject.supervisors as { name_ar?: string } | null)?.name_ar,
                              (selectedProject.supervisors as { name_en?: string } | null)?.name_en,
                            )
                          : ""
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r_date">{t("requests.requestDate")} *</Label>
                    <Input
                      id="r_date"
                      required
                      type="date"
                      lang="en-GB"
                      dir="ltr"
                      value={form.request_date}
                      onChange={(e) => setForm({ ...form, request_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r_ref">
                      {t("requests.referenceNo")}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({t("common.optional")})
                      </span>
                    </Label>
                    <Input
                      id="r_ref"
                      dir="ltr"
                      value={form.reference_no}
                      onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r_notes">{t("common.notes")}</Label>
                  <Textarea
                    id="r_notes"
                    value={form.notes_ar}
                    onChange={(e) => setForm({ ...form, notes_ar: e.target.value })}
                  />
                </div>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form="request-form" disabled={save.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <nav aria-label={t("requests.inbox")} className="mb-4 flex flex-wrap gap-2">
        {INBOX_VIEWS.map((view) => {
          const count = rows.filter((r) => matchesInboxView(r, view, session?.user.id, todayInRiyadh())).length;
          return (
            <button
              key={view}
              type="button"
              onClick={() => setInboxView(view)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                inboxView === view
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {t(`inbox.${view}`)}
              <span className="num opacity-70">{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="mb-4 flex flex-wrap items-end gap-3">

        <div className="relative w-full max-w-sm">
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
        <div className="w-full max-w-64 space-y-2">
          <Label>{t("requests.project")}</Label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {pickName(locale, p.name_ar, p.name_en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-48 space-y-2">
          <Label>{t("common.status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("requests.requestNo")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("requests.requestType")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("requests.project")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("requests.supervisor")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("requests.requestDate")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {t("requests.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-secondary/40"
                  onClick={() => void navigate({ to: "/requests/$id", params: { id: row.id } })}
                >
                  <td className="num px-4 py-3 font-medium">{row.request_no}</td>
                  <td className="px-4 py-3">{row.request_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="num">
                      {(row.projects as { code?: string } | null)?.code ?? "—"}
                    </span>{" "}
                    {pickName(
                      locale,
                      (row.projects as { name_ar?: string } | null)?.name_ar,
                      (row.projects as { name_en?: string } | null)?.name_en,
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {pickName(
                      locale,
                      (row.supervisors as { name_ar?: string } | null)?.name_ar,
                      (row.supervisors as { name_en?: string } | null)?.name_en,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="num">{formatDate(row.request_date)}</span>
                      <PaymentNoBadge paymentNo={row.payment_no} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1">
                      {isAccountant && (
                        <Select
                          value={row.status}
                          onValueChange={(v) =>
                            changeStatus.mutate({ id: row.id, status: v as RequestStatus })
                          }
                        >
                          <SelectTrigger
                            className="h-9 w-40"
                            aria-label={t("requests.changeStatus")}
                          >
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
                      )}
                      {(isAccountant ||
                        (row.created_by === session?.user.id &&
                          (row.status === "new" || row.status === "needs_info"))) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.edit")}
                          onClick={() => {
                            setForm({
                              id: row.id,
                              request_no: row.request_no,
                              request_type: row.request_type,
                              project_id: row.project_id ?? "",
                              request_date: row.request_date,
                              reference_no: row.reference_no ?? "",
                              notes_ar: row.notes_ar ?? "",
                              status: row.status,
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("requests.history")}
                        onClick={() => setHistoryOf(row.id)}
                      >
                        <History className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!historyOf} onOpenChange={(v) => !v && setHistoryOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requests.history")}</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    {h.from_status ? `${t(`status.${h.from_status}`)} → ` : ""}
                    {t(`status.${h.to_status}`)}
                  </span>
                  <span className="num text-xs text-muted-foreground">
                    {formatDateTime(h.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
