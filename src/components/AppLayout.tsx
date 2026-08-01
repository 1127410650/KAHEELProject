import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FolderKanban,
  Wallet,
  FileBarChart,
  Trash2,
  ScrollText,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ShieldCheck,
  Languages,
  ClipboardList,
  Inbox,
  Truck,
  ReceiptText,
  PackageSearch,
  Bell,

} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ForcePasswordChangeDialog } from "@/components/ForcePasswordChangeDialog";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useAccounts, accountHome, type Account } from "@/hooks/use-accounts";


import type { Permission } from "@/lib/permissions";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  accountantOnly?: boolean;
  supervisorOnly?: boolean;
  perm?: Permission;
}

const groups: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "nav.sectionMain",
    items: [{ to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    titleKey: "nav.sectionOperations",
    items: [
      { to: "/supervisors", labelKey: "nav.supervisors", icon: Users, perm: "projects.view_all" },
      { to: "/projects", labelKey: "nav.projects", icon: FolderKanban },
      { to: "/custody", labelKey: "nav.custody", icon: Wallet, perm: "custody.execute_topup" },
      { to: "/requests", labelKey: "nav.requests", icon: ClipboardList },
      { to: "/suppliers", labelKey: "nav.suppliers", icon: Truck, perm: "projects.view_all" },
      { to: "/invoices", labelKey: "nav.invoices", icon: ReceiptText, perm: "projects.view_all" },
      { to: "/products", labelKey: "nav.products", icon: PackageSearch, perm: "products.view" },
      { to: "/reports", labelKey: "nav.reports", icon: FileBarChart, perm: "reports.view" },
    ],
  },
  {
    titleKey: "nav.sectionSystem",
    items: [
      { to: "/users", labelKey: "nav.users", icon: ShieldCheck, accountantOnly: true },
      { to: "/team", labelKey: "nav.team", icon: UserPlus, accountantOnly: true },

      { to: "/trash", labelKey: "nav.trash", icon: Trash2, accountantOnly: true },
      { to: "/audit", labelKey: "nav.audit", icon: ScrollText, accountantOnly: true },
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

/** Supervisors get a private, simplified sidebar — no admin dashboard or cross-supervisor data. */
const supervisorGroups: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "nav.sectionMain",
    items: [
      { to: "/portal", labelKey: "nav.home", icon: Inbox },
      { to: "/requests", labelKey: "nav.myRequests", icon: ClipboardList },
      { to: "/projects", labelKey: "nav.myProjects", icon: FolderKanban },
      { to: "/my-custody", labelKey: "nav.myCustody", icon: Wallet, perm: "custody.view_own" },
      { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
  {
    titleKey: "nav.sectionSystem",
    items: [{ to: "/settings", labelKey: "nav.mySettings", icon: Settings }],
  },
];

/** Personal (individual) account: only the user's own data — never company records. */
const personalGroups: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "nav.sectionMain",
    items: [
      { to: "/me", labelKey: "nav.home", icon: Inbox },
      { to: "/requests", labelKey: "nav.myRequests", icon: ClipboardList },
      { to: "/projects", labelKey: "nav.myProjects", icon: FolderKanban },
      { to: "/my-custody", labelKey: "nav.myCustody", icon: Wallet, perm: "custody.view_own" },
      { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
  {
    titleKey: "nav.sectionSystem",
    items: [{ to: "/settings", labelKey: "nav.mySettings", icon: Settings }],
  },
];



function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const { profile } = useSession();

  async function change(next: "ar" | "en") {
    if (next === locale) return;
    setLocale(next);
    if (profile) {
      await supabase.from("profiles").update({ locale: next }).eq("user_id", profile.user_id);
    }
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary p-0.5 md:gap-1 md:p-1",
        compact && "scale-95",
      )}
    >
      <Languages className="mx-1 hidden size-3.5 text-muted-foreground md:block" aria-hidden />
      <button
        type="button"
        onClick={() => change("ar")}
        className={cn(
          "rounded-full px-1.5 py-1 text-[11px] font-semibold leading-none transition-colors md:px-3 md:text-xs",
          locale === "ar"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="md:hidden">ع</span>
        <span className="hidden md:inline">العربية</span>
      </button>
      <button
        type="button"
        onClick={() => change("en")}
        className={cn(
          "rounded-full px-1.5 py-1 text-[11px] font-semibold leading-none transition-colors md:px-3 md:text-xs",
          locale === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="md:hidden">EN</span>
        <span className="hidden md:inline">English</span>
      </button>
    </div>
  );
}


function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const { isAccountant, isSupervisor, role, can } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: accounts = [] } = useAccounts();
  const isPersonal = accounts.some((a) => a.is_current && a.is_personal);
  const supervisorOnly = isSupervisor && !isAccountant && role !== "employee";
  const visibleGroups = isPersonal
    ? personalGroups
    : supervisorOnly
      ? supervisorGroups
      : groups;


  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {visibleGroups.map((group) => {
        const items = group.items.filter(
          (i) =>
            (!i.accountantOnly || isAccountant) &&
            (!i.supervisorOnly || isSupervisor) &&
            (!i.perm || can(i.perm)),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.titleKey}>
            {!collapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t(group.titleKey)}
              </p>
            )}
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="size-4.5 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <ShieldCheck className="size-5" aria-hidden />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-sidebar-foreground">
            {t("app.name")}
          </span>
          <span className="block truncate text-[11px] text-sidebar-foreground/60">Tahqaq</span>
        </span>
      )}
    </div>
  );
}

/** Company-only areas that must never render inside a personal account. */
const COMPANY_ONLY_PATHS = [
  "/dashboard",
  "/supervisors",
  "/custody",
  "/suppliers",
  "/invoices",
  "/users",
  "/team",
  "/audit",
  "/trash",
  "/reports",
  "/products",
  "/portal",
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, dir, locale } = useI18n();
  const { profile, role } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const { data: accounts = [], isSuccess: accountsLoaded } = useAccounts();
  const current = accounts.find((a: Account) => a.is_current) ?? null;
  const isPersonal = !!current?.is_personal;
  const onSelectPage = pathname === "/select-account";

  useEffect(() => {
    if (!accountsLoaded || onSelectPage) return;
    // No workspace at all → onboarding. No account chosen yet → account picker.
    if (accounts.length === 0) {
      if (pathname !== "/onboarding") navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (!current) {
      navigate({ to: "/select-account", replace: true });
      return;
    }
    if (isPersonal && COMPANY_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      navigate({ to: "/me", replace: true });
    }
  }, [accountsLoaded, accounts.length, current, isPersonal, pathname, onSelectPage, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success(t("auth.signedOut"));
    navigate({ to: "/auth", replace: true });
  }

  // The account picker is chrome-free: no sidebar and no tenant-scoped widgets.
  if (onSelectPage) {
    return (
      <div className="min-h-screen bg-background">
        <main className="page-safe">{children}</main>
        <ForcePasswordChangeDialog />
      </div>
    );
  }


  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <Brand collapsed={collapsed} />
        <NavLinks collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden />
                <span>{t("nav.collapse")}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[54px] items-center gap-1 border-b border-border bg-card/95 px-2 backdrop-blur md:h-auto md:gap-3 md:px-4 md:py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 md:hidden"
                aria-label={t("nav.expand")}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={dir === "rtl" ? "right" : "left"}
              className="flex w-72 flex-col bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">{t("app.name")}</SheetTitle>
              <Brand collapsed={false} />
              <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-3">
                <span className="text-[11px] font-semibold text-sidebar-foreground/60">
                  {t("common.language")}
                </span>
                <LanguageToggle />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground md:text-sm">
              {current
                ? (locale === "en" ? current.name_en || current.name_ar : current.name_ar)
                : t("app.name")}
            </p>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              {current ? t(`account.types.${current.tenant_type}`) : t("app.tagline")}
            </p>
          </div>

          {accounts.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/select-account" })}
              className="size-9 shrink-0 gap-2 p-0 sm:size-auto sm:px-3"
              aria-label={t("account.switch")}
              title={t("account.switch")}
            >
              <Repeat2 className="size-4" aria-hidden />
              <span className="hidden text-xs sm:inline">{t("account.switch")}</span>
            </Button>
          )}


          <NotificationsBell />

          <LanguageToggle />


          <div className="hidden text-end sm:block">
            <p className="max-w-[160px] truncate text-xs font-medium text-foreground">
              {profile?.full_name || profile?.email || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">{role ? t(`roles.${role}`) : "—"}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="size-9 shrink-0 gap-2 p-0 sm:size-auto sm:px-3"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("nav.signOut")}</span>
          </Button>
        </header>


        <main className="page-safe flex-1 overflow-x-hidden p-3 md:p-6">{children}</main>
        <ForcePasswordChangeDialog />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** rendered at the inline-start edge (right in RTL, left in LTR), own row on mobile */
  back?: ReactNode;
}) {
  return (
    <div className="page-safe mb-2.5 sm:mb-6">
      {back && <div className="mb-2 flex justify-start">{back}</div>}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="wrap-anywhere text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="wrap-anywhere mt-0.5 text-[11px] leading-snug text-muted-foreground sm:mt-1 sm:text-sm">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_[data-slot=button]]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

