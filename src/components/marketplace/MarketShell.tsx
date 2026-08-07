import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Grid2x2, Home, MessageSquare, Plus, Search, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { addListingHref } from "@/lib/add-listing";
import { getSearchHref } from "@/lib/search-href";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useMarketSetupStatus } from "@/lib/mkt-onboarding";
import { useActiveAccount } from "@/lib/mkt-account";
import { usePlatformIdentity } from "@/lib/mkt-platform";
import { routeRuleFor } from "@/lib/routes-map";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MktNotificationsBell } from "@/components/marketplace/MktNotificationsBell";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";

/**
 * The single header for every marketplace surface (public pages, account pages
 * via DashboardShell, and the back office via AdminShell). Element order is
 * identical on desktop and mobile; only visibility differs by session state.
 * On the public home route, the category row is rendered inside this same sticky
 * header so both rows are one literal navy block with no gap or independent
 * scrolling position.
 */
export function MarketHeader({ showCategories = false }: { showCategories?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const { session, status } = useSession();
  const { identity: adminIdentity } = usePlatformIdentity();
  const offline = useOffline();
  const addHref = addListingHref({ authenticated: !!session });
  const storeHref = session ? "/dashboard/store" : "/auth?next=%2Fdashboard%2Fstore";

  return (
    <header className="sticky top-0 z-40 overflow-hidden bg-market-navy text-market-navy-foreground shadow-sm">
      <div className="mx-auto flex min-h-14 w-full max-w-[1240px] items-center gap-1 px-3 py-2 sm:gap-2 sm:px-4 lg:px-6">
        <Link to="/" className="shrink-0 px-0.5" aria-label={t("market.brand")}>
          <span className="text-sm font-bold tracking-tight text-market-navy-foreground sm:text-base">
            {t("market.brand")}
          </span>
        </Link>

        {status === "loading" ? (
          <div className="flex shrink-0 items-center gap-1">
            <Skeleton aria-hidden className="h-9 w-20 rounded-full sm:h-10 sm:w-28" />
            <Skeleton aria-hidden className="h-9 w-20 rounded-full sm:h-10 sm:w-28" />
          </div>
        ) : (
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
            <a
              href={addHref}
              aria-label={t("market.addListing")}
              title={t("market.addListing")}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-market-navy-foreground px-2 text-[10px] font-bold text-market-navy transition-colors hover:bg-market-silver min-[390px]:px-2.5 min-[390px]:text-[11px] sm:h-10 sm:gap-1.5 sm:px-3.5 sm:text-xs"
            >
              <Plus className="size-3.5 shrink-0 sm:size-4" aria-hidden />
              <span className="hidden min-[350px]:inline">{t("market.addListing")}</span>
              <span className="min-[350px]:hidden">إعلان</span>
            </a>

            <a
              href={storeHref}
              aria-label={t("market.createStore")}
              title={t("market.createStore")}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-market-silver/75 bg-market-navy-soft/45 px-2 text-[10px] font-bold text-market-navy-foreground transition-colors hover:bg-market-navy-soft min-[390px]:px-2.5 min-[390px]:text-[11px] sm:h-10 sm:gap-1.5 sm:px-3.5 sm:text-xs"
            >
              <Store className="size-3.5 shrink-0 sm:size-4" aria-hidden />
              <span className="hidden min-[350px]:inline">{t("market.createStore")}</span>
              <span className="min-[350px]:hidden">متجر</span>
            </a>
          </div>
        )}

        {!showCategories && (
          <Link
            to={getSearchHref()}
            aria-label={t("market.nav.search")}
            title={t("market.nav.search")}
            data-testid="mkt-header-search"
            className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-market-navy-soft bg-market-navy-soft/60 text-market-navy-foreground transition-colors hover:bg-market-navy-soft lg:inline-flex xl:w-auto xl:gap-1.5 xl:px-3 xl:text-sm"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden xl:inline">{t("market.nav.search")}</span>
          </Link>
        )}

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            aria-label={t("common.language")}
            className="hidden rounded-md border border-market-navy-soft px-2 py-1 text-xs font-semibold text-market-silver hover:bg-market-navy-soft md:block"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>

          {session ? (
            <>
              {adminIdentity?.is_platform_admin === true && adminIdentity.restricted !== true && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="hidden shrink-0 lg:inline-flex"
                >
                  <Link
                    to="/admin"
                    aria-label={t("admin.backToAdmin")}
                    title={t("admin.backToAdmin")}
                  >
                    <ShieldCheck className="size-4" aria-hidden />
                    <span className="hidden xl:inline">{t("admin.backToAdmin")}</span>
                  </Link>
                </Button>
              )}
              <MktNotificationsBell />
            </>
          ) : status === "loading" ? (
            <Skeleton aria-hidden className="h-8 w-16 shrink-0 rounded-md sm:w-28" />
          ) : (
            <>
              <Link
                to="/auth"
                aria-label={t("market.signIn")}
                title={t("market.signIn")}
                className="hidden h-8 shrink-0 items-center rounded-md border border-market-silver/70 px-2 text-[10px] font-semibold text-market-navy-foreground transition-colors hover:bg-market-navy-soft min-[390px]:inline-flex sm:px-3 sm:text-xs"
              >
                {t("market.signIn")}
              </Link>
              <Link
                to="/register"
                aria-label={t("market.signUp")}
                title={t("market.signUp")}
                className="hidden h-8 shrink-0 items-center rounded-md bg-market-silver px-2 text-[10px] font-semibold text-market-navy transition-colors hover:bg-market-navy-foreground sm:inline-flex sm:px-3 sm:text-xs"
              >
                {t("market.signUp")}
              </Link>
            </>
          )}
        </div>
      </div>

      {showCategories && <MarketCategoryStrip />}

      {session && offline && (
        <div className="border-t border-market-navy-soft bg-market-navy-dark px-3 py-1 text-center text-[11px] font-medium text-market-silver sm:text-xs">
          {t("market.offlineNotice")}
        </div>
      )}
    </header>
  );
}

