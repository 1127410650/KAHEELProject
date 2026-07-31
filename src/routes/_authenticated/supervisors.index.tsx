import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/supervisors/")({
  head: () => ({
    meta: [
      { title: "المشرفون — تحقّق | Supervisors — Tahqaq" },
      { name: "description", content: "إدارة بيانات المشرفين ومشاريعهم وأرصدة عهدهم في تحقّق." },
      { property: "og:title", content: "المشرفون — تحقّق" },
      { property: "og:description", content: "Manage supervisors, projects and custody balances." },
    ],
  }),
  component: SupervisorsPage,
});

interface SupervisorForm {
  id?: string;
  name_ar: string;
  name_en: string;
  national_id: string;
  phone: string;
  email: string;
  job_title: string;
  notes_ar: string;
  is_active: boolean;
}

const emptyForm: SupervisorForm = {
  name_ar: "",
  name_en: "",
  national_id: "",
  phone: "",
  email: "",
  job_title: "",
  notes_ar: "",
  is_active: true,
};


function SupervisorsPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SupervisorForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["supervisors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
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

  const balanceOf = (id: string) =>
    Number(balances.find((b) => b.supervisor_id === id)?.balance ?? 0);

  const save = useMutation({
    mutationFn: async (values: SupervisorForm) => {
      const payload = {
        name_ar: values.name_ar.trim(),
        name_en: values.name_en.trim() || null,
        national_id: values.national_id.trim(),
        phone: values.phone.trim(),
        email: values.email.trim() || null,
        job_title: values.job_title.trim() || null,
        notes_ar: values.notes_ar.trim() || null,
        is_active: values.is_active,
      };

      if (values.id) {
        const { error } = await supabase.from("supervisors").update(payload).eq("id", values.id);
        if (error) throw error;
        await logAudit({
          actorId: session?.user.id,
          entityType: "supervisor",
          entityId: values.id,
          action: "update",
          newValue: payload,
        });
        return "updated" as const;
      }
      const { data, error } = await supabase
        .from("supervisors")
        .insert({ ...payload, created_by: session?.user.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "supervisor",
        entityId: data.id,
        action: "create",
        newValue: payload,
      });
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(t(result === "created" ? "supervisors.created" : "supervisors.updated"));
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["supervisors"] });
    },
    onError: (error: { code?: string }) => {
      toast.error(error?.code === "23505" ? t("supervisors.duplicateNationalId") : t("errors.saveFailed"));
    },
  });

  const softDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (!deleteReason.trim()) throw new Error("reason");
      const { error } = await supabase
        .from("supervisors")
        .update({ deleted_at: new Date().toISOString(), delete_reason: deleteReason.trim() })
        .eq("id", deleteTarget.id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "supervisor",
        entityId: deleteTarget.id,
        action: "soft_delete",
        reason: deleteReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success(t("common.delete"));
      setDeleteTarget(null);
      setDeleteReason("");
      void queryClient.invalidateQueries({ queryKey: ["supervisors"] });
    },
    onError: (error: Error) => {
      toast.error(error.message === "reason" ? t("trash.reasonRequired") : t("errors.saveFailed"));
    },
  });

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.name_ar, row.name_en, row.national_id, row.phone]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader
        title={t("supervisors.title")}
        description={t("supervisors.description")}
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
                  {t("supervisors.add")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {form.id ? t("supervisors.edit") : t("supervisors.add")}
                  </DialogTitle>
                </DialogHeader>
                <form
                  id="supervisor-form"
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate(form);
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name_ar">{t("supervisors.nameAr")} *</Label>
                      <Input
                        id="name_ar"
                        required
                        value={form.name_ar}
                        onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name_en">
                        {t("supervisors.nameEn")}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({t("common.optional")})
                        </span>
                      </Label>
                      <Input
                        id="name_en"
                        dir="ltr"
                        value={form.name_en}
                        onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="national_id">{t("supervisors.nationalId")} *</Label>
                      <Input
                        id="national_id"
                        required
                        dir="ltr"
                        inputMode="numeric"
                        value={form.national_id}
                        onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("supervisors.phone")} *</Label>
                      <Input
                        id="phone"
                        required
                        dir="ltr"
                        inputMode="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s_email">
                        {t("supervisors.email")}{" "}
                        <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                      </Label>
                      <Input
                        id="s_email"
                        type="email"
                        dir="ltr"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s_job_title">
                        {t("supervisors.jobTitle")}{" "}
                        <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                      </Label>
                      <Input
                        id="s_job_title"
                        value={form.job_title}
                        onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">{t("common.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={form.notes_ar}
                      onChange={(e) => setForm({ ...form, notes_ar: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label htmlFor="is_active">{t("supervisors.isActive")}</Label>
                    <Switch
                      id="is_active"
                      checked={form.is_active}
                      onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                    />
                  </div>
                </form>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" form="supervisor-form" disabled={save.isPending}>
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
            <thead className="bg-secondary/60 text-start">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("supervisors.nameAr")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("supervisors.nationalId")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("supervisors.phone")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("supervisors.balance")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {t("supervisors.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/supervisors/$id"
                      params={{ id: row.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {pickName(locale, row.name_ar, row.name_en)}
                    </Link>
                  </td>
                  <td className="num px-4 py-3">{row.national_id}</td>
                  <td className="num px-4 py-3">{row.phone}</td>
                  <td className="num px-4 py-3 font-semibold">
                    {formatMoney(balanceOf(row.id), locale)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.is_active ? "active" : "inactive"} />
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
                              name_ar: row.name_ar,
                              name_en: row.name_en ?? "",
                              national_id: row.national_id,
                              phone: row.phone,
                              notes_ar: row.notes_ar ?? "",
                              is_active: row.is_active,
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
            <Label htmlFor="delete_reason">{t("trash.deleteReason")} *</Label>
            <Textarea
              id="delete_reason"
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
