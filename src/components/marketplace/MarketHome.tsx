import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import { SA_CITIES } from "@/lib/mkt";
import { loadCategories, loadListings, loadVerifiedBusinesses } from "@/lib/mkt-queries";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function Section({
  title,
  href,
  search,
  children,
}: {
  title: string;
  href: string;
  search?: Record<string, string>;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <Link
          to={href}
          search={search ?? {}}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          {t("market.viewAll")}
          <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ items, loading }: { items: React.ComponentProps<typeof ListingCard>["listing"][]; loading: boolean }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t("market.emptySection")}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

export function MarketHome() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const latest = useQuery({
    queryKey: ["mkt", "home", "latest", locale],
    queryFn: () => loadListings({ limit: 8 }, locale),
  });
  const equipment = useQuery({
    queryKey: ["mkt", "home", "equipment", locale],
    queryFn: () => loadListings({ type: "equipment_sale", limit: 4 }, locale),
  });
  const rentals = useQuery({
    queryKey: ["mkt", "home", "rentals", locale],
    queryFn: () => loadListings({ type: "equipment_rent", limit: 4 }, locale),
  });
  const products = useQuery({
    queryKey: ["mkt", "home", "products", locale],
    queryFn: () => loadListings({ type: "product", limit: 4 }, locale),
  });
  const services = useQuery({
    queryKey: ["mkt", "home", "services", locale],
    queryFn: () => loadListings({ type: "service", limit: 4 }, locale),
  });
  const needs = useQuery({
    queryKey: ["mkt", "home", "needs", locale],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        loadListings({ type: "need_supplier", limit: 4 }, locale),
        loadListings({ type: "need_contractor", limit: 4 }, locale),
      ]);
      return [...a, ...b].slice(0, 4);
    },
  });
  const verified = useQuery({ queryKey: ["mkt", "home", "verified"], queryFn: () => loadVerifiedBusinesses(8) });

  const roots = (categories.data ?? []).filter((c) => !c.parent_id);

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-secondary/60 to-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 text-center sm:py-14">
          <h1 className="text-2xl font-bold leading-snug text-foreground sm:text-4xl">
            {t("market.hero.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t("market.hero.subtitle")}
          </p>
          <form
            className="mx-auto mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({
                to: "/search",
                search: { ...(q.trim() ? { q: q.trim() } : {}), ...(city ? { city } : {}) },
              });
            }}
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("market.searchPlaceholder")}
                aria-label={t("market.searchPlaceholder")}
                className="h-11 ps-9"
              />
            </div>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label={t("market.filters.city")}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("market.filters.allCities")}</option>
              {SA_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button type="submit" size="lg" className="h-11">
              {t("common.search")}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/dashboard/ads/new">
                <Plus className="size-4" aria-hidden />
                {t("market.addListing")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/search" search={{ verified: "1" }}>
                {t("market.nav.verified")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6">
        <h2 className="mb-3 text-lg font-bold text-foreground">{t("market.categories")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {roots.map((c) => (
            <Link
              key={c.id}
              to="/categories/$slug"
              params={{ slug: c.slug }}
              className="rounded-xl border border-border bg-card px-3 py-3 text-center text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {locale === "ar" ? c.name_ar : c.name_en}
            </Link>
          ))}
        </div>
      </section>

      <Section title={t("market.sections.latest")} href="/search">
        <Grid items={latest.data ?? []} loading={latest.isLoading} />
      </Section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6">
        <h2 className="mb-3 text-lg font-bold text-foreground">{t("market.sections.verifiedBusinesses")}</h2>
        {verified.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (verified.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("market.emptySection")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(verified.data ?? []).map((b) => (
              <Link
                key={b.tenant_id}
                to="/businesses/$slug"
                params={{ slug: b.slug }}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">
                    {locale === "ar" ? b.display_name_ar : b.display_name_en || b.display_name_ar}
                  </p>
                  <VerifiedBadge status={b.verification_status} />
                </div>
                {b.headline && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.headline}</p>}
                {b.city && <p className="mt-2 text-[11px] text-muted-foreground">{b.city}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <Section title={t("market.sections.equipmentSale")} href="/search" search={{ type: "equipment_sale" }}>
        <Grid items={equipment.data ?? []} loading={equipment.isLoading} />
      </Section>
      <Section title={t("market.sections.equipmentRent")} href="/search" search={{ type: "equipment_rent" }}>
        <Grid items={rentals.data ?? []} loading={rentals.isLoading} />
      </Section>
      <Section title={t("market.sections.products")} href="/search" search={{ type: "product" }}>
        <Grid items={products.data ?? []} loading={products.isLoading} />
      </Section>
      <Section title={t("market.sections.services")} href="/search" search={{ type: "service" }}>
        <Grid items={services.data ?? []} loading={services.isLoading} />
      </Section>
      <Section title={t("market.sections.needs")} href="/search" search={{ type: "need_supplier" }}>
        <Grid items={needs.data ?? []} loading={needs.isLoading} />
      </Section>
    </>
  );
}
