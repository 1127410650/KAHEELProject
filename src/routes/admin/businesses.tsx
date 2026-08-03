import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, MoreHorizontal, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { AdminBusinessLink, AdminUserLink } from "@/components/marketplace/AdminEntityLink";
import { readAdminListState, useAdminListMemory } from "@/lib/use-admin-list-memory";
import { formatDate } from "@/lib/format";
import {
  addAdminNote,
  adminErrorMessage,
  loadAdminBusinesses,
  runSubjectAction,
  usePlatformIdentity,
  type AdminBusinessRow,
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

/** A click on a link, button or menu must not also trigger the row itself. */
function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest("a,button,input,select,textarea,[role='menuitem'],[data-no-row-open]")
  );
}


export const Route = createFileRoute("/admin/businesses")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المنشآت — إدارة المنصة" },
      {
        name: "description",
        content: "قائمة المنشآت وحالة التوثيق والأنشطة والمسؤول، مع إيقاف النشر أو رفعه بسبب مسجَّل.",
      },
      { property: "og:title", content: "إدارة المنشآت — إدارة المنصة" },
      { property: "og:description", content: "إدارة منشآت السوق في منصة تحقّق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBusinessesPage,
});

type PendingAction = { row: AdminBusinessRow; action: SubjectAction | "note" };

const ACTION_LABELS: Record<SubjectAction | "note", string> = {
  restrict: "admin.action.suspendPublishing",
  suspend: "admin.action.suspend",
  ban: "admin.action.ban",
  revoke_verification: "admin.action.revokeVerification",
  lift: "admin.action.lift",
  note: "admin.action.note",
};

function AdminBusinessesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { identity } = usePlatformIdentity();
  const remembered = readAdminListState("businesses", { term: "", search: "" });
  const [term, setTerm] = useState(remembered.term);
  const [search, setSearch] = useState(remembered.search);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const staffAccess = identity?.staff_perms.includes("verifications.review") === true;

  const businesses = useQuery({
    queryKey: ["mkt", "admin", "businesses", search],
    enabled: identity?.is_platform_admin === true || staffAccess,
    queryFn: () => loadAdminBusinesses(search),
  });

  useAdminListMemory("businesses", { term, search }, !businesses.isLoading);

  function openRow(event: React.MouseEvent, tenantId: string) {
    if (isInteractive(event.target)) return;
    void navigate({ to: "/admin/businesses/$id", params: { id: tenantId } });
  }


  async function confirm(reason: string) {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.action === "note") {
        await addAdminNote("business", pending.row.tenant_id, reason);
        toast.success(t("admin.noteSaved"));
      } else {
        await runSubjectAction({
          subjectType: "business",
          subjectId: pending.row.tenant_id,
          action: pending.action,
          reason,
        });
        toast.success(t("admin.actionDone"));
      }
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "businesses"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const rows = businesses.data ?? [];

  function ActionsMenu({ row }: { row: AdminBusinessRow }) {
    const actions: (SubjectAction | "note")[] = row.restriction
      ? ["lift", "note"]
      : ["restrict", "revoke_verification", "note"];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={t("common.actions")}>
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/admin/businesses/${row.tenant_id}`}>
              <FolderOpen className="size-4" aria-hidden />
              {t("admin.detail.businessFile")}
            </Link>
          </DropdownMenuItem>
          {row.slug && (
            <DropdownMenuItem asChild>
              <a href={`/businesses/${row.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                {t("admin.business.openPublic")}
              </a>
            </DropdownMenuItem>
          )}
          {actions.map((action) => (
            <DropdownMenuItem key={action} onSelect={() => setPending({ row, action })}>
              {t(ACTION_LABELS[action])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function Verification({ value }: { value: string | null }) {
    const status = value ?? "unverified";
    const tone =
      status === "verified"
        ? "bg-primary/10 text-primary"
        : status === "pending"
          ? "bg-amber-500/10 text-amber-600"
          : "bg-secondary text-muted-foreground";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
        {t(`admin.verification.${status}`)}
      </span>
    );
  }

  return (
    <AdminShell title={t("admin.nav.businesses")} staffAccess={staffAccess}>
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
            placeholder={t("admin.business.searchHint")}
            className="ps-9"
            aria-label={t("common.search")}
          />
        </div>
        <Button type="submit" variant="outline" className="min-h-11">
          {t("common.search")}
        </Button>
      </form>

      {businesses.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <>
          <div className="mt-4 hidden rounded-xl border border-border bg-card lg:block">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="w-[24%] px-3 py-2 text-start font-medium">{t("admin.business.name")}</th>
                  <th className="w-[16%] px-3 py-2 text-start font-medium">{t("admin.business.place")}</th>
                  <th className="w-[16%] px-3 py-2 text-start font-medium">{t("admin.business.activity")}</th>
                  <th className="w-[14%] px-3 py-2 text-start font-medium">{t("admin.business.officer")}</th>
                  <th className="w-[10%] px-3 py-2 text-start font-medium">{t("admin.business.listings")}</th>
                  <th className="w-[14%] px-3 py-2 text-start font-medium">{t("admin.business.verification")}</th>
                  <th className="w-[6%] px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.tenant_id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                    onClick={(event) => openRow(event, row.tenant_id)}
                  >
                    <td className="px-3 py-2">
                      <AdminBusinessLink id={row.tenant_id} name={row.name} truncate />
                      <span className="block truncate text-xs tabular-nums text-muted-foreground">
                        {formatDate(row.created_at)}
                      </span>
                    </td>
                    <td className="truncate px-3 py-2">
                      {[row.country, row.city].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="truncate px-3 py-2">{row.main_activity ?? "—"}</td>
                    <td className="px-3 py-2">
                      <AdminUserLink
                        id={row.officer_user_id}
                        name={row.officer_name}
                        truncate
                        className="text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.listings_count}</td>
                    <td className="px-3 py-2">
                      <Verification value={row.verification_status} />
                      {row.restriction && (
                        <span className="mt-1 block text-[11px] text-destructive">
                          {t(`admin.restriction.${row.restriction}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1 text-end">
                      <ActionsMenu row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 lg:hidden">
            {rows.map((row) => (
              <div
                key={row.tenant_id}
                className="rounded-xl border border-border bg-card p-3"
                onClick={(event) => openRow(event, row.tenant_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <AdminBusinessLink
                      id={row.tenant_id}
                      name={row.name}
                      truncate
                      className="min-h-11 py-2.5 text-sm font-semibold"
                    />
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.country, row.city].filter(Boolean).join(" · ")}
                    </p>
                    {row.officer_name && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {t("admin.business.officer")}:{" "}
                        <AdminUserLink
                          id={row.officer_user_id}
                          name={row.officer_name}
                          className="text-xs"
                        />
                      </p>
                    )}
                  </div>
                  <ActionsMenu row={row} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Verification value={row.verification_status} />
                  <span className="text-muted-foreground">
                    {t("admin.business.listings")}: <span className="tabular-nums">{row.listings_count}</span>
                  </span>
                  {row.restriction && (
                    <span className="text-destructive">{t(`admin.restriction.${row.restriction}`)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ReasonDialog
        open={!!pending}
        title={pending ? t(ACTION_LABELS[pending.action]) : ""}
        description={pending?.row.name ?? undefined}
        confirmLabel={t("common.confirm")}
        destructive={pending?.action === "restrict" || pending?.action === "revoke_verification"}
        pending={busy}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => void confirm(reason)}
      />
    </AdminShell>
  );
}
