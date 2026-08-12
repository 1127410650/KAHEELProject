import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { formatDateTime } from "@/lib/format";
import {
  adminErrorMessage,
  loadAdminRoles,
  setPlatformRole,
  type AdminRoleRow,
  type PlatformRole,
} from "@/lib/mkt-platform";
import {
  groupCatalog,
  loadPermissionCatalog,
  saveStaffPerms,
  type PermissionCatalogRow,
} from "@/lib/mkt-access-control";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/access-control")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "الأدوار والصلاحيات — إدارة المنصة" },
      {
        name: "description",
        content:
          "منح الأدوار والصلاحيات وسحبها لكل منسوب من سجل صلاحيات موحّد، مع سبب إلزامي وأثر تدقيقي كامل.",
      },
      { property: "og:title", content: "الأدوار والصلاحيات — إدارة المنصة" },
      { property: "og:description", content: "إدارة أدوار وصلاحيات طاقم منصة كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessControlPage,
});

type RolePending = { row: AdminRoleRow; role: Exclude<PlatformRole, null> | null };

function AccessControlPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const roles = useQuery({ queryKey: ["mkt", "admin", "roles"], queryFn: loadAdminRoles });
  const catalog = useQuery({
    queryKey: ["mkt", "admin", "perm-catalog"],
    queryFn: loadPermissionCatalog,
    staleTime: 300_000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [rolePending, setRolePending] = useState<RolePending | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = roles.data ?? [];
  const selected = rows.find((row) => row.user_id === selectedId) ?? null;
  const groups = useMemo(() => groupCatalog(catalog.data ?? []), [catalog.data]);

  // The draft always starts from the server's answer for the selected person.
  useEffect(() => {
    setDraft(new Set(selected?.staff_perms ?? []));
  }, [selected?.user_id, selected?.staff_perms]);

  const original = useMemo(() => new Set(selected?.staff_perms ?? []), [selected?.staff_perms]);
  const added = useMemo(() => [...draft].filter((k) => !original.has(k)).sort(), [draft, original]);
  const removed = useMemo(
    () => [...original].filter((k) => !draft.has(k)).sort(),
    [draft, original],
  );
  const dirty = added.length > 0 || removed.length > 0;

  // A pending change must not be lost by a stray reload or tab close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const term = search.trim().toLowerCase();
  function matches(row: PermissionCatalogRow): boolean {
    if (!term) return true;
    return (
      row.perm_key.toLowerCase().includes(term) ||
      row.label_ar.toLowerCase().includes(term) ||
      row.label_en.toLowerCase().includes(term) ||
      row.description_ar.toLowerCase().includes(term) ||
      row.description_en.toLowerCase().includes(term)
    );
  }

  const visibleGroups = groups
    .map((group) => ({ ...group, rows: group.rows.filter(matches) }))
    .filter((group) => group.rows.length > 0);

  function toggle(key: string, next: boolean) {
    setDraft((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }

  function setGroup(groupRows: PermissionCatalogRow[], next: boolean) {
    setDraft((prev) => {
      const copy = new Set(prev);
      for (const row of groupRows) {
        if (next) copy.add(row.perm_key);
        else copy.delete(row.perm_key);
      }
      return copy;
    });
  }

  function label(row: PermissionCatalogRow): string {
    return locale === "en" ? row.label_en : row.label_ar;
  }
  function description(row: PermissionCatalogRow): string {
    return locale === "en" ? row.description_en : row.description_ar;
  }

  async function savePerms(reason: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await saveStaffPerms(selected.user_id, [...draft], reason);
      toast.success(t("admin.access.saved"));
      setConfirming(false);
      // A revoked permission must stop being honoured immediately: drop every
      // cached admin answer, not just this list.
      queryClient.removeQueries({ queryKey: ["mkt", "admin"] });
      queryClient.removeQueries({ queryKey: ["mkt", "platform-identity"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "roles"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.access.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function saveRole(reason: string) {
    if (!rolePending) return;
    setBusy(true);
    try {
      await setPlatformRole(rolePending.row.user_id, rolePending.role, reason);
      toast.success(t("admin.actionDone"));
      setRolePending(null);
      queryClient.removeQueries({ queryKey: ["mkt", "platform-identity"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "roles"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title={t("admin.nav.roles")} systemOwnerOnly>
      <p className="text-desc text-muted-foreground">{t("admin.access.hint")}</p>

      {roles.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : roles.isError ? (
        <p className="mt-6 text-sm text-destructive">{t("admin.access.loadFailed")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* Staff list */}
          <ul className="grid gap-2">
            {rows.map((row) => {
              const active = row.user_id === selectedId;
              return (
                <li key={row.user_id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      if (dirty && !window.confirm(t("admin.access.discard"))) return;
                      setSelectedId(row.user_id);
                    }}
                    className={`flex min-h-14 w-full items-start gap-[var(--sp-2)] rounded-xl border p-3 text-start ${
                      active ? "border-primary bg-secondary" : "border-border bg-card"
                    }`}
                  >
                    {row.platform_role === "system_owner" ? (
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <UserCog
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {row.display_name || t("admin.users.noName")}
                      </span>
                      <span className="block truncate text-desc text-muted-foreground">
                        {row.email}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-[var(--sp-2)]">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-desc font-medium text-foreground">
                          {row.platform_role
                            ? t(
                                `admin.role.${
                                  row.platform_role === "system_owner"
                                    ? "systemOwner"
                                    : "platformAdmin"
                                }`,
                              )
                            : t("admin.role.staff")}
                        </span>
                        <span className="text-desc tabular-nums text-muted-foreground">
                          {row.staff_perms.length} / {catalog.data?.length ?? 0}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Permission editor */}
          <div className="min-w-0">
            {!selected ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t("admin.access.pickStaff")}
              </p>
            ) : (
              <div className="grid gap-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selected.display_name || t("admin.users.noName")}
                      </p>
                      <p className="truncate text-desc text-muted-foreground">{selected.email}</p>
                      {selected.granted_at && (
                        <p className="mt-0.5 text-desc tabular-nums text-muted-foreground">
                          {t("admin.roles.grantedAt")}: {formatDateTime(selected.granted_at)}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="min-h-9">
                          {t("admin.roles.change")}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {selected.platform_role !== "platform_admin" && (
                          <DropdownMenuItem
                            onSelect={() =>
                              setRolePending({ row: selected, role: "platform_admin" })
                            }
                          >
                            {t("admin.roles.makeAdmin")}
                          </DropdownMenuItem>
                        )}
                        {selected.platform_role !== "system_owner" && (
                          <DropdownMenuItem
                            onSelect={() => setRolePending({ row: selected, role: "system_owner" })}
                          >
                            {t("admin.roles.makeOwner")}
                          </DropdownMenuItem>
                        )}
                        {selected.platform_role && (
                          <DropdownMenuItem
                            onSelect={() => setRolePending({ row: selected, role: null })}
                          >
                            {t("admin.roles.revoke")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {selected.platform_role === "system_owner" && (
                    <p className="mt-2 flex items-start gap-[var(--sp-2)] rounded-lg bg-secondary p-2 text-desc text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {t("admin.access.ownerNote")}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute inset-y-0 my-auto size-4 text-muted-foreground ltr:left-3 rtl:right-3"
                      aria-hidden
                    />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("admin.access.searchPerms")}
                      className="h-11 ltr:pl-9 rtl:pr-9"
                      aria-label={t("admin.access.searchPerms")}
                    />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-desc font-semibold tabular-nums text-foreground">
                    {t("admin.access.enabledCount")}: {draft.size}
                  </span>
                </div>

                {catalog.isLoading ? (
                  <Skeleton className="h-64 w-full rounded-xl" />
                ) : catalog.isError ? (
                  <p className="text-sm text-destructive">{t("admin.access.loadFailed")}</p>
                ) : visibleGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                ) : (
                  visibleGroups.map((group) => {
                    const open = !collapsed.has(group.module);
                    const enabled = group.rows.filter((row) => draft.has(row.perm_key)).length;
                    return (
                      <section
                        key={group.module}
                        className="overflow-hidden rounded-xl border border-border bg-card"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() =>
                              setCollapsed((prev) => {
                                const copy = new Set(prev);
                                if (copy.has(group.module)) copy.delete(group.module);
                                else copy.add(group.module);
                                return copy;
                              })
                            }
                            className="flex min-h-9 min-w-0 items-center gap-[var(--sp-2)] text-sm font-bold text-foreground"
                          >
                            <ChevronDown
                              className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                              aria-hidden
                            />
                            <span className="truncate">{t(`admin.access.module.${group.module}`)}</span>
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-desc tabular-nums text-muted-foreground">
                              {enabled} / {group.rows.length}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-[var(--sp-2)]">
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-9"
                              onClick={() => setGroup(group.rows, true)}
                            >
                              {t("admin.access.selectGroup")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-9"
                              onClick={() => setGroup(group.rows, false)}
                            >
                              {t("admin.access.clearGroup")}
                            </Button>
                          </div>
                        </div>

                        {open && (
                          <ul className="divide-y divide-border">
                            {group.rows.map((row) => (
                              <li
                                key={row.perm_key}
                                className="flex items-start justify-between gap-3 p-3"
                              >
                                <div className="min-w-0">
                                  <p className="flex flex-wrap items-center gap-[var(--sp-2)] text-sm font-semibold text-foreground">
                                    <span className="min-w-0 break-words">{label(row)}</span>
                                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-desc font-medium text-muted-foreground">
                                      {t(`admin.access.action.${row.action}`)}
                                    </span>
                                  </p>
                                  <p className="mt-0.5 text-desc text-muted-foreground">
                                    {description(row)}
                                  </p>
                                  <code className="mt-0.5 block truncate text-desc tabular-nums text-muted-foreground">
                                    {row.perm_key}
                                  </code>
                                </div>
                                <Switch
                                  className="mt-1 shrink-0"
                                  checked={draft.has(row.perm_key)}
                                  onCheckedChange={(next) => toggle(row.perm_key, next)}
                                  aria-label={label(row)}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })
                )}

                {/* Sticky save bar: unsaved changes are always visible. */}
                {dirty && (
                  <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary bg-card p-3 shadow-raised">
                    <p className="min-w-0 text-desc font-semibold text-foreground">
                      {t("admin.access.unsaved")} — +{added.length} / −{removed.length}
                    </p>
                    <div className="flex shrink-0 items-center gap-[var(--sp-2)]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-10"
                        onClick={() => setDraft(new Set(original))}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button size="sm" className="min-h-10" onClick={() => setConfirming(true)}>
                        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                        {t("common.save")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change summary + mandatory reason, before anything is written. */}
      <ReasonDialog
        open={confirming}
        title={t("admin.access.confirmTitle")}
        description={selected?.email ?? undefined}
        confirmLabel={t("common.save")}
        pending={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void savePerms(reason)}
      >
        <div className="max-h-56 overflow-y-auto rounded-lg bg-secondary p-3 text-desc">
          {added.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">
                {t("admin.access.willGrant")} ({added.length})
              </p>
              <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {added.map((key) => (
                  <li key={key}>+ {key}</li>
                ))}
              </ul>
            </div>
          )}
          {removed.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold text-foreground">
                {t("admin.access.willRevoke")} ({removed.length})
              </p>
              <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {removed.map((key) => (
                  <li key={key}>− {key}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ReasonDialog>

      <ReasonDialog
        open={!!rolePending}
        title={t("admin.roles.change")}
        description={rolePending?.row.email ?? undefined}
        confirmLabel={t("common.confirm")}
        destructive={rolePending?.role === null}
        pending={busy}
        onCancel={() => setRolePending(null)}
        onConfirm={(reason) => void saveRole(reason)}
      />
    </AdminShell>
  );
}
