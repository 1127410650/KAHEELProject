import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { ADD_LISTING_PATH } from "@/lib/add-listing";
import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { PAGE_SIZE, loadListingsPage } from "@/lib/mkt-queries";

import { ListingCard } from "@/components/marketplace/ListingCard";
import { MarketFeaturedBanner } from "@/components/marketplace/home/MarketFeaturedBanner";
import { MarketCategoryTiles } from "@/components/marketplace/home/MarketCategoryTiles";
import { MarketDemoShowcases } from "@/components/marketplace/home/MarketDemoShowcases";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const GRID = "grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4";

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
      <MarketFeaturedBanner />
      <MarketDemoShowcases />
      <MarketCategoryTiles />

      <section className="mx-auto w-full max-w-[1240px] px-4 pb-5 pt-2 sm:px-5 sm:pt-3 lg:px-8">
        <h2 className="mb-2.5 text-[16px] font-black tracking-tight text-foreground sm:text-lg">
          {t("market.home.all")}
        </h2>

        {feed.isError ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("market.loadError")}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void feed.refetch()}>
              {t("market.retry")}
            </Button>
          </div>
        ) : feed.isPending ? (
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center">
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
              <div className={`${GRID} mt-2`}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-52 w-full rounded-2xl" />
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
