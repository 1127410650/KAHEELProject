import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Grid2x2, Home, Menu, Plus, Search, ShieldCheck, Store, User } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { MarketSwitcher } from "@/components/marketplace/MarketSwitcher";
import { useMarketPreference } from "@/lib/mkt-geo";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MktNotificationsBell } from "@/components/marketplace/MktNotificationsBell";
import { IdentitySwitcher } from "@/components/marketplace/IdentitySwitcher";

export function MarketHeader() {
  const { t, locale, setLocale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    navigate({
      to: "/search",
      search: { ...(q.trim() ? { q: q.trim() } : {}), ...(city ? { city } : {}) },
    });
  }

  const navLinks = (
    <>
      <Link to="/marketplace" className="text-sm font-medium text-foreground hover:text-primary">
        {t("market.nav.marketplace")}
      </Link>
      <Link
        to="/search"
        search={{ type: "need_supplier" }}
        className="text-sm font-medium text-foreground hover:text-primary"
      >
        {t("market.nav.requests")}
      </Link>
      <Link
        to="/search"
        search={{ verified: "1" }}
        className="text-sm font-medium text-foreground hover:text-primary"
      >
        {t("market.nav.verified")}
      </Link>
      <Link to="/more" className="text-sm font-medium text-foreground hover:text-primary">
        {t("market.nav.more")}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:hidden"
              aria-label={t("market.nav.menu")}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-4" onClick={() => setOpen(false)}>
              {navLinks}
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/marketplace" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden />
          </span>
          <span className="hidden text-base font-bold text-foreground sm:inline">
            {t("market.brand")}
          </span>
        </Link>

        <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("market.searchPlaceholder")}
              aria-label={t("market.searchPlaceholder")}
              className="ps-9"
            />
          </div>
          <div className="hidden md:block">
            <MarketSwitcher />
          </div>

          <Button type="submit" size="sm" className="hidden shrink-0 sm:inline-flex">
            {t("common.search")}
          </Button>
        </form>

        <nav className="hidden items-center gap-5 lg:flex">{navLinks}</nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden lg:block">
            <IdentitySwitcher />
          </div>
          <MktNotificationsBell />
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="hidden rounded-md border border-input px-2 py-1 text-xs font-semibold text-muted-foreground sm:block"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>
          <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
            <Link to="/dashboard/ads/new">
              <Plus className="size-4" aria-hidden />
              {t("market.addListing")}
            </Link>
          </Button>
          {session ? (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link to="/dashboard/my-ads">
                <User className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t("market.nav.account")}</span>
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">
                <ShieldCheck className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t("market.signIn")}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
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

export function MarketFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-12 border-t border-border bg-secondary/40">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-bold text-foreground">{t("market.brand")}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("market.tagline")}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("market.footer.browse")}</p>
          <Link
            to="/marketplace"
            className="block text-sm text-muted-foreground hover:text-primary"
          >
            {t("market.nav.marketplace")}
          </Link>
          <Link to="/search" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.nav.search")}
          </Link>
          <Link to="/more" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.nav.more")}
          </Link>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("market.footer.business")}</p>
          <Link
            to="/dashboard/ads/new"
            className="block text-sm text-muted-foreground hover:text-primary"
          >
            {t("market.addListing")}
          </Link>
          <Link
            to="/dashboard/my-ads"
            className="block text-sm text-muted-foreground hover:text-primary"
          >
            {t("market.nav.myAds")}
          </Link>
          <Link
            to="/dashboard/business"
            className="block text-sm text-muted-foreground hover:text-primary"
          >
            {t("market.dash.business")}
          </Link>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("market.footer.account")}</p>
          <Link to="/login" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.signIn")}
          </Link>
          <Link
            to="/dashboard/profile"
            className="block text-sm text-muted-foreground hover:text-primary"
          >
            {t("market.identity.managePersonal")}
          </Link>
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        {t("market.footer.rights")} · Asia/Riyadh · SAR
      </p>
    </footer>
  );
}

export function MarketShell({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return (
    <div dir={dir} className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <MarketHeader />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <MarketFooter />
      <MarketBottomNav />
    </div>
  );
}
