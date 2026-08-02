import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Grid2x2, Home, Plus, Search, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useMarketPreference } from "@/lib/mkt-geo";
import { useMarketSetupStatus } from "@/lib/mkt-onboarding";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MktNotificationsBell } from "@/components/marketplace/MktNotificationsBell";
import { AccountMenu } from "@/components/marketplace/AccountMenu";

const HOME_PATHS = ["/", "/marketplace"];

/** On the home page the hero owns the search box; the header one appears after
 *  the visitor scrolls past it so the same control never shows twice. */
function useHeaderSearchVisible() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = HOME_PATHS.includes(pathname);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 260);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return !isHome || scrolled;
}

export function MarketHeader() {
  const { t, locale, setLocale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { preference } = useMarketPreference();
  const searchVisible = useHeaderSearchVisible();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    navigate({
      to: "/search",
      search: {
        ...(q.trim() ? { q: q.trim() } : {}),
        country: preference.countryIso2,
        ...(preference.cityId ? { cityId: preference.cityId } : {}),
      },
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link to="/marketplace" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden />
          </span>
          <span className="hidden text-base font-bold tracking-tight text-foreground sm:inline">
            {t("market.brand")}
          </span>
        </Link>

        {searchVisible ? (
          <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search
                className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("market.searchPlaceholder")}
                aria-label={t("market.searchPlaceholder")}
                className="h-9 ps-9"
              />
            </div>
          </form>
        ) : (
          <div className="min-w-0 flex-1" />
        )}


        {/* Only shipped destinations are linked from the header. */}
        <nav className="hidden items-center gap-5 lg:flex">
          <Link to="/marketplace" className="text-sm font-medium text-foreground hover:text-primary">
            {t("market.nav.marketplace")}
          </Link>
          <Link to="/search" className="text-sm font-medium text-foreground hover:text-primary">
            {t("market.nav.search")}
          </Link>
          <Link to="/more" className="text-sm font-medium text-foreground hover:text-primary">
            {t("market.nav.more")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <MktNotificationsBell />
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="hidden rounded-md border border-input px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-primary sm:block"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>
          {/* The single account surface: identity, switching and management. */}
          {session ? (
            <AccountMenu />
          ) : (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link to="/login">
                <ShieldCheck className="size-4" aria-hidden />
                <span className="hidden lg:inline">{t("market.signIn")}</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="shrink-0">
            <Link to="/dashboard/ads/new" aria-label={t("market.addListing")}>
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("market.addListing")}</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
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

/** Compact mobile navigation: the five destinations that matter on a phone. */
export function MarketBottomNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/marketplace", key: "home", icon: Home },
    { to: "/search", key: "search", icon: Search },
    { to: "/dashboard/ads/new", key: "add", icon: Plus },
    { to: "/dashboard/notifications", key: "alerts", icon: Bell },
    { to: "/more", key: "more", icon: Grid2x2 },
  ] as const;

  return (
    <nav
      aria-label={t("market.nav.menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = pathname === item.to;
          const center = item.key === "add";
          return (
            <li key={item.key} className="flex-1">
              <Link
                to={item.to}
                className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium"
              >
                <span
                  className={
                    center
                      ? "grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
                      : active
                        ? "grid size-8 place-items-center text-primary"
                        : "grid size-8 place-items-center text-muted-foreground"
                  }
                >
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className={active && !center ? "text-primary" : "text-muted-foreground"}>
                  {t(`market.bottomNav.${item.key}`)}
                </span>
              </Link>
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
        { to: "/marketplace", label: t("market.nav.marketplace") },
        { to: "/search", label: t("market.nav.search") },
        { to: "/more", label: t("market.nav.more") },
      ],
    },
    {
      key: "account",
      links: [
        { to: "/login", label: t("market.signIn") },
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
    <footer className="mt-10 border-t border-border bg-secondary/30">
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
        {t("market.footer.rights")} · Asia/Riyadh · SAR
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
        {t("market.footer.rights")} · Asia/Riyadh · SAR
      </p>
    </footer>
  );
}

export type FooterVariant = "full" | "compact" | "none";

/** Public marketing surfaces keep the full footer. */
const FULL_FOOTER_PATHS = ["/", "/marketplace", "/about", "/terms", "/privacy", "/help"];
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
}: {
  children: React.ReactNode;
  /** Override the route-derived decision (app shells pass "none"). */
  footer?: FooterVariant;
}) {
  const { dir } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useMarketSetupGate();
  const variant = footer ?? footerVariantForPath(pathname);

  return (
    <div dir={dir} className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <MarketHeader />
      <main className="flex-1">{children}</main>
      {variant === "full" && <MarketFooter />}
      {variant === "compact" && <MarketCompactFooter />}
      {/* Space for the mobile bottom nav so content never hides behind it. */}
      <div className="h-16 lg:hidden" aria-hidden />
      <MarketBottomNav />
    </div>
  );
}

