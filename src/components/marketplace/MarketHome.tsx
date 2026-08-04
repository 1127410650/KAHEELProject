import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { ADD_LISTING_PATH } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { PAGE_SIZE, loadListingsPage } from "@/lib/mkt-queries";

import { ListingCard } from "@/components/marketplace/ListingCard";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";
import { MarketFeaturedBanner } from "@/components/marketplace/home/MarketFeaturedBanner";
import { MarketCategoryTiles } from "@/components/marketplace/home/MarketCategoryTiles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Same column counts as the real cards, so the placeholder never resizes the grid. */
const GRID = "grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3.5 lg:grid-cols-4";

/**
 * The public marketplace home ("كحلي"): featured promotions (only when real
 * ones exist), the category rail and tiles, then one single feed of every
 * published listing, newest first, loaded in batches.
 *
 * There is deliberately no search box here — search lives in the bottom bar on
 * phones and in the header on desktop — and no account card or switcher.
 */
export function MarketHome() {
  const { t, locale } = useI18n();

  const { preference } = useMarketPreference();
  const geo = { countryIso2: preference.countryIso2, cityId: preference.cityId ?? undefined };
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;

  const feed = useInfiniteQuery({
    queryKey: ["mkt", "home", "feed", locale, geoKey],
    initialPageParam: 0,
    retry: 1,
    queryFn: ({ pageParam }) => loadListingsPage({ ...geo, sort: "newest" }, locale, pageParam),
    getNextPageParam: (last, all) => (last.fetched < PAGE_SIZE ? undefined : all.length),
  });

  const items = feed.data?.pages.flatMap((p) => p.rows) ?? [];

  /* ── batched loading near the end of the list ── */
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage, items.length]);

  /* ── scroll restore: opening an ad and coming back lands on the same card ── */
  const scrollKey = `tahqaq.mkt.home.scroll:${geoKey}`;
  const restored = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 0) window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  useEffect(() => {
    if (restored.current || items.length === 0) return;
    restored.current = true;
    const saved = Number(window.sessionStorage.getItem(scrollKey) ?? "0");
    if (saved > 0) window.scrollTo({ top: saved });
  }, [items.length, scrollKey]);

  return (
    <>
      {/* Promotions sit directly under the header; the banner hides itself
          entirely when no live promotion exists. */}
      <MarketFeaturedBanner />
      <MarketCategoryStrip />
      <MarketCategoryTiles />

      <section className="mx-auto w-full max-w-[1240px] px-3 pb-6 pt-4 sm:px-4 lg:px-6">
        <h2 className="mb-3 text-sm font-bold tracking-tight text-foreground sm:text-base">
          {t("market.home.all")}
        </h2>

        {feed.isError ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("market.loadError")}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void feed.refetch()}>
              {t("market.retry")}
            </Button>
          </div>
        ) : feed.isPending ? (
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("market.emptyHome")}</p>
            <Button asChild size="sm" className="mt-3">
              <Link to={ADD_LISTING_PATH} search={{ field: undefined }}>
                <Plus className="size-4" aria-hidden />
                {t("market.addListing")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className={GRID}>
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {feed.isFetchingNextPage && (
              <div className={`${GRID} mt-2.5`}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 w-full rounded-xl" />
                ))}
              </div>
            )}
            <div ref={sentinel} aria-hidden className="h-px w-full" />
          </>
        )}
      </section>
    </>
  );
}