function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return offline;
}

function useMarketSetupGate() {
  const { session } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const status = useMarketSetupStatus();

  useEffect(() => {
    if (!session || !status.data?.needsSetup) return;
    if (pathname.startsWith("/market-setup")) return;
    void navigate({ to: "/market-setup", replace: true });
  }, [session, status.data?.needsSetup, pathname, navigate]);
}

const BOTTOM_NAV_PATHS = {
  home: "/",
  messages: "/dashboard/messages",
  alerts: "/dashboard/notifications",
  more: "/more",
} as const;

if (import.meta.env.DEV) {
  for (const path of Object.values(BOTTOM_NAV_PATHS)) {
    if (!routeRuleFor(path)) console.warn("[bottom nav] unregistered path", path);
  }
}

function activeBottomKey(pathname: string): keyof typeof BOTTOM_NAV_PATHS {
  if (pathname.startsWith(BOTTOM_NAV_PATHS.messages)) return "messages";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.alerts)) return "alerts";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.more)) return "more";
  return "home";
}

export function MarketBottomNav() {
  const { t, locale } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const { account } = useActiveAccount();

  const unreadMessages = useQuery({
    queryKey: ["mkt", "unread-messages", account?.account_key ?? null],
    enabled: !!session && !!account,
    refetchInterval: 60_000,
    queryFn: async () => {
      let convQuery = supabase.from("mkt_conversations").select("id");
      convQuery =
        account!.kind === "business"
          ? convQuery.eq("seller_tenant_id", account!.tenant_id!)
          : convQuery.or(
              `buyer_user_id.eq.${session!.user.id},and(seller_user_id.eq.${session!.user.id},seller_tenant_id.is.null)`,
            );
      const { data: convs } = await convQuery;
      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from("mkt_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", ids)
        .is("read_at", null)
        .neq("sender_user_id", session!.user.id);
      return count ?? 0;
    },
  });

  const unreadAlerts = useQuery({
    queryKey: ["mkt", "unread-notifications", session?.user.id ?? null],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("mkt_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
  });

  const signInHref = (next: string) => `/auth?next=${encodeURIComponent(next)}`;

  const items = session
    ? ([
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home, badge: 0 },
        {
          key: "messages",
          to: BOTTOM_NAV_PATHS.messages,
          icon: MessageSquare,
          badge: unreadMessages.data ?? 0,
        },
        {
          key: "alerts",
          to: BOTTOM_NAV_PATHS.alerts,
          icon: Bell,
          badge: unreadAlerts.data ?? 0,
        },
        { key: "more", to: BOTTOM_NAV_PATHS.more, icon: Grid2x2, badge: 0 },
      ] as const)
    : ([
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home, badge: 0 },
        {
          key: "messages",
          to: signInHref(BOTTOM_NAV_PATHS.messages),
          icon: MessageSquare,
          badge: 0,
        },
        { key: "alerts", to: signInHref(BOTTOM_NAV_PATHS.alerts), icon: Bell, badge: 0 },
        { key: "more", to: BOTTOM_NAV_PATHS.more, icon: Grid2x2, badge: 0 },
      ] as const);

  const activeKey = activeBottomKey(pathname);

  return (
    <nav
      aria-label={t("market.nav.menu")}
      data-testid="mkt-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-market-navy-soft bg-market-navy pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const inner = (
            <>
              <span
                className={
                  active
                    ? "relative grid size-8 place-items-center text-market-navy-foreground"
                    : "relative grid size-8 place-items-center text-market-silver-muted"
                }
              >
                {item.key === "more" ? (
                  <span
                    className="whitespace-nowrap text-[10px] font-black leading-none tracking-tight min-[360px]:text-[11px]"
                    aria-hidden
                  >
                    {locale === "ar" ? "كحيلي" : "Kaheeli"}
                  </span>
                ) : (
                  <item.icon className="size-4" aria-hidden />
                )}
                {item.badge > 0 && (
                  <span
                    data-testid={`mkt-bottom-badge-${item.key}`}
                    className="num absolute -top-0.5 end-0 min-w-4 rounded-full bg-destructive px-1 text-[9px] font-semibold leading-4 text-destructive-foreground"
                    dir="ltr"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span
                className={
                  active
                    ? "truncate text-market-navy-foreground"
                    : "truncate text-market-silver-muted"
                }
              >
                {label}
              </span>
            </>
          );
          const className =
            "flex min-h-14 min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-medium min-[360px]:text-[10px]";

          return (
            <li key={item.key} className="min-w-0 flex-1">
              {item.to.startsWith("/auth") ? (
                <a
                  href={item.to}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  to={item.to}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MarketCompactFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-8 border-t border-border">
      <p className="mx-auto w-full max-w-[1240px] px-4 py-4 text-center text-xs text-muted-foreground lg:px-6">
        {t("market.footer.rights")}
      </p>
    </footer>
  );
}

export type FooterVariant = "compact" | "none";

const COPYRIGHT_FOOTER_PATHS = [
  "/",
  "/search",
  "/syria-guide",
  "/student-tools",
  "/about",
  "/terms",
  "/privacy",
  "/help",
  "/contact",
];
const COPYRIGHT_FOOTER_PREFIXES = [
  "/ads/",
  "/businesses/",
  "/u/",
  "/categories/",
  "/stores/",
  "/demo-stores/",
];
const NO_FOOTER_PREFIXES = [
  "/admin",
  "/dashboard",
  "/chat",
  "/more",
  "/auth",
  "/register",
  "/welcome",
];

export function footerVariantForPath(pathname: string): FooterVariant {
  if (
    NO_FOOTER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return "none";
  }
  if (COPYRIGHT_FOOTER_PATHS.includes(pathname)) return "compact";
  if (COPYRIGHT_FOOTER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "compact";
  return "none";
}

export function MarketShell({
  children,
  footer,
  bottomNav = true,
}: {
  children: React.ReactNode;
  footer?: FooterVariant;
  bottomNav?: boolean;
}) {
  const { dir } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useMarketSetupGate();
  const variant = footer ?? footerVariantForPath(pathname);
  const showCategories = pathname === "/" || pathname === "/search";

  return (
    <div
      dir={dir}
      className={
        bottomNav
          ? "market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "market-surface flex min-h-dvh flex-col overflow-x-clip"
      }
    >
      <MarketHeader showCategories={showCategories} />
      <main className="flex-1">{children}</main>
      {variant === "compact" && <MarketCompactFooter />}
      {bottomNav && <MarketBottomNav />}
    </div>
  );
}
