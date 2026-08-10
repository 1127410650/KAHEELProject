import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Coins,
  Clapperboard,
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  Gauge,
  Globe2,
  GraduationCap,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Images,
  LayoutTemplate,
  Smile,
  ShieldQuestion,
  Store,
  UserCog,
  UserRoundCheck,
  Users,
  Users2,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminSearchBox } from "@/components/marketplace/AdminSearchBox";
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

type NavSection =
  | "studio"
  | "content"
  | "campaigns"
  | "aqar"
  | "finance"
  | "guide"
  | "labels"
  | "settings";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof Gauge;
  section: NavSection;
  perms?: string[];
  ownerOnly?: boolean;
  anyStaff?: boolean;
}

const NAV: NavItem[] = [
  { to: "/admin", labelKey: "admin.nav.home", icon: Gauge, section: "studio" },
  {
    to: "/admin/dashboard",
    labelKey: "admin.nav.analytics",
    icon: BarChart3,
    section: "content",
  },
  { to: "/admin/search", labelKey: "admin.nav.search", icon: Search, section: "content" },
  {
    to: "/admin/my-work",
    labelKey: "admin.nav.myWork",
    icon: Briefcase,
    section: "content",
    anyStaff: true,
  },
  {
    to: "/admin/listings",
    labelKey: "admin.nav.listings",
    icon: Megaphone,
    section: "content",
  },
  {
    to: "/admin/listing-reports",
    labelKey: "admin.nav.listingReports",
    icon: Flag,
    section: "content",
    perms: ["reports.inbox_view", "ads.reports_view"],
  },
  {
    to: "/admin/listing-events",
    labelKey: "admin.nav.listingEvents",
    icon: ScrollText,
    section: "content",
    perms: ["reports.audit_view"],
  },
  {
    to: "/admin/stores",
    labelKey: "admin.nav.stores",
    icon: Store,
    section: "content",
  },
  {
    to: "/admin/errands",
    labelKey: "admin.nav.errands",
    icon: Store,
    section: "content",
  },
  {
    to: "/admin/guide-queue",
    labelKey: "admin.nav.guideQueue",
    icon: ShieldQuestion,
    section: "guide",
  },

  {
    to: "/admin/guide-requests",
    labelKey: "admin.nav.guideRequests",
    icon: ShieldQuestion,
    section: "guide",
  },
  {
    to: "/admin/guide-claims",
    labelKey: "admin.nav.guideClaims",
    icon: ShieldQuestion,
    section: "guide",
  },
  {
    to: "/admin/ad-credit",
    labelKey: "admin.nav.adCredit",
    icon: Coins,
    section: "finance",
  },
  {
    to: "/admin/campaigns",
    labelKey: "admin.nav.campaigns",
    icon: Clapperboard,
    section: "campaigns",
  },
  {
    to: "/admin/mascots",
    labelKey: "admin.nav.mascots",
    icon: Smile,
    section: "studio",
  },
  {
    to: "/admin/appearance",
    labelKey: "admin.nav.appearance",
    icon: Images,
    section: "studio",
  },
  {
    to: "/admin/composer",
    labelKey: "admin.nav.composer",
    icon: LayoutTemplate,
    section: "studio",
  },
  {
    to: "/admin/designs",
    labelKey: "admin.nav.designs",
    icon: LayoutTemplate,
    section: "studio",
  },
  {
    to: "/admin/pricing",
    labelKey: "admin.nav.pricing",
    icon: Coins,
    section: "finance",
    ownerOnly: true,
  },
  {
    to: "/admin/appearance/variants",
    labelKey: "admin.nav.pageVariants",
    icon: LayoutTemplate,
    section: "studio",
  },
  {
    to: "/admin/users",
    labelKey: "admin.nav.users",
    icon: Users,
    section: "settings",
    perms: ["accounts.restrict"],
  },
  {
    to: "/admin/businesses",
    labelKey: "admin.nav.businesses",
    icon: Building2,
    section: "settings",
    perms: ["verifications.review"],
  },
  {
    to: "/admin/verifications",
    labelKey: "admin.nav.verifications",
    icon: BadgeCheck,
    section: "settings",
    perms: ["verifications.review"],
  },
  {
    to: "/admin/applications",
    labelKey: "admin.nav.joinApplications",
    icon: UserRoundCheck,
    section: "settings",
    perms: ["verifications.review"],
  },
  {
    to: "/admin/reports",
    labelKey: "admin.nav.reports",
    icon: ClipboardList,
    section: "settings",
    perms: ["reports.inbox_view"],
  },
  {
    to: "/admin/staff/workload",
    labelKey: "admin.nav.workforce",
    icon: Users2,
    section: "settings",
    perms: ["workforce.manage"],
  },
  {
    to: "/admin/staff/attendance",
    labelKey: "admin.nav.attendance",
    icon: CalendarClock,
    section: "settings",
    perms: ["attendance.view", "attendance.manage", "attendance.approve"],
  },
  {
    to: "/admin/categories",
    labelKey: "admin.nav.categories",
    icon: ListChecks,
    section: "content",
  },
  {
    to: "/admin/labels",
    labelKey: "admin.nav.labels",
    icon: ListChecks,
    section: "labels",
  },
  {
    to: "/admin/taxonomy",
    labelKey: "admin.nav.activities",
    icon: ListChecks,
    section: "content",
  },
  { to: "/admin/locations", labelKey: "admin.nav.geo", icon: Globe2, section: "aqar" },
  {
    to: "/admin/roles",
    labelKey: "admin.nav.roles",
    icon: UserCog,
    section: "settings",
    ownerOnly: true,
  },
  {
    to: "/admin/audit-log",
    labelKey: "admin.nav.auditLog",
    icon: Activity,
    section: "settings",
    perms: ["reports.audit_view"],
  },
  {
    to: "/admin/moderation",
    labelKey: "admin.nav.contentRules",
    icon: ShieldAlert,
    section: "settings",
    ownerOnly: true,
  },
  {
    to: "/admin/student-bot",
    labelKey: "admin.nav.studentBot",
    icon: GraduationCap,
    section: "campaigns",
    ownerOnly: true,
  },
  {
    to: "/admin/settings",
    labelKey: "admin.nav.settings",
    icon: Settings,
    section: "settings",
    ownerOnly: true,
  },
];


