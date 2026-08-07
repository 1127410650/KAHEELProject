import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Grid2x2, Home, MapPin, MessageSquare, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { addListingHref } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useMarketSetupStatus } from "@/lib/mkt-onboarding";
import { useActiveAccount } from "@/lib/mkt-account";
import { routeRuleFor } from "@/lib/routes-map";

import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";

/**
 * The single compact header for every marketplace surface. Its first row keeps
 * only the brand, the active customer's city and one icon-only add action. On
 * the public home route, the category row remains directly beneath it. A
 * measured spacer preserves document flow while the whole header stays fixed.
 */
export function MarketHeader({ showCategories = false }: { showCategories?: boolean }) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const { account } = useActiveAccount();
  const offline = useOffline();
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const addHref = addListingHref({ authenticated: !!session });
  const locationLabel = account?.city?.trim() || (locale === "ar" ? "سوريا" : "Syria");

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
        className="fixed inset-x-0 top-0 z-40 overflow-hidden bg-[linear-gradient(110deg,#020e21_0%,#062344_52%,#03152d_100%)] pt-[env(safe-area-inset-top)] text-market-navy-foreground shadow-[0_4px_14px_rgb(2_14_33/0.16)]"
      >
        <div className="mx-auto grid h-11 w-full max-w-[1240px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-12 sm:px-4 lg:px-6">
          <Link to="/" className="shrink-0" aria-label={t("market.brand")}>
            <span className="text-[15px] font-black leading-none tracking-tight text-market-navy-foreground sm:text-base">
              {t("market.brand")}
            </span>
          </Link>

          <div
            className="flex min-w-0 items-center justify-center gap-1.5 px-1 text-market-silver"
            aria-label={`${t("market.geo.accountLocation")}: ${locationLabel}`}
            title={`${t("market.geo.accountLocation")}: ${locationLabel}`}
          >
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="max-w-[12rem] truncate text-xs font-semibold sm:text-sm">
              {locationLabel}
            </span>
          </div>

          <a
            href={addHref}
            aria-label={t("market.addListing")}
            title={t("market.addListing")}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-market-navy-foreground text-market-navy shadow-sm transition-transform hover:scale-105 hover:bg-market-silver focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-navy-foreground/80 sm:size-9"
          >
            <Plus className="size-5" strokeWidth={2.4} aria-hidden />
          </a>
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
        className={
          showCategories
            ? "h-[calc(8rem+env(safe-area-inset-top))] sm:h-[calc(8.625rem+env(safe-area-inset-top))]"
            : "h-[calc(2.75rem+env(safe-area-inset-top))] sm:h-[calc(3rem+env(safe-area-inset-top))]"
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
                    ? "relative grid size-6 place-items-center text-market-navy-foreground"
                    : "relative grid size-6 place-items-center text-market-silver-muted"
                }
              >
                {item.key === "more" ? (
                  <span
                    className="whitespace-nowrap text-[8px] font-black leading-none tracking-tight min-[360px]:text-[9px]"
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
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-px px-0.5 py-1 text-[8px] font-medium leading-none min-[360px]:text-[9px]";

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
          ? "market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.25rem+env(safe-area-inset-bottom))] lg:pb-0"
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
