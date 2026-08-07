import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Home, MapPin, MessageCircle, MoreHorizontal, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { addListingHref } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useMarketSetupStatus } from "@/lib/mkt-onboarding";
import { useActiveAccount } from "@/lib/mkt-account";
import { routeRuleFor } from "@/lib/routes-map";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";

export function MarketHeader({
  showCategories = false,
  home = false,
}: {
  showCategories?: boolean;
  home?: boolean;
}) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const offline = useOffline();
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const addHref = addListingHref({ authenticated: !!session });
  const locationLabel = account?.city?.trim() || (locale === "ar" ? "سوريا" : "Syria");
  const unreadAlerts = useQuery({
    queryKey: ["mkt", "unread-notifications", session?.user.id ?? null],
    enabled: !!session && home,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("mkt_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
  });

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className={
          home
            ? "fixed inset-x-0 top-0 z-40 bg-white/95 text-[#0b1d43] shadow-[0_3px_16px_rgb(11_29_67/0.06)] backdrop-blur-sm"
            : "fixed inset-x-0 top-0 z-40 overflow-hidden bg-[linear-gradient(110deg,#020e21_0%,#062344_52%,#03152d_100%)] text-market-navy-foreground shadow-[0_4px_14px_rgb(2_14_33/0.16)]"
        }
      >
        <div
          className={
            home
              ? "mx-auto grid min-h-[74px] w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-5 lg:px-8"
              : "mx-auto grid h-11 w-full max-w-[1240px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-12 sm:px-4 lg:px-6"
          }
        >
          {home ? (
            <>
              <a
                href="/search"
                className="flex min-w-0 items-center gap-2 justify-self-start rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#0b1d43]"
                aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
              >
                <MapPin className="size-6 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-black">{locationLabel}</strong>
                  <span className="block truncate text-[10px] text-[#6b7280]">
                    {t("market.homeV2.locationNow")}
                  </span>
                </span>
              </a>
              <Link to="/" className="justify-self-center" aria-label={t("market.brand")}>
                <span className="text-3xl font-black tracking-[-0.08em] text-[#0b1d43] sm:text-4xl">
                  {t("market.brand")}
                </span>
              </Link>
              <a
                href={
                  session ? "/dashboard/notifications" : "/auth?next=%2Fdashboard%2Fnotifications"
                }
                className="relative grid size-11 justify-self-end place-items-center rounded-full outline-none hover:bg-[#f2f5f9] focus-visible:ring-2 focus-visible:ring-[#0b1d43]"
                aria-label={t("market.bottomNav.alerts")}
              >
                <Bell className="size-6" aria-hidden />
                {(unreadAlerts.data ?? 0) > 0 && (
                  <span className="num absolute end-0 top-0 min-w-5 rounded-full bg-[#ef4444] px-1 text-center text-[10px] font-bold leading-5 text-white">
                    {(unreadAlerts.data ?? 0) > 99 ? "99+" : unreadAlerts.data}
                  </span>
                )}
              </a>
            </>
          ) : (
            <>
              <Link to="/" className="shrink-0" aria-label={t("market.brand")}>
                <span className="text-[15px] font-black leading-none tracking-tight text-market-navy-foreground sm:text-base">
                  {t("market.brand")}
                </span>
              </Link>
              <div
                className="flex min-w-0 items-center justify-center gap-1.5 px-1 text-market-silver"
                aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
              >
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="max-w-[12rem] truncate text-xs font-semibold sm:text-sm">
                  {locationLabel}
                </span>
              </div>
              <a
                href={addHref}
                aria-label={t("market.addListing")}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-market-navy-foreground text-market-navy shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-navy-foreground/80 sm:size-9"
              >
                <Plus className="size-5" aria-hidden />
              </a>
            </>
          )}
        </div>
        {showCategories && <MarketCategoryStrip />}
        {session && offline && (
          <div className="border-t border-market-navy-soft bg-market-navy-dark px-3 py-1 text-center text-[11px] font-medium text-market-silver sm:text-xs">
            {t("market.offlineNotice")}
          </div>
        )}
      </header>
      <div
        aria-hidden
        className={home ? "h-[74px]" : showCategories ? "h-32 sm:h-[8.625rem]" : "h-11 sm:h-12"}
        style={headerHeight > 0 ? { height: `${headerHeight}px` } : undefined}
      />
    </>
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
    if (!session || !status.data?.needsSetup || pathname.startsWith("/market-setup")) return;
    void navigate({ to: "/market-setup", replace: true });
  }, [session, status.data?.needsSetup, pathname, navigate]);
}

const BOTTOM_NAV_PATHS = {
  home: "/",
  messages: "/dashboard/messages",
  search: "/search",
  alerts: "/dashboard/notifications",
  more: "/more",
} as const;

if (import.meta.env.DEV)
  for (const path of Object.values(BOTTOM_NAV_PATHS))
    if (!routeRuleFor(path)) console.warn("[bottom nav] unregistered path", path);

function activeBottomKey(pathname: string): keyof typeof BOTTOM_NAV_PATHS {
  if (pathname.startsWith(BOTTOM_NAV_PATHS.messages)) return "messages";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.search)) return "search";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.alerts)) return "alerts";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.more)) return "more";
  return "home";
}

export function MarketBottomNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const signInHref = (next: string) => `/auth?next=${encodeURIComponent(next)}`;
  const rawItems = [
    { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home },
    { key: "messages", to: BOTTOM_NAV_PATHS.messages, icon: MessageCircle },
    { key: "search", to: BOTTOM_NAV_PATHS.search, icon: Search },
    { key: "alerts", to: BOTTOM_NAV_PATHS.alerts, icon: Bell },
    { key: "more", to: BOTTOM_NAV_PATHS.more, icon: MoreHorizontal },
  ] as const;
  const activeKey = activeBottomKey(pathname);

  return (
    <nav
      aria-label={t("market.nav.menu")}
      data-testid="mkt-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7eb] bg-white pb-[env(safe-area-inset-bottom)] text-[#0b1d43] lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch px-1">
        {rawItems.map((item) => {
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const destination =
            !session && ["messages", "alerts"].includes(item.key) ? signInHref(item.to) : item.to;
          const className = `flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-bold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0b1d43] focus-visible:ring-offset-1 min-[360px]:text-[11px] ${
            active ? "text-[#0b1d43]" : "text-[#718096] hover:text-[#0b1d43]"
          }`;
          const inner = (
            <>
              <span
                className={
                  active
                    ? "grid h-8 w-12 place-items-center rounded-2xl bg-[#e9eef7] text-[#0b1d43]"
                    : "grid h-8 w-12 place-items-center rounded-2xl"
                }
              >
                <item.icon className="size-[21px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
              </span>
              <span className="max-w-full truncate">{label}</span>
            </>
          );
          return (
            <li key={item.key} className="min-w-0 flex-1">
              {destination.startsWith("/auth") ? (
                <a
                  href={destination}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  to={destination}
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
  if (NO_FOOTER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)))
    return "none";
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
  const home = pathname === "/";
  const showCategories = pathname === "/search";
  return (
    <div
      dir={dir}
      className={
        bottomNav
          ? "market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "market-surface flex min-h-dvh flex-col overflow-x-clip"
      }
    >
      <MarketHeader showCategories={showCategories} home={home} />
      <main className="flex-1">{children}</main>
      {variant === "compact" && <MarketCompactFooter />}
      {bottomNav && <MarketBottomNav />}
    </div>
  );
}
