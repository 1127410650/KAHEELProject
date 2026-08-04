import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Grid2x2,
  Home,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ADD_LISTING_PATH, addListingHref } from "@/lib/add-listing";
import { SEARCH_PATH, getSearchHref } from "@/lib/search-href";
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

/**
 * The single header for every marketplace surface (public pages, account pages
 * via DashboardShell, and the back office via AdminShell). Element order is
 * identical on desktop and mobile; only visibility differs by session state:
 *
 *   logo · search · language(desktop) · [notifications · account | sign-in] · add
 *
 * There is deliberately no second account switcher, no "marketplace"/"more"
 * link (the logo and the mobile nav cover those) and no legacy `/login` href.
 */
export function MarketHeader() {
  const { t, locale, setLocale } = useI18n();
  const { session, status } = useSession();
  const { identity: adminIdentity } = usePlatformIdentity();
  const offline = useOffline();

  const addHref = addListingHref({ authenticated: !!session });

  return (
    <header className="sticky top-0 z-40 bg-market-navy text-market-navy-foreground">
      <div className="mx-auto flex w-full max-w-[1240px] min-h-14 items-center gap-1.5 px-3 lg:px-6 py-2.5 sm:gap-3 sm:px-4">
        {/* Wordmark only — the large icon at the far end is the single brand mark. */}
        <Link to="/" className="shrink-0" aria-label={t("market.brand")}>
          <span className="text-base font-bold tracking-tight text-market-navy-foreground">
            {t("market.brand")}
          </span>
        </Link>

        {/* Primary action next to the wordmark: an explicit, readable
            "add a listing" control (never an ambiguous icon above 320 px).
            On phones this replaces the old bottom-bar "+" item. */}
        {status === "loading" ? (
          <Skeleton aria-hidden className="h-10 w-28 shrink-0 rounded-full" />
        ) : (
          <a
            href={addHref}
            aria-label={t("market.addListing")}
            title={t("market.addListing")}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-market-navy-foreground px-2.5 text-xs font-bold text-market-navy transition-colors hover:bg-market-silver sm:h-11 sm:gap-1.5 sm:px-4 sm:text-sm"
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden min-[360px]:inline">{t("market.addListing")}</span>
            <span className="min-[360px]:hidden">{t("market.bottomNav.add")}</span>
          </a>
        )}

        {/* Desktop keeps the header search entry point; on phones search lives
            in the middle of the bottom bar instead. */}
        <Link
          to={getSearchHref()}
          aria-label={t("market.nav.search")}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-market-navy-soft bg-market-navy-soft/60 px-3 py-1.5 text-sm font-medium text-market-navy-foreground transition-colors hover:bg-market-navy-soft lg:inline-flex"
        >
          <Search className="size-4" aria-hidden />
          <span>{t("market.nav.search")}</span>
        </Link>



        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            aria-label={t("common.language")}
            className="hidden rounded-md border border-market-navy-soft px-2 py-1 text-xs font-semibold text-market-silver hover:bg-market-navy-soft sm:block"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>


          {session ? (
            <>
              {/* Only a platform admin sees this; it is the way back out of the
                  public marketplace into the console. */}
              {adminIdentity?.is_platform_admin === true && adminIdentity.restricted !== true && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to="/admin" aria-label={t("admin.backToAdmin")} title={t("admin.backToAdmin")}>
                    <ShieldCheck className="size-4" aria-hidden />
                    <span className="hidden sm:inline">{t("admin.backToAdmin")}</span>
                  </Link>
                </Button>
              )}
              <MktNotificationsBell />
              {/* Account identity, switching and management live on /more only:
                  the header never renders an account card or switcher. */}
            </>
          ) : status === "loading" ? (
            // No visitor flash and no blank bar: a small skeleton holds the
            // identity slot until the local session is known.
            <Skeleton aria-hidden className="h-8 w-24 shrink-0 rounded-md sm:w-36" />
          ) : (
            <>
              {/* Guest auth actions must stay text-first on phones: icon-only
                  buttons hid the primary entry points on 320–390 px screens. */}
              <Link
                to="/auth"
                aria-label={t("market.signIn")}
                title={t("market.signIn")}
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-market-silver/70 px-2 text-xs font-semibold text-market-navy-foreground transition-colors hover:bg-market-navy-soft sm:px-3"
              >
                {t("market.signIn")}
              </Link>
              <Link
                to="/register"
                aria-label={t("market.signUp")}
                title={t("market.signUp")}
                className="inline-flex h-8 shrink-0 items-center rounded-md bg-market-silver px-2 text-xs font-semibold text-market-navy transition-colors hover:bg-market-navy-foreground sm:px-3"
              >
                {t("market.signUp")}
              </Link>
            </>

          )}

          {/* "Add a listing" lives next to the wordmark now, so it is never
              repeated here. */}

        </div>
      </div>
      {/* Losing connectivity is not a sign-out: say so instead of degrading the
          header into a visitor state. */}
      {session && offline && (
        <div className="border-t border-market-navy-soft bg-market-navy-dark px-3 py-1 text-center text-[11px] font-medium text-market-silver sm:text-xs">
          {t("market.offlineNotice")}
        </div>
      )}

    </header>
  );
}

/** Presentation-only connectivity flag for the header notice. */
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


