import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin, Sparkles } from "lucide-react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings } from "@/lib/mkt-queries";
import { priceLabel } from "@/lib/mkt";
import { FavoriteButton, type ListingCardData } from "@/components/marketplace/ListingCard";

const MOBILE_AUTOPLAY_MS = 4_500;

export function MarketFeaturedBanner() {
  const { t, locale, dir } = useI18n();
  const { preference } = useMarketPreference();
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;
  const railRef = useRef<HTMLDivElement | null>(null);
  const tabRailRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [paused, setPaused] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setActive(0);
    railRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [geoKey, items.length]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
      if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const slides = useCallback(() => {
    const rail = railRef.current;
    return rail ? Array.from(rail.querySelectorAll<HTMLElement>("[data-promo-slide]")) : [];
  }, []);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const list = slides();
      if (list.length === 0) return;
      const normalized = ((index % list.length) + list.length) % list.length;
      list[normalized]?.scrollIntoView({
        behavior,
        block: "nearest",
        inline: "start",
      });
      setActive(normalized);
    },
    [slides],
  );

  const pauseTemporarily = useCallback(() => {
    setPaused(true);
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setPaused(false), 6_000);
  }, []);

  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const list = slides();
      const railRect = rail.getBoundingClientRect();
      const railCenter = railRect.left + railRect.width / 2;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;

      list.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const nextDistance = Math.abs(center - railCenter);
        if (nextDistance < distance) {
          distance = nextDistance;
          nearest = index;
        }
      });
      setActive(nearest);
    });
  }, [slides]);

  useEffect(() => {
    if (!mobile || paused || items.length < 2 || document.hidden) return;
    const timer = window.setTimeout(() => {
      scrollToIndex(active + 1);
    }, MOBILE_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, items.length, mobile, paused, scrollToIndex]);

  useEffect(() => {
    if (!mobile) return;
    const tab = tabRailRef.current?.children[active] as HTMLElement | undefined;
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active, mobile]);

  if (featured.isPending || featured.isError || items.length === 0) return null;

  const scrollBy = (direction: -1 | 1) => {
    pauseTemporarily();
    scrollToIndex(active + direction);
  };

  return (
    <section className="mx-auto w-full max-w-[1240px] px-4 pt-3 sm:px-5 sm:pt-4 lg:px-8">
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary sm:hidden">
            <Sparkles className="size-3" aria-hidden />
            عروض مختارة تتحرك تلقائيًا
          </span>
          <h2 className="min-w-0 truncate text-[15px] font-black tracking-tight text-foreground sm:text-base">
            {t("market.home.featured")}
          </h2>
        </div>
        {items.length > 1 ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label={t("market.home.featuredPrev")}
              onClick={() => scrollBy(-1)}
              className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("market.home.featuredNext")}
              onClick={() => scrollBy(1)}
              className="grid size-8 place-items-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
            >
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={railRef}
        onScroll={onScroll}
        onPointerDown={pauseTemporarily}
        onWheel={pauseTemporarily}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:snap-proximity"
      >
        {items.map((listing, index) => (
          <FeaturedSlide key={listing.id} listing={listing} priority={index === 0} />
        ))}
      </div>

      {items.length > 1 ? (
        <>
          <div
            ref={tabRailRef}
            className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
            aria-label={locale === "ar" ? "تبويبات العروض" : "Promotion tabs"}
          >
            {items.map((listing, index) => (
              <button
                key={listing.id}
                type="button"
                aria-current={index === active ? "true" : undefined}
                onClick={() => {
                  pauseTemporarily();
                  scrollToIndex(index);
                }}
                className={
                  index === active
                    ? "relative min-w-[92px] max-w-[128px] shrink-0 overflow-hidden rounded-full bg-market-navy px-3 py-1.5 text-[9px] font-black text-white shadow-sm"
                    : "min-w-[78px] max-w-[112px] shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-[9px] font-bold text-muted-foreground"
                }
              >
                <span className="block truncate">{listing.title}</span>
                {index === active && !paused ? (
                  <span
                    key={`${listing.id}-${active}`}
                    aria-hidden
                    className="absolute inset-x-2 bottom-0 h-0.5 origin-start rounded-full bg-market-silver [animation:market-promo-progress_4.5s_linear_forwards]"
                  />
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-2 hidden items-center justify-center gap-1.5 sm:flex">
            {items.map((listing, index) => (
              <button
                key={listing.id}
                type="button"
                aria-label={`${locale === "ar" ? "العرض" : "Promotion"} ${index + 1}`}
                onClick={() => scrollToIndex(index)}
                className={
                  index === active
                    ? "h-1.5 w-5 rounded-full bg-market-navy"
                    : "size-1.5 rounded-full bg-border transition hover:bg-muted-foreground"
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <style>{`
        @keyframes market-promo-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="market-promo-progress"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

function FeaturedSlide({ listing, priority }: { listing: ListingCardData; priority: boolean }) {
  const { t, locale } = useI18n();
  const slug = listing.slug ?? listing.id;
  const price = priceLabel(listing, "", locale);

  return (
    <article
      data-promo-slide
      className="relative w-full min-w-full shrink-0 snap-start overflow-hidden rounded-2xl shadow-panel sm:w-[calc(50%-0.375rem)] sm:min-w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)] xl:min-w-[calc(33.333%-0.5rem)]"
    >
      <Link
        to="/ads/$slug"
        params={{ slug }}
        className="block h-[164px] w-full sm:h-[220px] lg:h-[236px]"
      >
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading={priority ? "eager" : "lazy"}
            className="size-full object-cover"
          />
        ) : (
          <div
            className="size-full bg-gradient-to-br from-muted via-secondary to-muted"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-market-void/95 via-market-electric/35 to-transparent"
          aria-hidden
        />
        <span className="absolute start-3 top-3 rounded-full bg-market-silver px-2.5 py-1 text-[10px] font-bold text-market-navy sm:text-[11px]">
          {t("market.home.featuredBadge")}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white sm:p-4">
          <h3 className="line-clamp-1 text-[15px] font-black leading-snug sm:text-base">
            {listing.title}
          </h3>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] sm:text-xs">
            {price ? <span className="font-bold text-market-silver">{price}</span> : null}
            {listing.city ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-white/85">
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{listing.city}</span>
              </span>
            ) : null}
          </div>
          <span className="mt-2 inline-flex min-h-8 items-center rounded-xl bg-white px-3.5 text-[11px] font-bold text-market-navy sm:text-xs">
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
