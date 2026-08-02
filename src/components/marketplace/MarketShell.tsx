import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Plus, Search, ShieldCheck, Store, User } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { SA_CITIES } from "@/lib/mkt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("market.nav.menu")}>
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-4" onClick={() => setOpen(false)}>
              {navLinks}
              <Link to="/dashboard/my-ads" className="text-sm font-medium text-foreground">
                {t("market.nav.myAds")}
              </Link>
              <Link to="/dashboard/requests" className="text-sm font-medium text-foreground">
                {t("market.nav.myRequests")}
              </Link>
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
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label={t("market.filters.city")}
            className="hidden h-9 rounded-md border border-input bg-background px-2 text-sm md:block"
          >
            <option value="">{t("market.filters.allCities")}</option>
            {SA_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="shrink-0">
            {t("common.search")}
          </Button>
        </form>

        <nav className="hidden items-center gap-5 lg:flex">{navLinks}</nav>

        <div className="flex shrink-0 items-center gap-2">
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
            <Button asChild size="sm" variant="outline">
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

export function MarketFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-bold text-foreground">{t("market.brand")}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("market.tagline")}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("market.footer.browse")}</p>
          <Link to="/marketplace" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.nav.marketplace")}
          </Link>
          <Link to="/search" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.nav.search")}
          </Link>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("market.footer.business")}</p>
          <Link to="/dashboard/ads/new" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.addListing")}
          </Link>
          <Link to="/dashboard/my-ads" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.nav.myAds")}
          </Link>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("market.footer.account")}</p>
          <Link to="/login" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.signIn")}
          </Link>
          <Link to="/register" className="block text-sm text-muted-foreground hover:text-primary">
            {t("market.signUp")}
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
      <main className="flex-1">{children}</main>
      <MarketFooter />
    </div>
  );
}
