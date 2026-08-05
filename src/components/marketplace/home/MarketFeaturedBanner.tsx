import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings } from "@/lib/mkt-queries";
import { priceLabel } from "@/lib/mkt";
import { FavoriteButton, type ListingCardData } from "@/components/marketplace/ListingCard";

export function MarketFeaturedBanner() {
  const { t, locale, dir } = useI18n();
  const { preference } = useMarketPreference();
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;
  const railRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const featured = useQuery({
    queryKey: ["mkt", "home", "featured", locale, geoKey],
    queryFn: () =>
      loadListings(
        {
          countryIso2: preference.countryIso2,
          cityId: preference.cityId ?? undefined,
          featuredOnly: true,
          limit: 8,
        },
        locale,
      ),
    retry: 1,
  });

  const items = featured.data ?? [];

  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.firstElementChild as HTMLElement | null;
    const step = slide?.offsetWidth ?? rail.clientWidth;
    if (step <= 0) return;
    setActive(Math.round(Math.abs(rail.scrollLeft) / step));
  }, []);

  useEffect(() => setActive(0), [geoKey, items.length]);

  if (featured.isPending || featured.isError || items.length === 0) return null;

  const scrollBy = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.firstElementChild as HTMLElement | null;
    const step = slide?.offsetWidth ?? rail.clientWidth;
    rail.scrollBy({ left: direction * step * (dir === "rtl" ? -1 : 1), behavior: "smooth" });
  };

  return (
    <section className="mx-auto w-full max-w-[1240px] px-3 pt-3 sm:px-4 sm:pt-5 lg:px-6">
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <h2 className="min-w-0 truncate text-sm font-bold tracking-tight text-foreground sm:text-base">
          {t("market.home.featured")}
        </h2>
        {items.length > 1 ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button type="button" aria-label={t("market.home.featuredPrev")} onClick={() => scrollBy(-1)} className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-muted">
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </button>
            <button type="button" aria-label={t("market.home.featuredNext")} onClick={() => scrollBy(1)} className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-muted">
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div ref={railRef} onScroll={onScroll} className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3">
        {items.map((listing) => <FeaturedSlide key={listing.id} listing={listing} />)}
      </div>

      {items.length > 1 ? (
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          {items.map((listing, index) => (
            <span key={listing.id} aria-hidden className={index === active ? "h-1.5 w-4 rounded-full bg-market-navy" : "size-1.5 rounded-full bg-border"} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FeaturedSlide({ listing }: { listing: ListingCardData }) {
  const { t, locale } = useI18n();
  const slug = listing.slug ?? listing.id;
  const price = priceLabel(listing, "", locale);

  return (
    <article className="relative w-[86%] min-w-[86%] shrink-0 snap-start overflow-hidden rounded-xl shadow-panel sm:w-[calc(50%-0.375rem)] sm:min-w-[calc(50%-0.375rem)] lg:rounded-2xl">
      <Link to="/ads/$slug" params={{ slug }} className="block h-[150px] w-full sm:h-[230px] lg:h-[250px]">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt={listing.title} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-muted" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-market-navy/85 via-market-navy/30 to-transparent" aria-hidden />
        <span className="absolute start-2.5 top-2.5 rounded-full bg-market-silver px-2 py-0.5 text-[10px] font-bold text-market-navy sm:text-[11px]">
          {t("market.home.featuredBadge")}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
          <h3 className="line-clamp-1 text-sm font-bold leading-snug sm:text-base">{listing.title}</h3>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] sm:text-xs">
            {price ? <span className="font-semibold text-market-silver">{price}</span> : null}
            {listing.city ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-white/85">
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{listing.city}</span>
              </span>
            ) : null}
          </div>
          <span className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-market-silver px-3 text-[11px] font-semibold text-market-navy sm:text-xs">
            {t("market.home.featuredCta")}
          </span>
        </div>
      </Link>
      <div className="absolute end-2.5 top-2.5"><FavoriteButton listing={listing} /></div>
    </article>
  );
}
