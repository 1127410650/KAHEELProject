import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  ClipboardList,
  Flag,
  Gauge,
  Globe2,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users2,
  Briefcase,
  CalendarClock,
  UserCog,
  Users,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminSearchBox } from "@/components/marketplace/AdminSearchBox";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSignOut } from "@/lib/auth-signout";
import {
  loadAdminOverview,
  usePlatformIdentity,
  useClearAdminCache,
  type PlatformIdentity,
} from "@/lib/mkt-platform";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The system-owner console shell.
 *
 * Deliberately NOT the marketplace shell: no marketplace bottom bar, no
 * marketing footer, no "add listing" call to action and no business identity —
 * an administrator is a platform actor, not a seller. Only two links leave the
 * console: "preview the marketplace" and sign-out.
 *
 * Access is decided by `mkt_my_platform_role()` on the server. `staffAccess`
 * lets a page open the gate for a limited administrator holding one specific
 * permission; `systemOwnerOnly` closes it again for owner-only surfaces.
 */
interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof Gauge;
  /** Visible to a limited administrator holding any of these staff perms. */
  perms?: string[];
  ownerOnly?: boolean;
  /** Visible to every administrator, including a limited one with no perms. */
  anyStaff?: boolean;
}

const NAV: NavItem[] = [
  { to: "/admin", labelKey: "admin.nav.home", icon: Gauge },
  { to: "/admin/dashboard", labelKey: "admin.nav.analytics", icon: BarChart3 },
  { to: "/admin/search", labelKey: "admin.nav.search", icon: Search },
  { to: "/admin/my-work", labelKey: "admin.nav.myWork", icon: Briefcase, anyStaff: true },
  { to: "/admin/listings", labelKey: "admin.nav.listings", icon: Megaphone },

  {
    to: "/admin/listing-reports",
    labelKey: "admin.nav.listingReports",
    icon: Flag,
    perms: ["reports.inbox_view", "ads.reports_view"],
  },
  {
    to: "/admin/listing-events",
    labelKey: "admin.nav.listingEvents",
    icon: ScrollText,
    perms: ["reports.audit_view"],
  },
  { to: "/admin/users", labelKey: "admin.nav.users", icon: Users, perms: ["accounts.restrict"] },
  {
    to: "/admin/businesses",
    labelKey: "admin.nav.businesses",
    icon: Building2,
    perms: ["verifications.review"],
  },
  {
    to: "/admin/verifications",
    labelKey: "admin.nav.verifications",
    icon: BadgeCheck,
    perms: ["verifications.review"],
  },
  {
    to: "/admin/reports",
    labelKey: "admin.nav.reports",
    icon: ClipboardList,
    perms: ["reports.inbox_view"],
  },
  {
    to: "/admin/workforce",
    labelKey: "admin.nav.workforce",
    icon: Users2,
    perms: ["workforce.manage"],
  },
  {
    to: "/admin/attendance",
    labelKey: "admin.nav.attendance",
    icon: CalendarClock,
    perms: ["attendance.view", "attendance.manage", "attendance.approve"],
  },
  { to: "/admin/stores", labelKey: "admin.nav.stores", icon: Store },
  { to: "/admin/activities", labelKey: "admin.nav.activities", icon: ListChecks },
  { to: "/admin/geo", labelKey: "admin.nav.geo", icon: Globe2 },
  { to: "/admin/roles", labelKey: "admin.nav.roles", icon: UserCog, ownerOnly: true },
  {
    to: "/admin/audit-log",
    labelKey: "admin.nav.auditLog",
    icon: Activity,
    perms: ["reports.audit_view"],
  },
  {
    to: "/admin/content-rules",
    labelKey: "admin.nav.contentRules",
    icon: ShieldAlert,
    ownerOnly: true,
  },
  { to: "/admin/settings", labelKey: "admin.nav.settings", icon: Settings, ownerOnly: true },
];