/**
 * Signed-in visitors with an incomplete marketplace account are sent once to the
 * short setup screen; guests keep browsing freely.
 */
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

/**
 * Canonical destinations for the mobile bar, taken from the route map so no
 * legacy path (`/notifications`, `/marketplace`, `/login`) can creep back in.
 */
const BOTTOM_NAV_PATHS = {
  home: "/",
  messages: "/dashboard/messages",
  search: SEARCH_PATH,
  alerts: "/dashboard/notifications",
  more: "/more",
} as const;

if (import.meta.env.DEV) {
  for (const path of Object.values(BOTTOM_NAV_PATHS)) {
    if (!routeRuleFor(path)) console.warn("[bottom nav] unregistered path", path);
  }
}

/** Exactly one item is active: the longest matching prefix wins. */
function activeBottomKey(pathname: string): keyof typeof BOTTOM_NAV_PATHS {
  if (pathname.startsWith(BOTTOM_NAV_PATHS.search)) return "search";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.messages)) return "messages";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.alerts)) return "alerts";
  if (pathname.startsWith(BOTTOM_NAV_PATHS.more)) return "more";
  return "home";
}


/**
 * The single mobile navigation for the whole app. Signed-in users get the five
 * destinations; guests get the three public ones (private surfaces are never
 * advertised) and their "post" tap keeps the return path through sign-in.
 */
export function MarketBottomNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const { account } = useActiveAccount();

  // Unread messages inside the active account's conversations only.
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

  // Marketplace notifications (mkt_notifications) — never the internal
  // `/notifications` operational feed.
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
        { key: "search", to: BOTTOM_NAV_PATHS.search, icon: Search, badge: 0 },
        {
          key: "alerts",
          to: BOTTOM_NAV_PATHS.alerts,
          icon: Bell,
          badge: unreadAlerts.data ?? 0,
        },
        { key: "more", to: BOTTOM_NAV_PATHS.more, icon: Grid2x2, badge: 0 },
      ] as const)
    : // Guests see the same five destinations in the same order; the three
      // private ones route through sign-in with a return path.
      ([
        { key: "home", to: BOTTOM_NAV_PATHS.home, icon: Home, badge: 0 },
        {
          key: "messages",
          to: signInHref(BOTTOM_NAV_PATHS.messages),
          icon: MessageSquare,
          badge: 0,
        },
        { key: "search", to: BOTTOM_NAV_PATHS.search, icon: Search, badge: 0 },
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
          const center = item.key === "search";
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const inner = (
            <>
              <span
                className={
                  center
                    ? "relative grid size-9 place-items-center rounded-full bg-market-silver text-market-navy shadow-sm"
                    : active
                      ? "relative grid size-8 place-items-center text-market-navy-foreground"
                      : "relative grid size-8 place-items-center text-market-silver-muted"
                }
              >
                <item.icon className="size-4" aria-hidden />
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
                  active && !center
                    ? "truncate text-market-navy-foreground"
                    : "truncate text-market-silver-muted"
                }
              >
                {label}
              </span>
            </>

          );
          const className =
            "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium";
          return (
            <li key={item.key} className="flex-1">
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



/** Legal-only strip for long public content pages; never duplicates the bottom nav. */
export function MarketCompactFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-8 border-t border-border">
      <p className="mx-auto w-full max-w-[1240px] px-4 lg:px-6 py-4 text-center text-xs text-muted-foreground">
        {t("market.footer.rights")}
      </p>
    </footer>
  );
}


export type FooterVariant = "compact" | "none";

/**
 * Single source of truth for the footer:
 * - the full brand footer lives ONLY on the external guest landing page
 *   (`/welcome`, which renders it inside its own layout);
 * - marketplace browsing surfaces get the one-line copyright strip;
 * - app, account, chat, wizard and admin surfaces get no footer at all.
 */
const COPYRIGHT_FOOTER_PATHS = ["/", "/search", "/about", "/terms", "/privacy", "/help", "/contact"];
const COPYRIGHT_FOOTER_PREFIXES = ["/ads/", "/businesses/", "/u/", "/categories/", "/stores/"];
const NO_FOOTER_PREFIXES = ["/admin", "/dashboard", "/chat", "/more", "/auth", "/register", "/welcome"];

export function footerVariantForPath(pathname: string): FooterVariant {
  if (NO_FOOTER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
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
  /** Override the route-derived decision (app shells pass "none"). */
  footer?: FooterVariant;
  /** Back-office shells hide the marketplace bottom navigation entirely. */
  bottomNav?: boolean;
}) {
  const { dir } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useMarketSetupGate();
  const variant = footer ?? footerVariantForPath(pathname);

  return (
    <div
      dir={dir}
      /* `overflow-x-clip` (not `hidden`) still blocks sideways scrolling but does
       * not turn the shell into a scroll container, so a page can use a sticky
       * action bar inside its own content. */
      className={
        bottomNav
          ? "market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "market-surface flex min-h-dvh flex-col overflow-x-clip"
      }
    >
      <MarketHeader />
      {/* `main` absorbs the leftover viewport height, so a short page leaves the
       * gap in the light page colour and the footer keeps its natural height —
       * never a stretched navy block above the bottom nav. */}
      <main className="flex-1">{children}</main>

      {variant === "compact" && <MarketCompactFooter />}
      {bottomNav && <MarketBottomNav />}
    </div>
  );
}


