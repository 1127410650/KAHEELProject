import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings } from "@/lib/mkt-queries";

import { ListingCard } from "@/components/marketplace/ListingCard";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";
import { MarketFeaturedBanner } from "@/components/marketplace/home/MarketFeaturedBanner";
import { MarketCategoryTiles } from "@/components/marketplace/home/MarketCategoryTiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Items = React.ComponentProps<typeof ListingCard>["listing"][];

/** A section stays hidden when it has nothing to show, so the public home never
 *  renders an empty placeholder row. */
function ListingSection({
  title,
  items,
  loading,
  failed,
  onRetry,
  badge,
}: {
  title: string;
  items: Items;
  loading: boolean;
  failed?: boolean;
  onRetry?: () => void;
  badge?: string;
}) {
  const { t } = useI18n();
  // Nothing to show and nothing pending: the whole section disappears instead of
  // leaving a decorative skeleton behind.
  if (!loading && !failed && items.length === 0) return null;
  const shown = items.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:py-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-foreground sm:text-lg">
          <span className="truncate">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded-full bg-market-navy px-2 py-0.5 text-[10px] font-semibold text-market-navy-foreground">
              {badge}
            </span>
          ) : null}
        </h2>
        <Link
          to="/search"
          className="shrink-0 text-xs font-medium text-primary hover:underline sm:text-sm"
        >
          {t("market.viewAll")}
        </Link>
      </div>

      {failed ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{t("market.loadError")}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            {t("market.retry")}
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className={i > 1 ? "hidden h-56 rounded-xl sm:block" : "h-28 w-full rounded-xl sm:h-56"}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 sm:hidden">
            {shown.slice(0, 2).map((listing) => (
              <ListingCard key={listing.id} listing={listing} view="row" />
            ))}
          </div>
          {/* Fixed column counts keep four cards on one balanced row instead of
           * leaving an orphan card beside a wide empty gap. */}
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


/**
 * The public marketplace home ("كحلي"): search card, category rail, banner,
 * category tiles, featured listings, latest listings. It contains no admin or
 * internal-system entry point.
 */
export function MarketHome() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const { preference } = useMarketPreference();
  const geo = { countryIso2: preference.countryIso2, cityId: preference.cityId ?? undefined };
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;

  const featured = useQuery({
    queryKey: ["mkt", "home", "featured", locale, geoKey],
    queryFn: () => loadListings({ ...geo, featuredOnly: true, limit: 8 }, locale),
    retry: 1,
  });
  const latest = useQuery({
    queryKey: ["mkt", "home", "latest", locale, geoKey],
    queryFn: () => loadListings({ ...geo, limit: 12 }, locale),
    retry: 1,
  });

  const featuredItems = (featured.data ?? []).slice(0, 4);
  const featuredIds = new Set(featuredItems.map((l) => l.id));
  const latestItems = (latest.data ?? []).filter((l) => !featuredIds.has(l.id)).slice(0, 4);
  const isEmpty =
    !featured.isPending &&
    !latest.isPending &&
    !featured.isError &&
    !latest.isError &&
    featuredItems.length === 0 &&
    latestItems.length === 0;


  return (
    <>
      {/* Search sits on the navy band so it reads as part of the brand chrome. */}
      <section className="bg-market-navy">
        <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-3 sm:pb-4 sm:pt-5">
          <form
            role="search"
            className="flex min-w-0 items-center gap-2 rounded-2xl bg-card p-2 shadow-panel"
            onSubmit={(event) => {
              event.preventDefault();
              const term = query.trim();
              void navigate({ to: "/search", search: term ? { q: term } : {} });
            }}
          >
            <label htmlFor="home-search" className="sr-only">
              {t("market.nav.search")}
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="home-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("market.searchPlaceholder")}
                className="h-11 border-0 bg-transparent ps-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" size="sm" className="h-11 shrink-0 rounded-xl px-4">
              {t("market.nav.search")}
            </Button>
          </form>
        </div>
      </section>

      <MarketCategoryStrip />
      <MarketFeaturedBanner />
      <MarketCategoryTiles />

      {isEmpty ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">{t("market.emptyHome")}</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/dashboard/ads/new">
              <Plus className="size-4" aria-hidden />
              {t("market.addListing")}
            </Link>
          </Button>
        </section>
      ) : (
        <>
          {/* Promotions live in the hero banner above; this feed is fresh stock only. */}
          <ListingSection
            title={t("market.home.latest")}
            items={latestItems}
            loading={latest.isPending}
            failed={latest.isError}
            onRetry={() => void latest.refetch()}
          />
        </>
      )}
    </>

  );
}
