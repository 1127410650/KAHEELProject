import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings } from "@/lib/mkt-queries";
import { priceLabel } from "@/lib/mkt";
import { FavoriteButton, type ListingCardData } from "@/components/marketplace/ListingCard";

/**
 * Featured (promoted) listings hero rail. It renders real promoted listings
 * only — the underlying query filters on the live promotion window and on
 * published, non-deleted rows — and disappears entirely when none exist.
 */
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

  useEffect(() => {
    setActive(0);
  }, [geoKey, items.length]);

  // No real promoted listing: the section is hidden, never replaced by a
  // placeholder or a marketing banner.
  if (featured.isPending || featured.isError || items.length === 0) return null;

  const scrollBy = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.firstElementChild as HTMLElement | null;
    const step = slide?.offsetWidth ?? rail.clientWidth;
    const rtl = dir === "rtl";
    rail.scrollBy({ left: direction * step * (rtl ? -1 : 1), behavior: "smooth" });
  };

  return (
    <section className="mx-auto w-full max-w-[1240px] px-4 lg:px-6 pt-4 sm:pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-foreground sm:text-lg">
          <span className="truncate">{t("market.home.featured")}</span>
        </h2>
        {items.length > 1 ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label={t("market.home.featuredPrev")}
              onClick={() => scrollBy(-1)}
              className="grid size-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("market.home.featuredNext")}
              onClick={() => scrollBy(1)}
              className="grid size-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
            >
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={railRef}
        onScroll={onScroll}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((listing) => (
          <FeaturedSlide key={listing.id} listing={listing} />
        ))}
      </div>

      {items.length > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((listing, index) => (
            <span
              key={listing.id}
              aria-hidden
              className={
                index === active
                  ? "h-1.5 w-5 rounded-full bg-market-navy transition-all"
                  : "size-1.5 rounded-full bg-border transition-all"
              }
            />
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
    <article className="relative w-full min-w-0 shrink-0 basis-full snap-start overflow-hidden rounded-2xl shadow-panel sm:basis-[calc(50%-0.375rem)] lg:basis-[calc(50%-0.375rem)]">
      <Link
        to="/ads/$slug"
        params={{ slug }}
        className="block h-[200px] w-full sm:h-[320px] lg:h-[360px]"
      >
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-muted" aria-hidden />
        )}
        {/* Light navy wash: enough contrast for white copy without darkening the
            whole photo. */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-market-navy/85 via-market-navy/35 to-market-navy/5"
          aria-hidden
        />

        <span className="absolute start-3 top-3 rounded-full bg-market-silver px-2.5 py-1 text-[11px] font-bold text-market-navy">
          {t("market.home.featuredBadge")}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug sm:text-lg">
            {listing.title}
          </h3>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            {price ? (
              <span className="font-semibold text-market-silver">{price}</span>
            ) : null}
            {listing.city ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-white/85">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{listing.city}</span>
              </span>
            ) : null}
          </div>
          <span className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-market-silver px-4 text-xs font-semibold text-market-navy sm:text-sm">
            {t("market.home.featuredCta")}
          </span>
        </div>
      </Link>

      <div className="absolute end-3 top-3">
        <FavoriteButton listing={listing} />
      </div>
    </article>
  );
}
