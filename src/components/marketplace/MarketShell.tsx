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
  Store,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";

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
import { AccountMenu } from "@/components/marketplace/AccountMenu";

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

  const addListingHref = session
    ? undefined
    : `/auth?next=${encodeURIComponent("/dashboard/ads/new")}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-1.5 px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={t("market.brand")}>
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden />
          </span>
          <span className="hidden text-base font-bold tracking-tight text-foreground sm:inline">
            {t("market.brand")}
          </span>
        </Link>

        {/* The single search entry point in the app chrome. */}
        <Link
          to="/search"
          aria-label={t("market.nav.search")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary sm:px-3"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("market.nav.search")}</span>
        </Link>

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            aria-label={t("common.language")}
            className="hidden rounded-md border border-input px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-primary sm:block"
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
              {/* The single account surface: identity, switching and management. */}
              <AccountMenu />
            </>
          ) : status === "loading" ? (
            // No visitor flash and no blank bar: a small skeleton holds the
            // identity slot until the local session is known.
            <Skeleton aria-hidden className="h-8 w-24 shrink-0 rounded-md sm:w-36" />
          ) : (
            <>
              <Button asChild size="sm" variant="outline">
                <Link to="/auth" aria-label={t("market.signIn")} title={t("market.signIn")}>
                  <ShieldCheck className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{t("market.signIn")}</span>
                </Link>
              </Button>
              {/* On phones the signup action keeps a visible label: an icon-only
                  button hid the primary entry point behind a tooltip. */}
              <Button asChild size="sm" variant="default" className="shrink-0">
                <Link
                  to="/register"
                  aria-label={t("auth.createAccount")}
                  title={t("auth.createAccount")}
                >
                  <UserPlus className="size-4" aria-hidden />
                  <span className="whitespace-nowrap">{t("auth.createAccount")}</span>
                </Link>
              </Button>

            </>
          )}

          {/* On phones the bottom bar already owns "add", so the header keeps a
              single action instead of repeating it. While the session is still
              unknown the action is a skeleton too, so no header ever shows an
              action without an identity slot next to it. */}
          {status === "loading" ? (
            <Skeleton aria-hidden className="hidden h-8 w-28 shrink-0 rounded-md sm:block" />
          ) : (
          <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex">

            {addListingHref ? (
              <a href={addListingHref} aria-label={t("market.addListing")}>
                <Plus className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t("market.addListing")}</span>
              </a>
            ) : (
              <Link to="/dashboard/ads/new" aria-label={t("market.addListing")}>
                <Plus className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t("market.addListing")}</span>
              </Link>
            )}
          </Button>
          )}
        </div>
      </div>
      {/* Losing connectivity is not a sign-out: say so instead of degrading the
          header into a visitor state. */}
      {session && offline && (
        <div className="border-t border-border bg-secondary/60 px-3 py-1 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
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
  add: "/dashboard/ads/new",
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
  if (pathname.startsWith("/dashboard/ads")) return "add";
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
        { key: "add", to: BOTTOM_NAV_PATHS.add, icon: Plus, badge: 0 },
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
        { key: "add", to: signInHref(BOTTOM_NAV_PATHS.add), icon: Plus, badge: 0 },
        { key: "more", to: BOTTOM_NAV_PATHS.more, icon: Grid2x2, badge: 0 },
      ] as const);

  const activeKey = activeBottomKey(pathname);

  return (
    <nav
      aria-label={t("market.nav.menu")}
      data-testid="mkt-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const center = item.key === "add";
          const active = activeKey === item.key;
          const label = t(`market.bottomNav.${item.key}`);
          const inner = (
            <>
              <span
                className={
                  center
                    ? "relative grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    : active
                      ? "relative grid size-8 place-items-center text-primary"
                      : "relative grid size-8 place-items-center text-muted-foreground"
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
                  active && !center ? "truncate text-primary" : "truncate text-muted-foreground"
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


interface FooterGroup {
  key: string;
  links: { to: string; label: string }[];
}

export function MarketFooter() {
  const { t } = useI18n();

  const groups: FooterGroup[] = [
    {
      key: "browse",
      links: [
        { to: "/", label: t("market.nav.marketplace") },
        { to: "/search", label: t("market.nav.search") },
        { to: "/more", label: t("market.nav.more") },
      ],
    },
    {
      key: "account",
      links: [
        { to: "/auth", label: t("market.signIn") },
        { to: "/dashboard/profile", label: t("market.identity.managePersonal") },
        { to: "/dashboard/favorites", label: t("market.more.links.favorites") },
      ],
    },
    {
      key: "business",
      links: [
        { to: "/dashboard/ads/new", label: t("market.addListing") },
        { to: "/dashboard/my-ads", label: t("market.nav.myAds") },
        { to: "/dashboard/business", label: t("market.dash.business") },
      ],
    },
  ];

  return (
    <footer className="mt-6 border-t border-border">
      <div className="mx-auto w-full max-w-7xl px-4 py-7">
        <div className="max-w-md">
          <p className="text-base font-bold tracking-tight text-foreground">{t("market.brand")}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t("market.tagline")}
          </p>
        </div>

        {/* Desktop: three compact columns. */}
        <div className="mt-6 hidden gap-8 sm:grid sm:grid-cols-3">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {t(`market.footer.${group.key}`)}
              </p>
              {group.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block text-sm text-muted-foreground hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        {t("market.footer.rights")}
      </p>
    </footer>
  );
}

/** Legal-only strip for long public content pages; never duplicates the bottom nav. */
export function MarketCompactFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-8 border-t border-border">
      <p className="mx-auto w-full max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground">
        {t("market.footer.rights")}
      </p>
    </footer>
  );
}

export type FooterVariant = "full" | "compact" | "none";

/** Public marketing surfaces keep the full footer. */
const FULL_FOOTER_PATHS = ["/", "/about", "/terms", "/privacy", "/help"];
/** Long public content pages get the legal strip only. */
const COMPACT_FOOTER_PREFIXES = ["/ads/", "/businesses/", "/u/", "/categories/"];

/** Single source of truth: app/account/admin routes end right after their content. */
export function footerVariantForPath(pathname: string): FooterVariant {
  if (FULL_FOOTER_PATHS.includes(pathname)) return "full";
  if (COMPACT_FOOTER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "compact";
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
      /* min-h-dvh + a growing <main> keep the footer at the natural end of the
       * content instead of leaving a blank strip above the fixed bottom nav.
       * The only reserved space is the nav height plus the safe area. */
      /* `overflow-x-clip` (not `hidden`) still blocks sideways scrolling but does
       * not turn the shell into a scroll container, so a page can use a sticky
       * action bar inside its own content. */
      className={
        bottomNav
          ? "flex min-h-dvh flex-col overflow-x-clip bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
          : "flex min-h-dvh flex-col overflow-x-clip bg-background"
      }

    >
      <MarketHeader />
      {/* `main` keeps its natural height so the footer follows the last section
       * directly; the wrapper below (not `main`) absorbs the remaining viewport
       * height, so a short page never shows an empty strip under the footer. */}
      <main>{children}</main>

      {variant === "full" && (
        <div className="flex flex-1 flex-col bg-secondary/30">
          <MarketFooter />
        </div>
      )}
      {variant === "compact" && (
        <div className="flex flex-1 flex-col">
          <MarketCompactFooter />
        </div>
      )}
      {variant === "none" && <div className="flex-1" />}
      {bottomNav && <MarketBottomNav />}
    </div>


  );
}