const NAV_SECTIONS: NavSection[] = [
  "studio",
  "content",
  "campaigns",
  "aqar",
  "finance",
  "guide",
  "labels",
  "settings",
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
    .map((part) => part[0])
    .join("");
}

function AdminNavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { t, dir } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const Arrow = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <nav className="space-y-4 px-3 pb-6 pt-3">
      {NAV_SECTIONS.map((section) => {
        const rows = items.filter((item) => item.section === section);
        if (rows.length === 0) return null;

        return (
          <div key={section}>
            <p className="mb-[var(--sp-2)] px-3 text-desc font-bold tracking-[0.08em] text-muted-foreground/75">
              {t(`admin.navSections.${section}`)}
            </p>
            <div className="space-y-1">
              {rows.map((item) => {
                const active =
                  item.to === "/admin"
                    ? pathname === "/admin" || pathname === "/admin/"
                    : pathname.startsWith(item.to);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-desc font-semibold transition-all duration-200 " +
                      (active
                        ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(123,44,191,0.08)] dark:bg-primary/15 dark:text-primary"
                        : "text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm dark:hover:bg-accent")
                    }
                  >
                    <span
                      className={
                        "grid size-8 shrink-0 place-items-center rounded-lg transition-colors " +
                        (active
                          ? "bg-white text-primary shadow-sm dark:bg-background dark:text-primary"
                          : "bg-transparent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary dark:group-hover:bg-primary/10")
                      }
                    >
                      <Icon className="size-[17px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                    {active ? <Arrow className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function AdminSidebarBrand() {
  const { t } = useI18n();
  return (
    <div className="border-b border-primary/15 px-4 py-4 dark:border-border">
      <Link to="/admin" className="flex items-center gap-3 rounded-xl">
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--r-card)] bg-primary text-white shadow-[0_8px_24px_rgba(123,44,191,0.22)]">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-foreground">
            {t("admin.console")}
          </span>
          <span className="mt-0.5 block truncate text-desc font-medium text-muted-foreground">
            {t("admin.consoleSubtitle")}
          </span>
        </span>
      </Link>
    </div>
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
    {
      key: "admin.alerts.listingsPending",
      value: overview.data?.listings_pending ?? 0,
      to: "/admin/listings",
    },
    {
      key: "admin.alerts.reportsNew",
      value: overview.data?.reports_new ?? 0,
      to: "/admin/listing-reports",
    },
    {
      key: "admin.alerts.verifications",
      value: overview.data?.verifications_pending ?? 0,
      to: "/admin/verifications",
    },
    {
      key: "admin.alerts.activitySuggestions",
      value: overview.data?.activity_suggestions ?? 0,
      to: "/admin/taxonomy",
    },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 rounded-xl border border-transparent hover:border-primary/40 hover:bg-primary/10"
          aria-label={t("admin.alerts.title")}
        >
          <Bell className="size-[18px]" aria-hidden />
          {total > 0 ? (
            <span className="absolute -end-1 -top-1 min-w-[18px] rounded-full border-2 border-white bg-destructive px-1 text-desc font-black leading-[14px] text-destructive-foreground dark:border-card">
              {total > 99 ? "99+" : total}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(20rem,92vw)] rounded-[var(--r-card)] border-primary/15 p-2 shadow-xl"
      >
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-sm font-black text-foreground">{t("admin.alerts.title")}</p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-desc font-bold text-primary">
            {total}
          </span>
        </div>
        <div className="space-y-1">
          {rows.map((row) => (
            <Link
              key={row.key}
              to={row.to}
              className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm text-foreground hover:bg-primary/10"
            >
              <span className="truncate">{t(row.key)}</span>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-desc font-bold tabular-nums">
                {row.value}
              </span>
            </Link>
          ))}
        </div>
        {total === 0 ? (
          <p className="px-3 py-4 text-center text-desc text-muted-foreground">
            {t("admin.alerts.empty")}
          </p>
        ) : null}
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
  const centralSignOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const checking = loading || (!!session && (!identity || staffChecking));
  const admin = identity?.is_platform_admin === true && identity.restricted !== true;
  const owner = identity?.is_system_owner === true;
  const allowed =
    !!session && !checking && (systemOwnerOnly ? owner : admin || staffAccess === true);

  useEffect(() => {
    if (!checking && !allowed) clearAdminCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, allowed]);

  const items = identity ? visibleNav(identity) : [];
  const displayName = profile?.full_name?.trim() || t("admin.owner");

  async function signOut() {
    if (!window.confirm(t("market.account.signOutConfirm"))) return;
    clearAdminCache();
    await centralSignOut();
  }

  return (
    <div className="min-h-dvh bg-primary/5 text-foreground dark:bg-background">
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-white/95 backdrop-blur-xl dark:border-border dark:bg-card/95">
        <div className="flex min-h-[64px] w-full items-center gap-2 px-[var(--page-x)]">
          {allowed ? (
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 rounded-xl border border-primary/15 bg-white shadow-sm lg:hidden dark:border-border dark:bg-card"
                  aria-label={t("admin.menu")}
                >
                  <Menu className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[19rem] max-w-[88vw] overflow-hidden border-primary/15 bg-primary/5 p-0 dark:border-border dark:bg-background"
              >
                <SheetTitle className="sr-only">{t("admin.console")}</SheetTitle>
                <AdminSidebarBrand />
                <div className="h-[calc(100dvh-77px)] overflow-y-auto overscroll-contain">
                  <AdminNavList items={items} onNavigate={() => setDrawerOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          ) : null}

          <Link to="/admin" className="flex min-w-0 items-center gap-[var(--sp-3)] lg:hidden">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <ShieldCheck className="size-[17px]" aria-hidden />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-black">{t("admin.console")}</span>
              <span className="block truncate text-desc text-muted-foreground">
                {t("admin.consoleSubtitle")}
              </span>
            </span>
          </Link>

          {allowed ? <AdminSearchBox /> : <div className="min-w-0 flex-1" />}
          <div className="min-w-0 flex-1 sm:hidden" />

          {allowed ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl sm:hidden"
                aria-label={t("admin.nav.search")}
              >
                <Link to="/admin/search" search={{ q: "" }}>
                  <Search className="size-[18px]" aria-hidden />
                </Link>
              </Button>
              <AdminAlerts enabled={allowed} />
              <Button
                asChild
                variant="outline"
                size="sm"
                className="min-h-10 shrink-0 rounded-xl border-primary/40 bg-white px-3 text-primary shadow-sm hover:bg-primary/10 dark:border-border dark:bg-card dark:text-primary"
              >
                <a href="/?admin_preview=1">
                  <Store className="size-4" aria-hidden />
                  <span className="hidden md:inline">{t("admin.previewMarket")}</span>
                </a>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/40 bg-white shadow-sm transition hover:bg-primary/10 dark:border-border dark:bg-card"
                    aria-label={t("admin.account")}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-desc font-black text-primary dark:bg-primary/15 dark:text-primary">
                      {initials(displayName)}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-[var(--r-card)] border-primary/15 p-2 shadow-xl"
                >
                  <DropdownMenuLabel className="rounded-xl bg-primary/5 px-3 py-2 dark:bg-accent">
                    <span className="block truncate text-sm font-black">{displayName}</span>
                    <span className="mt-0.5 block text-desc font-medium text-muted-foreground">
                      {owner ? t("admin.role.systemOwner") : t("admin.role.platformAdmin")}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl">
                    <a href="/?admin_preview=1">{t("admin.previewMarket")}</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl">
                    <Link to="/choose-account">{t("admin.switchAccount")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-xl" onSelect={() => void signOut()}>
                    <LogOut className="size-4" aria-hidden />
                    {t("admin.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex w-full items-start">
        {allowed ? (
          <aside className="sticky top-[65px] hidden h-[calc(100dvh-65px)] w-[17rem] shrink-0 overflow-hidden border-e border-primary/15 bg-primary/5 lg:block dark:border-border dark:bg-card/40 xl:w-[18rem]">
            <AdminSidebarBrand />
            <div className="h-[calc(100%-77px)] overflow-y-auto overscroll-contain">
              <AdminNavList items={items} />
            </div>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1 px-3 pb-8 pt-4 sm:pt-5 lg:pb-10">
          <div className="mx-auto w-full max-w-[1500px]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-card)] border border-primary/15 bg-white px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-border dark:bg-card sm:py-4">
              <div className="min-w-0">
                <p className="text-desc font-bold text-primary dark:text-primary">
                  {t("admin.pageEyebrow")}
                </p>
                <h1 className="text-page mt-0.5 min-w-0 truncate font-black text-foreground">
                  {title}
                </h1>
              </div>
              {allowed && actions ? (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>

            {checking ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 w-full rounded-[var(--r-card)]" />
                ))}
              </div>
            ) : allowed ? (
              children
            ) : (
              <div className="rounded-[var(--r-card)] border border-primary/15 bg-white p-8 text-center shadow-sm dark:border-border dark:bg-card">
                <span className="mx-auto grid size-12 place-items-center rounded-[var(--r-card)] bg-secondary">
                  <ShieldAlert className="size-6 text-muted-foreground" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-black text-foreground">
                  {t("market.admin.denied")}
                </p>
                <p className="mt-1 text-desc text-muted-foreground">{t("market.admin.deniedHint")}</p>
                <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl">
                  <a href="/">{t("admin.backToMarket")}</a>
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
