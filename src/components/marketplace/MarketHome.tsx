import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Plus, Search, Sparkles, Tag, User } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { MarketSwitcher } from "@/components/marketplace/MarketSwitcher";
import { loadCategories, loadListings } from "@/lib/mkt-queries";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Items = React.ComponentProps<typeof ListingCard>["listing"][];

/** A section renders only when it has content, so the page never shows a wall
 *  of empty placeholders. */
function Section({
  title,
  href,
  search,
  items,
  loading,
}: {
  title: string;
  href: string;
  search?: Record<string, string>;
  items: Items;
  loading: boolean;
}) {
  const { t } = useI18n();
  if (!loading && items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
        <Link
          to={href}
          search={search ?? {}}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary sm:text-sm"
        >
          {t("market.viewAll")}
          <ArrowLeft className="size-4 ltr:rotate-180 rtl:rotate-0" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl sm:h-56" />
          ))}
        </div>
      ) : (
        <>
          {/* Phones get compact horizontal rows; larger screens get a grid. */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} view="row" />
            ))}
          </div>
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const QUICK_FILTERS = [
  { key: "service", search: { type: "service" }, icon: Sparkles },
  { key: "equipment_rent", search: { type: "equipment_rent" }, icon: Tag },
  { key: "product", search: { type: "product" }, icon: Tag },
  
  { key: "business", search: { advertiser: "business" }, icon: Building2 },
  { key: "individual", search: { advertiser: "individual" }, icon: User },
] as const;

export function MarketHome() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { preference } = useMarketPreference();
  // The home page always reflects the market the visitor picked.
  const geo = { countryIso2: preference.countryIso2, cityId: preference.cityId ?? undefined };
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const latest = useQuery({
    queryKey: ["mkt", "home", "latest", locale, geoKey],
    queryFn: () => loadListings({ ...geo, limit: 8 }, locale),
  });
  const equipment = useQuery({
    queryKey: ["mkt", "home", "equipment", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "equipment_sale", limit: 4 }, locale),
  });
  const rentals = useQuery({
    queryKey: ["mkt", "home", "rentals", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "equipment_rent", limit: 4 }, locale),
  });
  const products = useQuery({
    queryKey: ["mkt", "home", "products", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "product", limit: 4 }, locale),
  });
  const services = useQuery({
    queryKey: ["mkt", "home", "services", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "service", limit: 4 }, locale),
  });
  const needs = useQuery({
    queryKey: ["mkt", "home", "needs", locale, geoKey],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        loadListings({ ...geo, type: "need_supplier", limit: 4 }, locale),
        loadListings({ ...geo, type: "need_contractor", limit: 4 }, locale),
      ]);
      return [...a, ...b].slice(0, 4);
    },
  });

  const roots = (categories.data ?? []).filter((c) => !c.parent_id);

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-secondary/60 to-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 text-center sm:py-14">
          <h1 className="text-xl font-bold leading-snug text-foreground sm:text-4xl">
            {t("market.hero.title")}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:mt-3 sm:text-base">
            {t("market.hero.subtitle")}
          </p>
          <form
            className="mx-auto mt-5 flex max-w-3xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({
                to: "/search",
                search: {
                  ...(q.trim() ? { q: q.trim() } : {}),
                  country: preference.countryIso2,
                  ...(preference.cityId ? { cityId: preference.cityId } : {}),
                },
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
            <div className="flex items-center justify-center">
              <MarketSwitcher />
            </div>
            <Button type="submit" size="lg" className="h-11">
              {t("common.search")}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/dashboard/ads/new">
                <Plus className="size-4" aria-hidden />
                {t("market.addListing")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/search">{t("market.nav.search")}</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("market.hero.openToAll")}</p>
        </div>
      </section>

      {/* Quick filters: one tap to the most requested slices of the market. */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-3 py-3 sm:px-4">
          {QUICK_FILTERS.map((f) => (
            <Link
              key={f.key}
              to="/search"
              search={f.search}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary"
            >
              <f.icon className="size-3.5" aria-hidden />
              {t(`market.quick.${f.key}`)}
            </Link>
          ))}
        </div>
      </div>

      <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <h2 className="mb-3 text-base font-bold text-foreground sm:text-lg">
          {t("market.categories")}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
          {categories.isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-xl sm:w-full" />
              ))
            : roots.map((c) => (
                <Link
                  key={c.id}
                  to="/categories/$slug"
                  params={{ slug: c.slug }}
                  className="shrink-0 rounded-xl border border-border bg-card px-3 py-2.5 text-center text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary sm:text-sm"
                >
                  {locale === "ar" ? c.name_ar : c.name_en}
                </Link>
              ))}
        </div>
      </section>

      <Section
        title={t("market.sections.latest")}
        href="/search"
        items={latest.data ?? []}
        loading={latest.isLoading}
      />


      <Section
        title={t("market.sections.equipmentSale")}
        href="/search"
        search={{ type: "equipment_sale" }}
        items={equipment.data ?? []}
        loading={equipment.isLoading}
      />
      <Section
        title={t("market.sections.equipmentRent")}
        href="/search"
        search={{ type: "equipment_rent" }}
        items={rentals.data ?? []}
        loading={rentals.isLoading}
      />
      <Section
        title={t("market.sections.products")}
        href="/search"
        search={{ type: "product" }}
        items={products.data ?? []}
        loading={products.isLoading}
      />
      <Section
        title={t("market.sections.services")}
        href="/search"
        search={{ type: "service" }}
        items={services.data ?? []}
        loading={services.isLoading}
      />
      <Section
        title={t("market.sections.needs")}
        href="/search"
        search={{ type: "need_supplier" }}
        items={needs.data ?? []}
        loading={needs.isLoading}
      />
    </>
  );
}
