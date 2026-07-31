import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
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
import { pickName } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type ProjectStatus = Database["public"]["Enums"]["project_status"];

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "المشاريع — تحقّق | Projects — Tahqaq" },
      { name: "description", content: "إدارة المشاريع وأكوادها والمشرف المسؤول وحالة كل مشروع." },
      { property: "og:title", content: "المشاريع — تحقّق" },
      { property: "og:description", content: "Manage projects, codes and assigned supervisors." },
    ],
  }),
  component: ProjectsPage,
});

interface ProjectForm {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  supervisor_id: string;
  status: ProjectStatus;
  city: string;
  location: string;
  start_date: string;
  description_ar: string;
  description_en: string;
}

const emptyForm: ProjectForm = {
  code: "",
  name_ar: "",
  name_en: "",
  supervisor_id: "",
  status: "active",
  city: "",
  location: "",
  start_date: "",
  description_ar: "",
  description_en: "",
};


const statuses: ProjectStatus[] = ["active", "on_hold", "completed", "cancelled"];

function ProjectsPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, supervisors(name_ar, name_en)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
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
        .eq("is_active", true)
        .order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProjectForm) => {
      const payload = {
        code: values.code.trim(),
        name_ar: values.name_ar.trim(),
        name_en: values.name_en.trim() || null,
        supervisor_id: values.supervisor_id,
        status: values.status,
        city: values.city.trim() || null,
        location: values.location.trim() || null,
        start_date: values.start_date || null,
        description_ar: values.description_ar.trim() || null,
        description_en: values.description_en.trim() || null,
      };

      if (values.id) {
        const { error } = await supabase.from("projects").update(payload).eq("id", values.id);
        if (error) throw error;
        await logAudit({
          actorId: session?.user.id,
          entityType: "project",
          entityId: values.id,
          action: "update",
          newValue: payload,
        });
        return "updated" as const;
      }
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...payload, created_by: session?.user.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "project",
        entityId: data.id,
        action: "create",
        newValue: payload,
      });
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(t(result === "created" ? "projects.created" : "projects.updated"));
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: { code?: string }) => {
      toast.error(error?.code === "23505" ? t("projects.duplicateCode") : t("errors.saveFailed"));
    },
  });

  const softDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (!deleteReason.trim()) throw new Error("reason");
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString(), delete_reason: deleteReason.trim() })
        .eq("id", deleteTarget.id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "project",
        entityId: deleteTarget.id,
        action: "soft_delete",
        reason: deleteReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success(t("common.delete"));
      setDeleteTarget(null);
      setDeleteReason("");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => {
      toast.error(error.message === "reason" ? t("trash.reasonRequired") : t("errors.saveFailed"));
    },
  });

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.code, row.name_ar, row.name_en]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader
        title={t("projects.title")}
        description={t("projects.description")}
        actions={
          isAccountant && (
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setForm(emptyForm);
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" aria-hidden />
                  {t("projects.add")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{form.id ? t("projects.edit") : t("projects.add")}</DialogTitle>
                </DialogHeader>
                <form
                  id="project-form"
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!form.supervisor_id) {
                      toast.error(t("projects.supervisorRequired"));
                      return;
                    }
                    save.mutate(form);
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="code">{t("projects.code")} *</Label>
                      <Input
                        id="code"
                        required
                        dir="ltr"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p_name_ar">{t("projects.nameAr")} *</Label>
                      <Input
                        id="p_name_ar"
                        required
                        value={form.name_ar}
                        onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p_name_en">{t("projects.nameEn")}</Label>
                      <Input
                        id="p_name_en"
                        dir="ltr"
                        value={form.name_en}
                        onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("projects.supervisor")} *</Label>
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
                      <Label>{t("common.status")}</Label>
                      <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}
                      >
                        <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="p_desc_ar">{t("projects.descriptionAr")}</Label>
                    <Textarea
                      id="p_desc_ar"
                      value={form.description_ar}
                      onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_desc_en">{t("projects.descriptionEn")}</Label>
                    <Textarea
                      id="p_desc_en"
                      dir="ltr"
                      value={form.description_en}
                      onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                    />
                  </div>
                </form>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" form="project-form" disabled={save.isPending}>
                    {t("common.save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder={t("common.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-9"
        />
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("projects.code")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("projects.nameAr")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("projects.supervisor")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {t("projects.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="num px-4 py-3 font-medium">{row.code}</td>
                  <td className="px-4 py-3">{pickName(locale, row.name_ar, row.name_en)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {pickName(
                      locale,
                      (row.supervisors as { name_ar?: string } | null)?.name_ar,
                      (row.supervisors as { name_en?: string } | null)?.name_en,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {isAccountant && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.edit")}
                          onClick={() => {
                            setForm({
                              id: row.id,
                              code: row.code,
                              name_ar: row.name_ar,
                              name_en: row.name_en ?? "",
                              supervisor_id: row.supervisor_id,
                              status: row.status,
                              description_ar: row.description_ar ?? "",
                              description_en: row.description_en ?? "",
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.delete")}
                          onClick={() =>
                            setDeleteTarget({
                              id: row.id,
                              name: pickName(locale, row.name_ar, row.name_en),
                            })
                          }
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("trash.confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{deleteTarget?.name}</p>
          <div className="space-y-2">
            <Label htmlFor="p_delete_reason">{t("trash.deleteReason")} *</Label>
            <Textarea
              id="p_delete_reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={softDelete.isPending}
              onClick={() => softDelete.mutate()}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
