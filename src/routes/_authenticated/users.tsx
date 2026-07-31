import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession, type AppRole } from "@/lib/session";
import { createAppUser, updateAppUser, listAuthLinks } from "@/lib/users.functions";
import {
  PERMISSION_LABELS_AR,
  PERMISSION_LABELS_EN,
  PERMISSION_GROUPS,
  PERMISSION_GROUP_LABELS_AR,
  PERMISSION_GROUP_LABELS_EN,
  GROUPED_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
} from "@/lib/permissions";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDate, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون والصلاحيات — تحقّق | Users — Tahqaq" },
      { name: "description", content: "إنشاء الحسابات وإدارة الأدوار والصلاحيات التفصيلية." },
      { property: "og:title", content: "المستخدمون والصلاحيات — تحقّق" },
      { property: "og:description", content: "Manage accounts, roles and permissions in Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

interface UserForm {
  full_name: string;
  national_id: string;
  phone: string;
  email: string;
  role: AppRole;
  supervisor_id: string;
  project_ids: string[];
  permissions: string[];
  is_active: boolean;
  must_change_password: boolean;
  password: string;
}

const emptyForm: UserForm = {
  full_name: "",
  national_id: "",
  phone: "",
  email: "",
  role: "employee",
  supervisor_id: "",
  project_ids: [],
  permissions: ROLE_DEFAULT_PERMISSIONS["employee"] ?? [],
  is_active: true,
  must_change_password: true,
  password: "",
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function UsersPage() {
  const { t, locale } = useI18n();
  const { isAccountant } = useSession();
  const queryClient = useQueryClient();
  const create = useServerFn(createAppUser);
  const update = useServerFn(updateAppUser);
  const labels = locale === "ar" ? PERMISSION_LABELS_AR : PERMISSION_LABELS_EN;
  const groupLabels = locale === "ar" ? PERMISSION_GROUP_LABELS_AR : PERMISSION_GROUP_LABELS_EN;
  const fetchAuthLinks = useServerFn(listAuthLinks);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>({ ...emptyForm, password: randomPassword() });
  const [editing, setEditing] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["users"],
    enabled: isAccountant,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }, { data: perms }, { data: members }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("created_at"),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("user_permissions").select("user_id, permission"),
          supabase.from("project_members").select("user_id, project_id"),
        ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.user_id)?.role ?? null,
        permissions: (perms ?? []).filter((x) => x.user_id === p.user_id).map((x) => x.permission),
        project_ids: (members ?? [])
          .filter((x) => x.user_id === p.user_id)
          .map((x) => x.project_id),
      }));
    },
  });

  const { data: authLinks } = useQuery({
    queryKey: ["users", "auth-links"],
    enabled: isAccountant,
    queryFn: async () => (await fetchAuthLinks()).auth_user_ids,
  });
  const linkedIds = new Set(authLinks ?? []);

  const { data: supervisors = [] } = useQuery({
    queryKey: ["supervisors", "list"],
    enabled: isAccountant,
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

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "list"],
    enabled: isAccountant,
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

  const saveUser = useMutation({
    mutationFn: async (values: UserForm) => {
      if (editing) {
        await update({
          data: {
            user_id: editing,
            role: values.role,
            supervisor_id: values.role === "supervisor" ? values.supervisor_id || null : null,
            project_ids: values.project_ids,
            permissions: values.permissions,
            is_active: values.is_active,
            ...(values.password ? { reset_password: values.password } : {}),
          },
        });
        return { password: values.password, created: false };
      }
      await create({
        data: {
          full_name: values.full_name.trim(),
          national_id: values.national_id.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          role: values.role,
          supervisor_id: values.role === "supervisor" ? values.supervisor_id || null : null,
          project_ids: values.project_ids,
          permissions: values.permissions,
          is_active: values.is_active,
          must_change_password: values.must_change_password,
          password: values.password,
        },
      });
      return { password: values.password, created: true };
    },
    onSuccess: (result) => {
      toast.success(
        result.created
          ? `${t("users.created")} — ${t("users.tempPassword")}: ${result.password}`
          : t("users.updated"),
        { duration: 12000 },
      );
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyForm, password: randomPassword() });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => {
      const message = error.message ?? "";
      if (message.includes("EMAIL_TAKEN")) toast.error(t("users.emailTaken"));
      else if (message.includes("DUPLICATE")) toast.error(t("users.duplicate"));
      else if (message.includes("FORBIDDEN")) toast.error(t("users.restricted"));
      else toast.error(t("errors.saveFailed"));
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      await update({ data: { user_id: userId, is_active: active } });
    },
    onSuccess: () => {
      toast.success(t("users.updated"));
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error(t("errors.saveFailed")),
  });

  if (!isAccountant) {
    return (
      <>
        <PageHeader title={t("users.title")} />
        <div className="surface p-10 text-center text-muted-foreground">
          {t("users.restricted")}
        </div>
      </>
    );
  }

  function openEdit(row: (typeof rows)[number]) {
    setEditing(row.user_id);
    setForm({
      full_name: row.full_name,
      national_id: row.national_id ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      role: (row.role as AppRole) ?? "employee",
      supervisor_id: row.supervisor_id ?? "",
      project_ids: row.project_ids,
      permissions: row.permissions,
      is_active: row.is_active,
      must_change_password: row.must_change_password,
      password: "",
    });
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setEditing(null);
                setForm({ ...emptyForm, password: randomPassword() });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("users.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? t("users.edit") : t("users.add")}</DialogTitle>
              </DialogHeader>
              <form
                id="user-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (form.role === "supervisor" && !form.supervisor_id) {
                    toast.error(t("users.supervisorRequired"));
                    return;
                  }
                  if (!saveUser.isPending) saveUser.mutate(form);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="u_name">{t("users.fullName")} *</Label>
                    <Input
                      id="u_name"
                      required
                      disabled={!!editing}
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="u_nid">{t("users.nationalId")} *</Label>
                    <Input
                      id="u_nid"
                      required
                      dir="ltr"
                      disabled={!!editing}
                      value={form.national_id}
                      onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="u_phone">{t("users.phone")} *</Label>
                    <Input
                      id="u_phone"
                      required
                      dir="ltr"
                      disabled={!!editing}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="u_email">{t("users.email")} *</Label>
                    <Input
                      id="u_email"
                      required
                      type="email"
                      dir="ltr"
                      disabled={!!editing}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("users.role")} *</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          role: v as AppRole,
                          permissions: ROLE_DEFAULT_PERMISSIONS[v] ?? [],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accountant">{t("roles.accountant")}</SelectItem>
                        <SelectItem value="employee">{t("roles.employee")}</SelectItem>
                        <SelectItem value="supervisor">{t("roles.supervisor")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.role === "supervisor" && (
                    <div className="space-y-2">
                      <Label>{t("users.linkedSupervisor")} *</Label>
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
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="u_pass">
                      {editing ? t("users.resetPassword") : t("users.tempPassword")}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="u_pass"
                        dir="ltr"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setForm({ ...form, password: randomPassword() })}
                      >
                        <KeyRound className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.is_active}
                      onCheckedChange={(v) => setForm({ ...form, is_active: v === true })}
                    />
                    {t("users.accountActive")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.must_change_password}
                      onCheckedChange={(v) =>
                        setForm({ ...form, must_change_password: v === true })
                      }
                    />
                    {t("users.forcePasswordChange")}
                  </label>
                </div>

                <div className="space-y-2">
                  <Label>{t("users.allowedProjects")}</Label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-3">
                    {projects.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.project_ids.includes(p.id)}
                          onCheckedChange={(v) =>
                            setForm({
                              ...form,
                              project_ids:
                                v === true
                                  ? [...form.project_ids, p.id]
                                  : form.project_ids.filter((x) => x !== p.id),
                            })
                          }
                        />
                        <span className="num">{p.code}</span>
                        {pickName(locale, p.name_ar, p.name_en)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t("users.permissions")}</Label>
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
                    {PERMISSION_GROUPS.map((group) => {
                      const items = GROUPED_PERMISSIONS[group];
                      if (!items.length) return null;
                      return (
                        <div
                          key={group}
                          className="overflow-hidden rounded-lg border border-border/70"
                        >
                          <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold">
                            {groupLabels[group]}
                          </div>
                          <div className="grid gap-1 p-3 sm:grid-cols-2">
                            {items.map((permission) => (
                              <label
                                key={permission}
                                className="flex min-h-9 items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={form.permissions.includes(permission)}
                                  onCheckedChange={(v) =>
                                    setForm({
                                      ...form,
                                      permissions:
                                        v === true
                                          ? [...form.permissions, permission]
                                          : form.permissions.filter((x) => x !== permission),
                                    })
                                  }
                                />
                                <span>{labels[permission]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form="user-form" disabled={saveUser.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Mobile: compact cards */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 && (
          <div className="surface p-6 text-center text-sm text-muted-foreground">
            {t("users.empty")}
          </div>
        )}
        {rows.map((row) => (
          <div key={row.id} className="surface space-y-2 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-base font-semibold">{row.full_name}</p>
              <StatusBadge status={row.is_active ? "active" : "inactive"} />
            </div>
            <dl className="space-y-1 text-[13px] text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>{t("users.role")}</dt>
                <dd className="text-foreground">{row.role ? t(`roles.${row.role}`) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0">{t("users.email")}</dt>
                <dd className="num min-w-0 truncate text-foreground" dir="ltr">
                  {row.email ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t("users.nationalId")}</dt>
                <dd className="num text-foreground" dir="ltr">
                  {row.national_id ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t("users.permissions")}</dt>
                <dd className="num text-foreground">
                  {row.role === "accountant" ? t("users.allPermissions") : row.permissions.length}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t("users.authLink")}</dt>
                <dd className="text-foreground">
                  {authLinks
                    ? linkedIds.has(row.user_id)
                      ? t("users.authLinked")
                      : t("users.authMissing")
                    : "…"}
                </dd>
              </div>
              {expanded === row.id && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <dt>{t("users.uid")}</dt>
                    <dd className="flex items-center gap-1">
                      <span className="num text-foreground" dir="ltr">
                        {row.user_id.slice(0, 8)}…
                      </span>
                      <button
                        type="button"
                        aria-label={t("common.copy")}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          void navigator.clipboard.writeText(row.user_id);
                          toast.success(t("common.copied"));
                        }}
                      >
                        <Copy className="size-3.5" aria-hidden />
                      </button>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{t("common.createdAt")}</dt>
                    <dd className="num text-foreground">{formatDate(row.created_at)}</dd>
                  </div>
                </>
              )}
            </dl>
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => setExpanded((v) => (v === row.id ? null : row.id))}
            >
              {expanded === row.id ? t("common.hideDetails") : t("common.showDetails")}
            </button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-10 flex-1 text-[13px]"
                onClick={() => openEdit(row)}
              >
                <ShieldCheck className="size-4" aria-hidden />
                {t("common.edit")}
              </Button>
              <Button
                size="sm"
                className="h-10 flex-1 text-[13px]"
                variant={row.is_active ? "outline" : "default"}
                disabled={toggleActive.isPending}
                onClick={() => toggleActive.mutate({ userId: row.user_id, active: !row.is_active })}
              >
                {row.is_active ? t("users.deactivate") : t("users.activate")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="surface hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("users.fullName")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.email")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.role")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.permissions")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.authLink")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.uid")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.createdAt")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    {t("users.empty")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{row.full_name}</td>
                  <td className="num px-4 py-3 text-muted-foreground" dir="ltr">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">{row.role ? t(`roles.${row.role}`) : "—"}</td>
                  <td className="num px-4 py-3 text-muted-foreground">
                    {row.role === "accountant" ? t("users.allPermissions") : row.permissions.length}
                  </td>
                  <td className="px-4 py-3">
                    {authLinks ? (
                      <StatusBadge status={linkedIds.has(row.user_id) ? "active" : "inactive"} />
                    ) : (
                      "…"
                    )}
                  </td>
                  <td className="num px-4 py-3 text-[11px] text-muted-foreground" dir="ltr">
                    {row.user_id}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="num px-4 py-3">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        <ShieldCheck className="size-4" aria-hidden />
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant={row.is_active ? "outline" : "default"}
                        disabled={toggleActive.isPending}
                        onClick={() =>
                          toggleActive.mutate({ userId: row.user_id, active: !row.is_active })
                        }
                      >
                        {row.is_active ? t("users.deactivate") : t("users.activate")}
                      </Button>
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
