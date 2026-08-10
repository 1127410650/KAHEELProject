import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ClipboardList,
  Home,
  LogIn,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  
  Tag,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { addListingHref } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useMarketSetupStatus } from "@/lib/mkt-onboarding";
import { routeRuleFor } from "@/lib/routes-map";
import { useNearbyOrigin } from "@/lib/mkt-nearby";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";

import { AddListingButton } from "@/components/marketplace/AddListingButton";



import { LocationSheet } from "@/components/marketplace/LocationSheet";

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
  const offline = useOffline();
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  /**
   * الهيدر المتكيّف (الرئيسية فقط): ينكمش تدريجيًا مع التمرير لأسفل حتى يبقى
   * شريط رفيع فيه حقل البحث، ويعود كاملًا عند السحب لأعلى. الارتفاع المحجوز
   * أسفله يبقى ارتفاع الحالة الكاملة، فلا هزّة تخطيط عند الانكماش.
   */
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  const [locationOpen, setLocationOpenState] = useState(false);

  const [locationMounted, setLocationMounted] = useState(false);
  const setLocationOpen = (value: boolean) => {
    if (value) setLocationMounted(true);
    setLocationOpenState(value);
  };
  const addHref = addListingHref({ authenticated: !!session });
  // الموقع الحقيقي للمستخدم مختصرًا («دمشق · المزة»)، وإلا دعوة صريحة لتحديده.
  const { shortLabel } = useNearbyOrigin();
  const locationLabel = shortLabel ?? t("market.geo.setLocation");
  const locationKnown = !!shortLabel;


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
    const measure = () => {
      // القياس في الحالة الكاملة فقط: المساحة المحجوزة أدناه لا تتقلّص أبدًا.
      if (collapsedRef.current) return;
      setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!home) return;
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const goingDown = y > last + 4;
        const goingUp = y < last - 4;
        last = y;
        const next = y < 96 ? false : goingDown ? true : goingUp ? false : collapsedRef.current;
        if (next !== collapsedRef.current) {
          collapsedRef.current = next;
          setCollapsed(next);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [home]);

  const shrunk = home && collapsed;

  return (
    <>
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 overflow-hidden border-b border-border bg-background/95 text-foreground shadow-[0_1px_0_rgb(17_17_17/0.04)] backdrop-blur-xl"
      >
        {/* زخرفة هندسية خفيفة جدًا بدل الكتلة الملوّنة — بلا أي تأثير على القياسات. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(115deg,rgb(123_44_191/0.05)_0_1px,transparent_1px_9px)] [background-size:9px_9px]"
        />

        {shrunk ? (
          /* الشريط الرفيع: حقل البحث وحده، والضغط عليه يعيد المستخدم لأعلى الصفحة. */
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="relative z-10 mx-auto flex h-[42px] w-full max-w-[1240px] items-center gap-2 px-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:px-5 lg:px-8"
            aria-label={t("market.homeV2.searchPlaceholder" as "market.brand")}
          >
            <span className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-3 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate text-[12px] font-semibold">
                {t("market.homeV2.searchPlaceholder" as "market.brand")}
              </span>
            </span>
          </button>
        ) : (
        <div
          className={
            home
              ? "relative z-10 mx-auto grid min-h-[40px] w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:min-h-[44px] sm:px-5 lg:px-8"
              : "relative z-10 mx-auto grid min-h-[40px] w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:min-h-[44px] sm:px-5 lg:px-8"
          }
        >


          {home ? (
            <>
              <button
                type="button"
                onClick={() => setLocationOpen(true)}
                className="flex min-w-0 items-center gap-1.5 justify-self-start rounded-xl text-start text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
              >
                <MapPin className="size-4 shrink-0" aria-hidden />
                {/* سطر واحد بلا التفاف: المدينة والحي فقط. */}
                <strong
                  className={
                    locationKnown
                      ? "min-w-0 truncate whitespace-nowrap text-[12.5px] font-black leading-tight"
                      : "min-w-0 truncate whitespace-nowrap text-[12.5px] font-black leading-tight text-primary underline decoration-dotted underline-offset-2"
                  }
                >
                  {locationLabel}
                </strong>
              </button>

              <Link
                to="/"
                className="flex items-center gap-1.5 justify-self-center"
                aria-label={t("market.brand")}
              >
                <img
                  src={kaheelLogo}
                  alt=""
                  width={1024}
                  height={1024}
                  loading="lazy"
                  className="size-6 shrink-0 rounded-lg bg-background p-0.5 sm:size-7"
                  aria-hidden
                />
                <span className="text-[18px] font-black leading-none tracking-[-0.07em] text-foreground sm:text-xl">
                  {t("market.brand")}
                </span>

              </Link>
              <div className="flex shrink-0 items-center gap-1.5 justify-self-end">
                <a
                  href={
                    session ? "/my/notifications" : "/auth?next=%2Fdashboard%2Fnotifications"
                  }
                  className="relative grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/45"
                  aria-label={t("market.bottomNav.alerts")}
                >
                  <Bell className="size-[18px]" aria-hidden />
                  {(unreadAlerts.data ?? 0) > 0 && (
                    <span className="num absolute end-0 top-0 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-5 text-white">
                      {(unreadAlerts.data ?? 0) > 99 ? "99+" : unreadAlerts.data}
                    </span>
                  )}
                </a>
                <AddListingButton href={addHref} />
              </div>

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
                  className="size-6 shrink-0 rounded-lg bg-background p-0.5 sm:size-7"
                  aria-hidden
                />
                <span className="text-lg font-black leading-none tracking-[-0.06em] text-foreground sm:text-xl">
                  {t("market.brand")}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setLocationOpen(true)}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
              >
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="max-w-[12rem] truncate text-xs font-semibold sm:text-sm">
                  {locationLabel}
                </span>
              </button>

              <AddListingButton href={addHref} className="justify-self-end" />

            </>
          )}
        </div>
        )}
        {home && !shrunk && (

          <nav
            aria-label={t("market.nav.menu")}
            className="border-t border-border bg-background"

          >
            <div className="mx-auto flex min-h-[34px] w-full max-w-[1240px] items-center gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:px-5 lg:px-8">
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
                      ? "inline-flex min-h-7 shrink-0 items-center rounded-full bg-primary px-3.5 text-[11px] font-black text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:text-xs"
                      : "inline-flex min-h-7 shrink-0 items-center rounded-full px-3 text-[11px] font-bold text-muted-foreground outline-none transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/45 sm:text-xs"

                  }
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
        )}
        {showCategories && <MarketCategoryStrip />}
        {session && offline && (
          <div className="border-t border-border bg-secondary px-3 py-1 text-center text-[11px] font-medium text-foreground sm:text-xs">
            {t("market.offlineNotice")}
          </div>
        )}
      </header>
      <div
        aria-hidden
        className={
          // The category strip is two rows now, so the pre-measurement fallback
          // reserves the taller band and nothing jumps on first paint.
          home
            ? "h-[80px] sm:h-[86px]"

            : showCategories
              ? "h-[11.25rem] sm:h-[11.75rem]"
              : "h-[46px] sm:h-[50px]"

        }
        style={headerHeight > 0 ? { height: `${headerHeight}px` } : undefined}
      />
      {/* Mounted only after a tap so the sheet never costs anything on first paint. */}
      {locationMounted && <LocationSheet open={locationOpen} onOpenChange={setLocationOpen} />}
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
  messages: "/my/messages",
  orders: "/my/orders",
  alerts: "/my/notifications",
  more: "/more",
  offers: "/search?featured=1",
  signIn: "/auth",
} as const;

