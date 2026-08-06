import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserCog } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { formatDateTime } from "@/lib/format";
import {
  STAFF_PERMISSIONS,
  adminErrorMessage,
  loadAdminRoles,
  setPlatformRole,
  setStaffPermission,
  type AdminRoleRow,
  type PlatformRole,
} from "@/lib/mkt-platform";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/roles")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأدوار والصلاحيات — إدارة المنصة" },
      {
        name: "description",
        content: "منح دور مدير المنصة وسحبه وتحديد صلاحيات الطاقم لكل منسوب، مع تسجيل كل تغيير في سجل التدقيق.",
      },
      { property: "og:title", content: "الأدوار والصلاحيات — إدارة المنصة" },
      { property: "og:description", content: "إدارة أدوار وصلاحيات طاقم منصة كحلي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRolesPage,
});

type Pending =
  | { kind: "role"; row: AdminRoleRow; role: Exclude<PlatformRole, null> | null }
  | { kind: "perm"; row: AdminRoleRow; perm: string; granted: boolean };

function AdminRolesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const roles = useQuery({ queryKey: ["mkt", "admin", "roles"], queryFn: loadAdminRoles });
  const rows = roles.data ?? [];

  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "role") {
        await setPlatformRole(pending.row.user_id, pending.role, reason);
      } else {
        await setStaffPermission(pending.row.user_id, pending.perm, pending.granted, reason);
      }
      toast.success(t("admin.actionDone"));
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "roles"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title={t("admin.nav.roles")} systemOwnerOnly>
      <p className="text-xs text-muted-foreground">{t("admin.roles.hint")}</p>

      {roles.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {rows.map((row) => {
            const open = expanded === row.user_id;
            return (
              <div key={row.user_id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      {row.platform_role === "system_owner" ? (
                        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <UserCog className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      {row.display_name || t("admin.users.noName")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                    {row.granted_at && (
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {t("admin.roles.grantedAt")}: {formatDateTime(row.granted_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {row.platform_role
                        ? t(`admin.role.${row.platform_role === "system_owner" ? "systemOwner" : "platformAdmin"}`)
                        : t("admin.role.staff")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="min-h-9">
                          {t("admin.roles.change")}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.platform_role !== "platform_admin" && (
                          <DropdownMenuItem
                            onSelect={() => setPending({ kind: "role", row, role: "platform_admin" })}
                          >
                            {t("admin.roles.makeAdmin")}
                          </DropdownMenuItem>
                        )}
                        {row.platform_role !== "system_owner" && (
                          <DropdownMenuItem
                            onSelect={() => setPending({ kind: "role", row, role: "system_owner" })}
                          >
                            {t("admin.roles.makeOwner")}
                          </DropdownMenuItem>
                        )}
                        {row.platform_role && (
                          <DropdownMenuItem
                            onSelect={() => setPending({ kind: "role", row, role: null })}
                          >
                            {t("admin.roles.revoke")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9"
                      onClick={() => setExpanded(open ? null : row.user_id)}
                    >
                      {open ? t("admin.roles.hidePerms") : t("admin.roles.showPerms")}
                    </Button>
                  </div>
                </div>

                {open && (
                  <div className="mt-3 grid gap-1.5 border-t border-border pt-3 sm:grid-cols-2">
                    {STAFF_PERMISSIONS.map((perm) => {
                      const granted = row.staff_perms.includes(perm);
                      return (
                        <label
                          key={perm}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-background px-3 text-xs"
                        >
                          <span className="min-w-0 truncate text-foreground">{t(`admin.perm.${perm}`)}</span>
                          <Switch
                            checked={granted}
                            onCheckedChange={(next) =>
                              setPending({ kind: "perm", row, perm, granted: next })
                            }
                            aria-label={t(`admin.perm.${perm}`)}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReasonDialog
        open={!!pending}
        title={pending?.kind === "role" ? t("admin.roles.change") : t("admin.roles.permChange")}
        description={pending?.row.email ?? undefined}
        confirmLabel={t("common.confirm")}
        destructive={pending?.kind === "role" && pending.role === null}
        pending={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </AdminShell>
  );
}
