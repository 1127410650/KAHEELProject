import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Home,
  Plus,
  Search,
  Sparkles,
  Tag,
  Truck,
} from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings } from "@/lib/mkt-queries";
import { trackMarketActivity, useSuggestedListings } from "@/lib/mkt-activity";

import { ListingCard } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Items = React.ComponentProps<typeof ListingCard>["listing"][];

/** Section header shared by listing and business rows. */
function SectionHead({
  title,
  href,
  search,
}: {
  title: string;
  href: string;
  search?: Record<string, string>;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{title}</h2>
      <Link
        to={href}
        search={search ?? {}}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
      >
        {t("market.viewAll")}
        <ArrowLeft className="size-4 ltr:rotate-180 rtl:rotate-0" aria-hidden />
      </Link>
    </div>
  );
}

/** A section renders only when it has content, so the page never shows a wall
 *  of empty placeholders. Four items on desktop, two on phones. */
function ListingSection({
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
  if (!loading && items.length === 0) return null;
  const shown = items.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:py-7">
      <SectionHead title={title} href={href} {...(search ? { search } : {})} />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={i > 1 ? "hidden h-56 rounded-xl sm:block" : "h-28 w-full rounded-xl sm:h-56"} />
          ))}
        </div>
      ) : (
        <>
          {/* Phones get two compact horizontal rows; larger screens get a grid. */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {shown.slice(0, 2).map((listing) => (
              <ListingCard key={listing.id} listing={listing} view="row" />
            ))}
          </div>
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** The only top strip: five broad fields. Sub-categories live in search,
 *  filters and the listing form — never here. */
const QUICK_FILTERS = [
  { key: "realestate", search: { category: "real-estate" }, icon: Home },
  { key: "service", search: { type: "service" }, icon: Sparkles },
  { key: "product", search: { type: "product" }, icon: Tag },
  { key: "equipment_rent", search: { type: "equipment_rent" }, icon: Truck },
  { key: "business", search: { advertiser: "business" }, icon: Building2 },
] as const;

export function MarketHome() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { preference } = useMarketPreference();
  // The home page always reflects the market the visitor picked.
  const geo = { countryIso2: preference.countryIso2, cityId: preference.cityId ?? undefined };
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;

  const latest = useQuery({
    queryKey: ["mkt", "home", "latest", locale, geoKey],
    queryFn: () => loadListings({ ...geo, limit: 4 }, locale),
  });
  const rentals = useQuery({
    queryKey: ["mkt", "home", "rentals", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "equipment_rent", limit: 4 }, locale),
  });
  const services = useQuery({
    queryKey: ["mkt", "home", "services", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "service", limit: 4 }, locale),
  });
  const products = useQuery({
    queryKey: ["mkt", "home", "products", locale, geoKey],
    queryFn: () => loadListings({ ...geo, type: "product", limit: 4 }, locale),
  });
  const suggested = useSuggestedListings(locale, geo);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = q.trim();
    if (term) {
      trackMarketActivity({
        event: "search",
        searchQuery: term,
        cityId: preference.cityId ?? null,
      });
    }
    void navigate({
      to: "/search",
      search: {
        ...(term ? { q: term } : {}),
        country: preference.countryIso2,
        ...(preference.cityId ? { cityId: preference.cityId } : {}),
      },
    });
  }


  return (
    <>
      {/* Hero — light gradient with soft geometric lines, no heavy imagery. */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/70 via-background to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,var(--color-primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-primary)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
        />
        <div className="relative mx-auto w-full max-w-4xl px-4 py-9 text-center sm:py-14">
          <h1 className="mx-auto max-w-3xl text-balance text-xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
            {t("market.hero.title")}
          </h1>


          {/* One single search surface for the whole page. */}
          <form
            onSubmit={submitSearch}
            className="mx-auto mt-6 flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-[0_2px_10px_-6px_rgb(0_0_0/0.18)] sm:flex-row sm:items-center"
          >
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
                className="h-11 border-0 bg-transparent ps-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Button type="submit" className="h-11 w-full shrink-0 px-6 sm:w-auto">
                {t("common.search")}
              </Button>
            </div>

          </form>

          <Button asChild variant="ghost" size="sm" className="mt-3 text-primary">
            <Link to="/dashboard/ads/new">
              <Plus className="size-4" aria-hidden />
              {t("market.addListing")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Quick content types + the fields row: one compact strip, no big grid. */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible">
          {QUICK_FILTERS.map((f) => (
            <Link
              key={f.key}
              to="/search"
              search={f.search}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/60 hover:text-primary aria-[current=page]:border-primary aria-[current=page]:text-primary"
            >
              <f.icon className="size-3.5" aria-hidden />
              {t(`market.quick.${f.key}`)}
            </Link>
          ))}
        </div>

      </div>

      {/* Suggested for you — built from this visitor's own recent market activity. */}
      <ListingSection
        title={t("market.sections.suggested")}
        href="/search"
        items={suggested.data ?? []}
        loading={suggested.isLoading}
      />

      <ListingSection
        title={t("market.sections.latest")}
        href="/search"
        items={latest.data ?? []}
        loading={latest.isLoading}
      />


      <ListingSection
        title={t("market.sections.equipmentRent")}
        href="/search"
        search={{ type: "equipment_rent" }}
        items={rentals.data ?? []}
        loading={rentals.isLoading}
      />
      <ListingSection
        title={t("market.sections.services")}
        href="/search"
        search={{ type: "service" }}
        items={services.data ?? []}
        loading={services.isLoading}
      />
      <ListingSection
        title={t("market.sections.products")}
        href="/search"
        search={{ type: "product" }}
        items={products.data ?? []}
        loading={products.isLoading}
      />
    </>
  );
}
