import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { RequestCard } from "@/components/RequestCard";
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
import { formatMoney, pickName, todayInRiyadh } from "@/lib/format";
import { REQUEST_KIND_LABELS_AR, REQUEST_KIND_LABELS_EN, type RequestKind } from "@/lib/permissions";
import {
  buildRequestTitle,
  resolveNextAction,
  STAFF_GROUPS,
  staffGroupOf,
  type StaffGroup,
} from "@/lib/request-ui";
import { cn } from "@/lib/utils";



export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({
    meta: [
      { title: "صندوق العمل — الطلبات — تحقّق | Workbox — Tahqaq" },
      {
        name: "description",
        content: "صندوق عمل الطلبات: ما هو مطلوب منك الآن وما ينتظر الرد أو الاعتماد أو التنفيذ.",
      },
      { property: "og:title", content: "صندوق العمل — الطلبات — تحقّق" },
      { property: "og:description", content: "Request workbox grouped by the action required." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

interface RequestForm {
  request_no: string;
  request_type: string;
  project_id: string;
  request_date: string;
  reference_no: string;
  notes_ar: string;
}

const emptyForm: RequestForm = {
  request_no: "",
  request_type: "",
  project_id: "",
  request_date: todayInRiyadh(),
  reference_no: "",
  notes_ar: "",
};

function RequestsPage() {
  const { t, locale } = useI18n();
  const { session, role, can } = useSession();
  const queryClient = useQueryClient();
  const kindLabels = locale === "ar" ? REQUEST_KIND_LABELS_AR : REQUEST_KIND_LABELS_EN;

  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [group, setGroup] = useState<StaffGroup>("mine_now");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(emptyForm);

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
    queryKey: ["requests", "workbox", projectFilter],
    queryFn: async () => {
      let request = supabase
        .from("requests")
        .select(
          "*, projects!requests_project_id_fkey(code, name_ar, name_en), supervisors(name_ar, name_en)",
        )
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (projectFilter !== "all") request = request.eq("project_id", projectFilter);
      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
  });

  const { data: unreadByRequest = new Map<string, number>() } = useQuery({
    queryKey: ["requests", "unread", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("request_id")
        .is("read_at", null)
        .limit(500);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const n of data ?? []) {
        if (!n.request_id) continue;
        map.set(n.request_id, (map.get(n.request_id) ?? 0) + 1);
      }
      return map;
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
        title: values.request_type.trim(),
        kind: "project_service" as const,
        request_scope: "project" as const,
        project_id: values.project_id,
        supervisor_id: project.supervisor_id,
        request_date: values.request_date,
        reference_no: values.reference_no.trim() || null,
        notes_ar: values.notes_ar.trim() || null,
      };
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
    },
    onSuccess: () => {
      toast.success(t("requests.created"));
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

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) =>
        !q
          ? true
          : [row.request_no, row.request_type, row.reference_no, row.title]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
      )
      .map((row) => {
        const projectName = row.projects
          ? pickName(locale, row.projects.name_ar, row.projects.name_en)
          : null;
        const action = resolveNextAction(row, {
          role,
          isSupervisorView: false,
          isRequester: row.created_by === session?.user.id,
          can: (perm) => can(perm as never),
        });
        return {
          group: staffGroupOf(row.status),
          card: {
            id: row.id,
            request_no: row.request_no,
            title: buildRequestTitle({ ...row, projectName }, t("requests.untitled")),
            typeLabel: kindLabels[row.kind as RequestKind] ?? row.request_type,
            projectName,
            requesterName: row.supervisors
              ? pickName(locale, row.supervisors.name_ar, row.supervisors.name_en)
              : null,
            status: row.status,
            requestDate: row.request_date,
            updatedAt: row.updated_at,
            actionText: t(action.messageKey),
            unread: unreadByRequest.get(row.id) ?? 0,
            amountText: row.amount != null ? formatMoney(row.amount, locale) : null,
            paymentNo: row.payment_no,
          },
        };
      });
  }, [rows, query, locale, role, can, session?.user.id, t, kindLabels, unreadByRequest]);

  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    for (const g of STAFF_GROUPS) base[g] = 0;
    for (const c of cards) base[c.group] = (base[c.group] ?? 0) + 1;
    return base;
  }, [cards]);

  const visible = cards.filter((c) => c.group === group);

  return (
    <>
      <PageHeader
        title={t("requests.workbox")}
        description={t("requests.workboxHint")}
        actions={
          can("requests.create") ? (
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
                  <DialogTitle>{t("requests.add")}</DialogTitle>
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
                              <span className="num">{p.code}</span> —{" "}
                              {pickName(locale, p.name_ar, p.name_en)}
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
                                (selectedProject.supervisors as { name_ar?: string } | null)
                                  ?.name_ar,
                                (selectedProject.supervisors as { name_en?: string } | null)
                                  ?.name_en,
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
          ) : null
        }
      />

      <nav aria-label={t("requests.workbox")} className="mb-4 flex flex-wrap gap-2">
        {STAFF_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              group === g
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {t(`groups.${g}`)}
            <span className="num opacity-70">{counts[g] ?? 0}</span>
          </button>
        ))}
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
                  <span className="num">{p.code}</span> — {pickName(locale, p.name_ar, p.name_en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="surface p-10 text-center text-sm text-muted-foreground">
          {t("groups.emptyGroup")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((c) => (
            <RequestCard key={c.card.id} data={c.card} showRequester />
          ))}
        </div>
      )}
    </>
  );
}

