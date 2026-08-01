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
import { MobileCards, MobileEmpty, RecordCard } from "@/components/RecordCard";

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
import { pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردون — تحقّق | Suppliers — Tahqaq" },
      {
        name: "description",
        content: "إدارة الموردين وأرقامهم الضريبية وسجلاتهم التجارية وحالة التعامل معهم.",
      },
      { property: "og:title", content: "الموردون — تحقّق" },
      { property: "og:description", content: "Manage suppliers, tax numbers and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuppliersPage,
});

interface SupplierForm {
  id?: string;
  name_ar: string;
  name_en: string;
  tax_number: string;
  commercial_reg: string;
  unified_number: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  notes: string;
  is_active: boolean;
}

const emptyForm: SupplierForm = {
  name_ar: "",
  name_en: "",
  tax_number: "",
  commercial_reg: "",
  unified_number: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  notes: "",
  is_active: true,
};

function SuppliersPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (values: SupplierForm) => {
      const payload = {
        name_ar: values.name_ar.trim(),
        name_en: values.name_en.trim() || null,
        tax_number: values.tax_number.trim() || null,
        commercial_reg: values.commercial_reg.trim() || null,
        unified_number: values.unified_number.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        city: values.city.trim() || null,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null,
        is_active: values.is_active,
      };

      if (values.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", values.id);
        if (error) throw error;
        await logAudit({
          actorId: session?.user.id,
          entityType: "supplier",
          entityId: values.id,
          action: "update",
          newValue: payload,
        });
        return "updated" as const;
      }
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...payload, created_by: session?.user.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "supplier",
        entityId: data.id,
        action: "create",
        newValue: payload,
      });
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(t(result === "created" ? "suppliers.created" : "suppliers.updated"));
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: { code?: string }) => {
      toast.error(
        error?.code === "23505" ? t("suppliers.duplicateTaxNumber") : t("errors.saveFailed"),
      );
    },
  });

  const softDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (!deleteReason.trim()) throw new Error("reason");
      const { error } = await supabase
        .from("suppliers")
        .update({ deleted_at: new Date().toISOString(), delete_reason: deleteReason.trim() })
        .eq("id", deleteTarget.id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "supplier",
        entityId: deleteTarget.id,
        action: "soft_delete",
        reason: deleteReason.trim(),
      });
    },
    onSuccess: () => {
      toast.success(t("common.delete"));
      setDeleteTarget(null);
      setDeleteReason("");
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: Error) => {
      toast.error(error.message === "reason" ? t("trash.reasonRequired") : t("errors.saveFailed"));
    },
  });

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.name_ar, row.name_en, row.tax_number, row.commercial_reg, row.phone, row.city]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader
        title={t("suppliers.title")}
        description={t("suppliers.description")}
        actions={
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
                {t("suppliers.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? t("suppliers.edit") : t("suppliers.add")}</DialogTitle>
              </DialogHeader>
              <form
                id="supplier-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate(form);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s_name_ar">{t("suppliers.nameAr")} *</Label>
                    <Input
                      id="s_name_ar"
                      required
                      value={form.name_ar}
                      onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_name_en">{t("suppliers.nameEn")}</Label>
                    <Input
                      id="s_name_en"
                      dir="ltr"
                      value={form.name_en}
                      onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_tax">{t("suppliers.taxNumber")}</Label>
                    <Input
                      id="s_tax"
                      dir="ltr"
                      inputMode="numeric"
                      className="num"
                      value={form.tax_number}
                      onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_reg">{t("suppliers.commercialReg")}</Label>
                    <Input
                      id="s_reg"
                      dir="ltr"
                      inputMode="numeric"
                      className="num"
                      value={form.commercial_reg}
                      onChange={(e) => setForm({ ...form, commercial_reg: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_unified">{t("suppliers.unifiedNumber")}</Label>
                    <Input
                      id="s_unified"
                      dir="ltr"
                      inputMode="numeric"
                      className="num"
                      value={form.unified_number}
                      onChange={(e) => setForm({ ...form, unified_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_phone">{t("suppliers.phone")}</Label>
                    <Input
                      id="s_phone"
                      dir="ltr"
                      inputMode="tel"
                      className="num"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_email">{t("suppliers.email")}</Label>
                    <Input
                      id="s_email"
                      type="email"
                      dir="ltr"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_city">{t("suppliers.city")}</Label>
                    <Input
                      id="s_city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s_address">{t("suppliers.address")}</Label>
                  <Input
                    id="s_address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s_notes">{t("suppliers.notes")}</Label>
                  <Textarea
                    id="s_notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <Label htmlFor="s_active">{t("suppliers.isActive")}</Label>
                  <Switch
                    id="s_active"
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                </div>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form="supplier-form" disabled={save.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-sm">
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

      <MobileCards>
        {filtered.length === 0 && <MobileEmpty>{t("suppliers.empty")}</MobileEmpty>}
        {filtered.map((row) => (
          <RecordCard
            key={row.id}
            title={pickName(locale, row.name_ar, row.name_en)}
            subtitle={row.city || undefined}
            badge={<StatusBadge status={row.is_active ? "active" : "inactive"} />}
            fields={[
              {
                label: t("suppliers.taxNumber"),
                value: row.tax_number || "—",
                num: true,
                ltr: true,
              },
              {
                label: t("suppliers.commercialReg"),
                value: row.commercial_reg || "—",
                num: true,
                ltr: true,
              },
              { label: t("suppliers.phone"), value: row.phone || "—", num: true, ltr: true },
            ]}
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={() => {
                    setForm({
                      id: row.id,
                      name_ar: row.name_ar,
                      name_en: row.name_en ?? "",
                      tax_number: row.tax_number ?? "",
                      commercial_reg: row.commercial_reg ?? "",
                      unified_number: row.unified_number ?? "",
                      phone: row.phone ?? "",
                      email: row.email ?? "",
                      city: row.city ?? "",
                      address: row.address ?? "",
                      notes: row.notes ?? "",
                      is_active: row.is_active,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  {t("common.edit")}
                </Button>
                {isAccountant && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs text-destructive"
                    onClick={() =>
                      setDeleteTarget({
                        id: row.id,
                        name: pickName(locale, row.name_ar, row.name_en),
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {t("common.delete")}
                  </Button>
                )}
              </>
            }
          />
        ))}
      </MobileCards>

      <div className="surface hidden overflow-hidden sm:block">
        <div className="overflow-x-auto">

          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("suppliers.nameAr")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("suppliers.taxNumber")}</th>
                <th className="px-4 py-3 text-start font-semibold">
                  {t("suppliers.commercialReg")}
                </th>
                <th className="px-4 py-3 text-start font-semibold">{t("suppliers.phone")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("suppliers.city")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {t("suppliers.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">
                    {pickName(locale, row.name_ar, row.name_en)}
                  </td>
                  <td className="num px-4 py-3" dir="ltr">
                    {row.tax_number || "—"}
                  </td>
                  <td className="num px-4 py-3" dir="ltr">
                    {row.commercial_reg || "—"}
                  </td>
                  <td className="num px-4 py-3" dir="ltr">
                    {row.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.city || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3">
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
                            tax_number: row.tax_number ?? "",
                            commercial_reg: row.commercial_reg ?? "",
                            unified_number: row.unified_number ?? "",
                            phone: row.phone ?? "",
                            email: row.email ?? "",
                            city: row.city ?? "",
                            address: row.address ?? "",
                            notes: row.notes ?? "",
                            is_active: row.is_active,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      {isAccountant && (
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
                      )}
                    </div>
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
            <Label htmlFor="s_del_reason">{t("trash.deleteReason")} *</Label>
            <Textarea
              id="s_del_reason"
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