function visibleNav(identity: PlatformIdentity): NavItem[] {
  if (identity.is_system_owner) return NAV;
  if (identity.is_platform_admin) return NAV.filter((item) => !item.ownerOnly);
  return NAV.filter(
    (item) =>
      !item.ownerOnly &&
      (item.anyStaff === true ||
        item.perms?.some((perm) => identity.staff_perms.includes(perm)) === true),
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

function AdminNavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((item) => {
        const active =
          item.to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={
              "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors " +
              (active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Grouped admin alerts: counts only, never a name or a document. */
function AdminAlerts({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const overview = useQuery({
    queryKey: ["mkt", "admin", "overview", "alerts"],
    enabled,
    refetchInterval: 120_000,
    queryFn: loadAdminOverview,
  });
  const rows = [
    { key: "admin.alerts.listingsPending", value: overview.data?.listings_pending ?? 0, to: "/admin/listings" },
    { key: "admin.alerts.reportsNew", value: overview.data?.reports_new ?? 0, to: "/admin/listing-reports" },
    {
      key: "admin.alerts.verifications",
      value: overview.data?.verifications_pending ?? 0,
      to: "/admin/verifications",
    },
    {
      key: "admin.alerts.activitySuggestions",
      value: overview.data?.activity_suggestions ?? 0,
      to: "/admin/activities",
    },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-11" aria-label={t("admin.alerts.title")}>
          <Bell className="size-4" aria-hidden />
          {total > 0 && (
            <span className="absolute end-1.5 top-1.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t("admin.alerts.title")}</p>
        {rows.map((row) => (
          <Link
            key={row.key}
            to={row.to}
            className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-sm text-foreground hover:bg-accent"
          >
            <span className="truncate">{t(row.key)}</span>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums">
              {row.value}
            </span>
          </Link>
        ))}
        {total === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">{t("admin.alerts.empty")}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AdminShell({
  title,
  children,
  staffAccess,
  staffChecking = false,
  systemOwnerOnly = false,
  actions,
}: {
  title: string;
  children: ReactNode;
  staffAccess?: boolean | undefined;
  staffChecking?: boolean;
  systemOwnerOnly?: boolean;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const { session, profile } = useSession();
  const { identity, loading } = usePlatformIdentity();
  const clearAdminCache = useClearAdminCache();
  const navigate = useNavigate();
  const centralSignOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const checking = loading || (!!session && (!identity || staffChecking));
  const admin = identity?.is_platform_admin === true && identity.restricted !== true;
  const owner = identity?.is_system_owner === true;
  const allowed = !!session && !checking && (systemOwnerOnly ? owner : admin || staffAccess === true);

  // A role revoked mid-session must not leave stale admin answers behind.
  useEffect(() => {
    if (!checking && !allowed) clearAdminCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, allowed]);

  const items = identity ? visibleNav(identity) : [];
  const displayName = profile?.full_name?.trim() || t("admin.owner");

  async function signOut() {
    clearAdminCache();
    await centralSignOut();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex w-full items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4">
          {allowed && (
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 lg:hidden"
                  aria-label={t("admin.menu")}
                >
                  <Menu className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[17rem] max-w-[85vw] p-0">
                <SheetTitle className="border-b border-border px-4 py-3 text-sm font-bold">
                  {t("admin.console")}
                </SheetTitle>
                <div className="overflow-y-auto pb-6">
                  <AdminNavList items={items} onNavigate={() => setDrawerOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          )}

          <Link to="/admin" className="flex min-h-11 min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-foreground">
                {t("admin.console")}
              </span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {t("market.brand")}
              </span>
            </span>
          </Link>

          {allowed ? <AdminSearchBox /> : <div className="min-w-0 flex-1" />}
          <div className="min-w-0 flex-1 sm:hidden" />

          {allowed && (
            <>
              <AdminAlerts enabled={allowed} />
              <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0">

                {/* Full page load: the marketplace opens in its own shell and the
                    admin session (and active account) stays untouched. */}
                <a href="/?admin_preview=1">
                  <Store className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{t("admin.previewMarket")}</span>
                </a>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-full"
                    aria-label={t("admin.account")}
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">
                      {initials(displayName)}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="truncate">
                    {displayName}
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                      {owner ? t("admin.role.systemOwner") : t("admin.role.platformAdmin")}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/?admin_preview=1">{t("admin.previewMarket")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/choose-account">{t("admin.switchAccount")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut className="size-4" aria-hidden />
                    {t("admin.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      <div className="flex w-full flex-1 items-start">
        {allowed && (
          <aside className="sticky top-[3.4rem] hidden h-[calc(100dvh-3.4rem)] w-60 shrink-0 overflow-y-auto border-e border-border bg-card lg:block xl:w-64">
            <AdminNavList items={items} />
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="min-w-0 text-lg font-bold text-foreground sm:text-2xl">{title}</h1>
              {allowed && actions}
            </div>

            <div className="mt-5">
              {checking ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : allowed ? (
                children
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <ShieldAlert className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <p className="mt-2 text-sm font-medium text-foreground">{t("market.admin.denied")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("market.admin.deniedHint")}</p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <a href="/">{t("admin.backToMarket")}</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