if (import.meta.env.DEV)
  for (const path of Object.values(BOTTOM_NAV_PATHS))
    if (!routeRuleFor(path.split("?")[0]!)) console.warn("[bottom nav] unregistered path", path);

type BottomKey = "home" | "messages" | "orders" | "alerts" | "more" | "offers" | "signIn";

function activeBottomKey(pathname: string, search: string): BottomKey {
  if (pathname.startsWith(BOTTOM_NAV_PATHS.messages)) return "messages";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.orders)) return "orders";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.alerts)) return "alerts";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.more)) return "more";
  if (pathname.startsWith("/auth")) return "signIn";
  if (pathname.startsWith("/search")) return search.includes("featured=1") ? "offers" : "home";
  return "home";
}

/**
 * Slim mobile tab bar.
 *
 * Two shapes only, decided by the live session status — never by a stale cached
 * flag: a guest sees three tabs (home · offers · sign in), a signed-in user sees
 * five (home · messages · my orders · alerts · more). While the session is still
 * being restored (`status === "loading"`) the guest shape is rendered, because
 * showing private tabs to someone who turns out to be a guest is the bug we are
 * fixing here.
 */
export function MarketBottomNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchString = useRouterState({ select: (s) => s.location.searchStr });
  const { session, status } = useSession();
  const authenticated = status === "authenticated" && !!session;

  const items: { key: BottomKey; to: string; icon: typeof Home }[] = authenticated
    ? [
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home },
        { key: "messages", to: BOTTOM_NAV_PATHS.messages, icon: MessageCircle },
        { key: "orders", to: BOTTOM_NAV_PATHS.orders, icon: ClipboardList },
        { key: "alerts", to: BOTTOM_NAV_PATHS.alerts, icon: Bell },
        { key: "more", to: BOTTOM_NAV_PATHS.more, icon: MoreHorizontal },
      ]
    : [
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home },
        { key: "offers", to: BOTTOM_NAV_PATHS.offers, icon: Tag },
        { key: "signIn", to: BOTTOM_NAV_PATHS.signIn, icon: LogIn },
      ];

  const activeKey = activeBottomKey(pathname, searchString ?? "");

  return (
    <nav
      aria-label={t("market.nav.menu")}
      data-testid="mkt-bottom-nav"
      data-auth={authenticated ? "member" : "guest"}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/96 pb-[env(safe-area-inset-bottom)] text-foreground shadow-[0_-1px_0_rgb(17_17_17/0.04)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch px-1">
        {items.map((item) => {
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const className = `k-press flex min-h-[46px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-xl px-1 py-1 text-[9.5px] font-bold leading-none outline-none focus-visible:ring-2 focus-visible:ring-primary/45 min-[360px]:text-[10px] ${
            active ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`;
          const inner = (
            <>
              <span
                className={
                  active
                    ? "grid h-[22px] w-9 place-items-center rounded-full bg-accent text-primary"
                    : "grid h-[22px] w-9 place-items-center rounded-full"
                }
              >

                <item.icon className="size-[17px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
              </span>
              <span className="max-w-full truncate">{label}</span>
            </>
          );
          const externalLink = item.key === "signIn" || item.key === "offers";
          return (
            <li key={item.key} className="min-w-0 flex-1">
              {externalLink ? (
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
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-xs text-muted-foreground lg:px-6">
        <p>{t("market.footer.rights")}</p>
        {(
          [
            ["/legal/copyright", "market.footer.copyright"],
            ["/legal/terms", "market.footer.terms"],
            ["/legal/privacy", "market.footer.privacy"],
            ["/legal/directory-policy", "market.footer.directoryPolicy"],
          ] as const
        ).map(([to, key]) => (
          <Link
            key={to}
            to={to}
            className="min-h-11 content-center underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {t(key)}
          </Link>
        ))}
      </div>
    </footer>
  );
}

export type FooterVariant = "compact" | "none";
const COPYRIGHT_FOOTER_PATHS = [
  "/",
  "/search",
  "/demo",
  "/guides/syria",
  "/guides/students",
  "/about",
  "/help",
  "/legal/copyright",
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
  "/my",
  "/business",
  "/chat",
  "/more",
  "/auth",
  "/register",
  "/go",
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
          ? "market-surface market-shell flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.25rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "market-surface market-shell flex min-h-dvh flex-col overflow-x-clip"
      }
    >
      {/* سطح أبيض نظيف: لا طبقة خلفية مصوّرة خلف المحتوى. */}
      <MarketHeader showCategories={showCategories} home={home} />
      <main className="flex-1">{children}</main>

      {variant === "compact" && <MarketCompactFooter />}
      {bottomNav && <MarketBottomNav />}
    </div>
  );
}
