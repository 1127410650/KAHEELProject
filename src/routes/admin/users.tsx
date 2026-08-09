import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminUserLink } from "@/components/marketplace/AdminEntityLink";
import { readAdminListState, useAdminListMemory } from "@/lib/use-admin-list-memory";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, MoreHorizontal, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { formatDate } from "@/lib/format";
import {
  addAdminNote,
  adminErrorMessage,
  loadAdminUsers,
  runSubjectAction,
  usePlatformIdentity,
  type AdminUserRow,
  type SubjectAction,
} from "@/lib/mkt-platform";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/users")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    restricted:
      search["restricted"] === true || search["restricted"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين — إدارة المنصة" },
      {
        name: "description",
        content: "بحث المستخدمين ومراجعة حالاتهم وتقييد أو إيقاف الحسابات بسبب مسجَّل في سجل التدقيق.",
      },
      { property: "og:title", content: "إدارة المستخدمين — إدارة المنصة" },
      { property: "og:description", content: "إدارة حسابات المستخدمين في منصة گحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsersPage,
});

type PendingAction = { row: AdminUserRow; action: SubjectAction | "note" };

const ACTION_LABELS: Record<SubjectAction | "note", string> = {
  restrict: "admin.action.restrict",
  suspend: "admin.action.suspend",
  ban: "admin.action.ban",
  revoke_verification: "admin.action.revokeVerification",
  lift: "admin.action.lift",
  note: "admin.action.note",
};

function RestrictionBadge({ value }: { value: string | null }) {
  const { t } = useI18n();
  if (!value)
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
        {t("admin.status.active")}
      </span>
    );
  return (
    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      {t(`admin.restriction.${value}`)}
    </span>
  );
}

function AdminUsersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { identity } = usePlatformIdentity();
  const navigate = useNavigate();
  const { restricted: restrictedOnly } = Route.useSearch();
  const initial = readAdminListState("users", { search: "" });
  const [term, setTerm] = useState(initial.search);
  const [search, setSearch] = useState(initial.search);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const staffAccess = identity?.staff_perms.includes("accounts.restrict") === true;

  const users = useQuery({
    queryKey: ["mkt", "admin", "users", search],
    enabled: identity?.is_platform_admin === true || staffAccess,
    queryFn: () => loadAdminUsers(search),
  });

  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.action === "note") {
        await addAdminNote("user", pending.row.user_id, reason);
        toast.success(t("admin.noteSaved"));
      } else {
        await runSubjectAction({
          subjectType: "user",
          subjectId: pending.row.user_id,
          action: pending.action,
          reason,
        });
        toast.success(t("admin.actionDone"));
      }
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "users"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const all = users.data ?? [];
  // A dashboard tile may deep-link to restricted accounts only.
  const rows = restrictedOnly ? all.filter((r) => !!r.restriction) : all;
  // Back from a user file returns to the same search and scroll offset.
  useAdminListMemory("users", { search }, !users.isLoading);

  /** Opens the administrative file; ignored when the click came from a control. */
  function openRow(event: React.MouseEvent, userId: string) {
    const target = event.target as HTMLElement;
    if (target.closest("a,button,[role='menu'],[role='menuitem'],input")) return;
    void navigate({ to: "/admin/users/$id", params: { id: userId } });
  }

  function ActionsMenu({ row }: { row: AdminUserRow }) {
    const actions: (SubjectAction | "note")[] = row.restriction
      ? ["lift", "ban", "note"]
      : ["restrict", "suspend", "ban", "note"];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={t("common.actions")}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/admin/users/$id" params={{ id: row.user_id }}>
              <FolderOpen className="size-4" aria-hidden />
              {t("admin.detail.userFile")}
            </Link>
          </DropdownMenuItem>
          {actions.map((action) => (
            <DropdownMenuItem key={action} onSelect={() => setPending({ row, action })}>
              {t(ACTION_LABELS[action])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <AdminShell title={t("admin.nav.users")} staffAccess={staffAccess}>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term);
        }}
      >
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("admin.users.searchHint")}
            className="ps-9"
            aria-label={t("common.search")}
          />
        </div>
        <Button type="submit" variant="outline" className="min-h-11">
          {t("common.search")}
        </Button>
      </form>

      {restrictedOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
            {t("admin.stats.restricted")}
          </span>
          <Link
            to="/admin/users"
            search={{ restricted: undefined }}
            className="min-h-11 py-2.5 text-primary underline-offset-4 hover:underline"
          >
            {t("market.filters.all")}
          </Link>
        </div>
      )}



      {users.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <>
          {/* Desktop: a table that fits the column widths, no horizontal drag. */}
          <div className="mt-4 hidden rounded-xl border border-border bg-card lg:block">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b border-border text-start text-xs text-muted-foreground">
                <tr>
                  <th className="w-[26%] px-3 py-2 text-start font-medium">{t("admin.users.user")}</th>
                  <th className="w-[16%] px-3 py-2 text-start font-medium">{t("admin.users.phone")}</th>
                  <th className="w-[13%] px-3 py-2 text-start font-medium">{t("admin.users.created")}</th>
                  <th className="w-[13%] px-3 py-2 text-start font-medium">{t("admin.users.lastSeen")}</th>
                  <th className="w-[9%] px-3 py-2 text-start font-medium">{t("admin.users.listings")}</th>
                  <th className="w-[9%] px-3 py-2 text-start font-medium">{t("admin.users.businesses")}</th>
                  <th className="w-[14%] px-3 py-2 text-start font-medium">{t("admin.users.status")}</th>
                  <th className="w-[6%] px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.user_id}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
                    onClick={(event) => openRow(event, row.user_id)}
                  >
                    <td className="px-3 py-2">
                      <AdminUserLink
                        id={row.user_id}
                        name={row.display_name}
                        fallback={t("admin.users.noName")}
                        truncate
                      />
                      <AdminUserLink
                        id={row.user_id}
                        className="block truncate text-xs font-normal text-muted-foreground"
                      >
                        <span dir="ltr">{row.email}</span>
                      </AdminUserLink>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.phone ? (
                        <AdminUserLink id={row.user_id} className="font-normal">
                          <span dir="ltr">{row.phone}</span>
                        </AdminUserLink>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.last_seen_at ? formatDate(row.last_seen_at) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.listings_count}</td>
                    <td className="px-3 py-2 tabular-nums">{row.businesses_count}</td>
                    <td className="px-3 py-2">
                      <RestrictionBadge value={row.restriction} />
                    </td>
                    <td className="px-1 py-1 text-end">
                      <ActionsMenu row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards, never a wide table. */}
          <div className="mt-4 grid gap-2 lg:hidden">
            {rows.map((row) => (
              <div key={row.user_id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <AdminUserLink
                      id={row.user_id}
                      name={row.display_name}
                      fallback={t("admin.users.noName")}
                      className="flex min-h-11 items-center text-sm font-semibold"
                      truncate
                    />
                    <AdminUserLink
                      id={row.user_id}
                      className="flex min-h-11 items-center truncate text-xs font-normal text-muted-foreground"
                    >
                      <span dir="ltr" className="truncate">
                        {row.email}
                      </span>
                    </AdminUserLink>
                    {row.phone ? (
                      <AdminUserLink
                        id={row.user_id}
                        className="flex min-h-11 items-center text-xs font-normal text-muted-foreground"
                      >
                        <span dir="ltr">{row.phone}</span>
                      </AdminUserLink>
                    ) : null}
                  </div>
                  <ActionsMenu row={row} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">{t("admin.users.created")}:</dt>
                    <dd className="tabular-nums text-foreground">{formatDate(row.created_at)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">{t("admin.users.listings")}:</dt>
                    <dd className="tabular-nums text-foreground">{row.listings_count}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">{t("admin.users.businesses")}:</dt>
                    <dd className="tabular-nums text-foreground">{row.businesses_count}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-muted-foreground">{t("admin.users.status")}:</dt>
                    <dd>
                      <RestrictionBadge value={row.restriction} />
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}

      <ReasonDialog
        open={!!pending}
        title={pending ? t(ACTION_LABELS[pending.action]) : ""}
        description={pending?.row.email ?? undefined}
        confirmLabel={t("common.confirm")}
        destructive={pending?.action === "ban" || pending?.action === "suspend"}
        pending={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </AdminShell>
  );
}
