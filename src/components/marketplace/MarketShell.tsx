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
import kaheelLogo from "@/assets/kaheel-logo.png";

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
        className="fixed inset-x-0 top-0 z-40 overflow-hidden border-b border-white/15 bg-[linear-gradient(112deg,#240046_0%,#3c096c_56%,#5a189a_118%)] text-white shadow-[0_7px_28px_rgb(36_0_70/0.22)] backdrop-blur-xl"
      >
        <div
          className={
            home
              ? "mx-auto grid min-h-[68px] w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-5 lg:px-8"
              : "mx-auto grid min-h-[62px] w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:min-h-[66px] sm:px-5 lg:px-8"
          }
        >
          {home ? (
            <>
              <a
                href="/search"
                className="flex min-w-0 items-center gap-2 justify-self-start rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
              >
                <MapPin className="size-6 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-black">{locationLabel}</strong>
                  <span className="block truncate text-[10px] text-[#e0aaff]">
                    {t("market.homeV2.locationNow")}
                  </span>
                </span>
              </a>
              <Link
                to="/"
                className="flex items-center gap-2 justify-self-center"
                aria-label={t("market.brand")}
              >
                <img
                  src={kaheelLogo}
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  className="size-9 shrink-0 rounded-xl bg-white p-0.5 shadow-[0_5px_16px_rgb(16_0_43/0.22)] sm:size-10"
                  aria-hidden
                />
                <span className="text-3xl font-black tracking-[-0.08em] text-white sm:text-4xl">
                  {t("market.brand")}
                </span>
              </Link>
              <a
                href={
                  session ? "/dashboard/notifications" : "/auth?next=%2Fdashboard%2Fnotifications"
                }
                className="relative grid size-11 justify-self-end place-items-center rounded-full outline-none transition hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-white"
                aria-label={t("market.bottomNav.alerts")}
              >
                <Bell className="size-6" aria-hidden />
                {(unreadAlerts.data ?? 0) > 0 && (
                  <span className="num absolute end-0 top-0 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-5 text-white">
                    {(unreadAlerts.data ?? 0) > 99 ? "99+" : unreadAlerts.data}
                  </span>
                )}
              </a>
            </>
          ) : (
            <>
              <Link
                to="/"
                className="flex shrink-0 items-center gap-1.5"
                aria-label={t("market.brand")}
              >
                <img
                  src={kaheelLogo}
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  className="size-7 shrink-0 rounded-lg bg-white p-0.5 sm:size-8"
                  aria-hidden
                />
                <span className="text-xl font-black leading-none tracking-[-0.06em] text-white sm:text-2xl">
                  {t("market.brand")}
                </span>
              </Link>
              <div
                className="flex min-w-0 items-center justify-center gap-1.5 px-1 text-[#e0aaff]"
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
                className="grid size-10 shrink-0 justify-self-end place-items-center rounded-full bg-market-gold text-[#240046] shadow-[0_8px_20px_rgb(16_0_43/0.3)] transition hover:-translate-y-0.5 hover:bg-[#f8b62d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3c096c] sm:size-11"
              >
                <Plus className="size-5" aria-hidden />
              </a>
            </>
          )}
        </div>
        {home && (
          <nav
            aria-label={t("market.nav.menu")}
            className="border-t border-white/12 bg-[#240046]/92"
          >
            <div className="mx-auto flex min-h-[46px] w-full max-w-[1240px] items-center gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:px-5 lg:px-8">
              {[
                [t("market.bottomNav.home"), "/"],
                [t("market.homeV2.fields.restaurants.title"), "/search?category=restaurants"],
                [t("market.homeV2.fields.groceries.title"), "/search?domain=product"],
                [t("market.homeV2.fields.realEstate.title"), "/search?category=real-estate"],
                [t("market.homeV2.fields.cars.title"), "/search?category=cars"],
                [t("market.homeV2.filters.services"), "/services"],
              ].map(([label, href], index) => (
                <a
                  key={href}
                  href={href}
                  className={
                    index === 0
                      ? "inline-flex min-h-9 shrink-0 items-center rounded-full bg-white px-4 text-[11px] font-black text-[#3c096c] outline-none focus-visible:ring-2 focus-visible:ring-[#e0aaff] sm:text-xs"
                      : "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[11px] font-bold text-white/84 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#e0aaff] sm:text-xs"
                  }
                >
                  {label}
                </a>
              ))}
              <a
                href={addHref}
                className="ms-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-market-gold px-4 text-[11px] font-black text-[#240046] shadow-sm outline-none transition hover:bg-[#f8b62d] focus-visible:ring-2 focus-visible:ring-white sm:text-xs"
              >
                <Plus className="size-4" aria-hidden />
                {t("market.addListing")}
              </a>
            </div>
          </nav>
        )}
        {showCategories && <MarketCategoryStrip />}
        {session && offline && (
          <div className="border-t border-white/14 bg-[#e0aaff] px-3 py-1 text-center text-[11px] font-medium text-[#240046] sm:text-xs">
            {t("market.offlineNotice")}
          </div>
        )}
      </header>
      <div
        aria-hidden
        className={
          home ? "h-[114px]" : showCategories ? "h-[9.4rem] sm:h-[10rem]" : "h-[62px] sm:h-[66px]"
        }
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#c77dff]/45 bg-white/96 pb-[env(safe-area-inset-bottom)] text-market-navy shadow-[0_-10px_28px_rgb(60_9_108/0.1)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch px-1">
        {rawItems.map((item) => {
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const destination =
            !session && ["messages", "alerts"].includes(item.key) ? signInHref(item.to) : item.to;
          const className = `flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-bold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-market-blue focus-visible:ring-offset-1 min-[360px]:text-[11px] ${
            active ? "text-market-blue" : "text-market-silver-muted hover:text-market-navy"
          }`;
          const inner = (
            <>
              <span
                className={
                  active
                    ? "grid h-8 w-12 place-items-center rounded-2xl bg-market-blue-soft text-market-blue"
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
  "/demo",
  "/syria-guide",
  "/student-tools",
  "/about",
  "/help",
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
          ? "market-surface market-shell flex min-h-dvh flex-col overflow-x-clip pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "market-surface market-shell flex min-h-dvh flex-col overflow-x-clip"
      }
    >
      <MarketHeader showCategories={showCategories} home={home} />
      <main className="flex-1">{children}</main>
      {variant === "compact" && <MarketCompactFooter />}
      {bottomNav && <MarketBottomNav />}
    </div>
  );
}
