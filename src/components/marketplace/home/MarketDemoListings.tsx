import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin, Pause, Play, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import catCars from "@/assets/market/cat-cars.webp";
import catDevices from "@/assets/market/cat-devices.webp";
import catEquipment from "@/assets/market/cat-equipment.webp";
import catHomeServices from "@/assets/market/cat-home-services.webp";
import catRealEstate from "@/assets/market/cat-real-estate.webp";
import catSuppliers from "@/assets/market/cat-suppliers.webp";

type DemoListing = {
  id: string;
  image: string;
  title: { ar: string; en: string };
  category: { ar: string; en: string };
  price: { ar: string; en: string };
  city: { ar: string; en: string };
  search: Record<string, string>;
};

const DEMO_LISTINGS: DemoListing[] = [
  {
    id: "demo-home",
    image: catRealEstate,
    title: { ar: "شقة عائلية بإطلالة مفتوحة", en: "Family apartment with an open view" },
    category: { ar: "عقارات", en: "Property" },
    price: { ar: "سعر توضيحي ٣٢٠ مليون ل.س", en: "Sample price SYP 320m" },
    city: { ar: "دمشق", en: "Damascus" },
    search: { category: "real-estate" },
  },
  {
    id: "demo-car",
    image: catCars,
    title: { ar: "سيارة اقتصادية بحالة ممتازة", en: "Economical car in excellent condition" },
    category: { ar: "سيارات", en: "Cars" },
    price: { ar: "سعر توضيحي ١١٥ مليون ل.س", en: "Sample price SYP 115m" },
    city: { ar: "حلب", en: "Aleppo" },
    search: { q: "سيارة" },
  },
  {
    id: "demo-laptop",
    image: catDevices,
    title: { ar: "حاسوب محمول للدراسة والعمل", en: "Laptop for study and work" },
    category: { ar: "أجهزة", en: "Devices" },
    price: { ar: "سعر توضيحي ٦٫٨ مليون ل.س", en: "Sample price SYP 6.8m" },
    city: { ar: "دمشق", en: "Damascus" },
    search: { q: "جهاز" },
  },
  {
    id: "demo-service",
    image: catHomeServices,
    title: { ar: "فني صيانة منزلية عند الطلب", en: "On-demand home maintenance" },
    category: { ar: "خدمات", en: "Services" },
    price: { ar: "السعر حسب الخدمة", en: "Price by service" },
    city: { ar: "حمص", en: "Homs" },
    search: { category: "maintenance" },
  },
  {
    id: "demo-equipment",
    image: catEquipment,
    title: { ar: "معدات ورشة جاهزة للتشغيل", en: "Workshop equipment ready to operate" },
    category: { ar: "معدات", en: "Equipment" },
    price: { ar: "السعر عند التواصل", en: "Contact for price" },
    city: { ar: "ريف دمشق", en: "Rural Damascus" },
    search: { category: "equipment" },
  },
  {
    id: "demo-supplier",
    image: catSuppliers,
    title: { ar: "مورد مواد وتجهيزات للمشاريع", en: "Project materials and equipment supplier" },
    category: { ar: "موردون", en: "Suppliers" },
    price: { ar: "اطلب عرض سعر", en: "Request a quote" },
    city: { ar: "اللاذقية", en: "Latakia" },
    search: { category: "factories" },
  },
];

const AUTOPLAY_MS = 3_800;

/**
 * A presentation-only rail that makes an empty/new marketplace feel tangible.
 * Every card is visibly marked as a demo and links to real search results; it
 * never writes fake listings to Supabase and never opens a fictional ad route.
 */
export function MarketDemoListings() {
  const { locale, dir } = useI18n();
  const language = locale === "ar" ? "ar" : "en";
  const railRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(
    () => () => {
      if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    },
    [],
  );

  const slides = useCallback(() => {
    const rail = railRef.current;
    return rail ? Array.from(rail.querySelectorAll<HTMLElement>("[data-demo-listing]")) : [];
  }, []);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const rail = railRef.current;
      const list = slides();
      if (!rail || list.length === 0) return;
      const normalized = ((index % list.length) + list.length) % list.length;
      const target = list[normalized];
      if (!target) return;
      const railRect = rail.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const left =
        rail.scrollLeft +
        (dir === "rtl" ? targetRect.right - railRect.right : targetRect.left - railRect.left);
      rail.scrollTo({ left, behavior });
      setActive(normalized);
    },
    [dir, slides],
  );

  const pauseAfterInteraction = useCallback(() => {
    setInteractionPaused(true);
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setInteractionPaused(false), 7_000);
  }, []);

  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const railRect = rail.getBoundingClientRect();
      const center = railRect.left + railRect.width / 2;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;

      slides().forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const nextDistance = Math.abs(rect.left + rect.width / 2 - center);
        if (nextDistance < distance) {
          nearest = index;
          distance = nextDistance;
        }
      });
      setActive(nearest);
    });
  }, [slides]);

  useEffect(() => {
    if (manualPaused || interactionPaused || reducedMotion || document.hidden) return;
    const timer = window.setTimeout(() => scrollToIndex(active + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, interactionPaused, manualPaused, reducedMotion, scrollToIndex]);

  const move = (direction: -1 | 1) => {
    pauseAfterInteraction();
    scrollToIndex(active + direction);
  };

  const previousIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const nextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const PreviousIcon = previousIcon;
  const NextIcon = nextIcon;

  return (
    <section
      aria-labelledby="demo-listings-title"
      className="mx-auto w-full max-w-[1240px] px-3 pb-2 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="overflow-hidden rounded-[1.35rem] border border-market-navy/10 bg-gradient-to-b from-white to-market-silver/55 shadow-[0_10px_30px_rgb(15_23_42/0.08)] sm:rounded-[1.75rem]">
        <div className="flex items-start justify-between gap-3 px-3.5 pb-2.5 pt-3.5 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-market-navy px-2.5 py-1 text-[9px] font-black text-white sm:text-[10px]">
              <Sparkles className="size-3" aria-hidden />
              {language === "ar" ? "جولة سريعة" : "Quick tour"}
            </span>
            <h2
              id="demo-listings-title"
              className="mt-1.5 text-[17px] font-black tracking-tight text-foreground sm:text-xl"
            >
              {language === "ar" ? "شاهد شكل إعلانك في كَحيل" : "See how your listing can look"}
            </h2>
            <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground sm:text-xs">
              {language === "ar"
                ? "نماذج عرض تجريبية فقط — لا تمثل إعلانات منشورة أو عروضًا حقيقية."
                : "Presentation demos only — these are not published listings or real offers."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={language === "ar" ? "النموذج السابق" : "Previous demo"}
              className="grid size-8 place-items-center rounded-full border border-border bg-white text-market-navy shadow-sm transition hover:border-market-navy/30 hover:bg-secondary"
            >
              <PreviousIcon className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setManualPaused((current) => !current)}
              aria-label={
                manualPaused
                  ? language === "ar"
                    ? "تشغيل الحركة"
                    : "Play motion"
                  : language === "ar"
                    ? "إيقاف الحركة"
                    : "Pause motion"
              }
              aria-pressed={manualPaused}
              className={
                reducedMotion
                  ? "hidden"
                  : "grid size-8 place-items-center rounded-full border border-border bg-white text-market-navy shadow-sm transition hover:border-market-navy/30 hover:bg-secondary"
              }
            >
              {manualPaused ? (
                <Play className="size-3.5" aria-hidden />
              ) : (
                <Pause className="size-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={language === "ar" ? "النموذج التالي" : "Next demo"}
              className="grid size-8 place-items-center rounded-full border border-border bg-white text-market-navy shadow-sm transition hover:border-market-navy/30 hover:bg-secondary"
            >
              <NextIcon className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div
          ref={railRef}
          onScroll={onScroll}
          onPointerDown={pauseAfterInteraction}
          onWheel={pauseAfterInteraction}
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth px-3.5 pb-3.5 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5 sm:pb-5"
        >
          {DEMO_LISTINGS.map((listing, index) => (
            <article
              key={listing.id}
              data-demo-listing
              className="group w-[46%] min-w-[46%] max-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border/85 bg-white shadow-[0_3px_14px_rgb(15_23_42/0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-market-navy/20 hover:shadow-[0_8px_22px_rgb(15_23_42/0.12)] min-[420px]:w-[42%] min-[420px]:min-w-[42%] sm:w-[210px] sm:min-w-[210px]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                <img
                  src={listing.image}
                  alt=""
                  width={480}
                  height={360}
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-market-navy/55 via-transparent to-white/10"
                  aria-hidden
                />
                <span className="absolute start-2 top-2 rounded-full border border-white/40 bg-white/92 px-2 py-1 text-[8px] font-black text-market-navy shadow-sm backdrop-blur sm:text-[9px]">
                  {language === "ar" ? "نموذج تجريبي" : "Demo listing"}
                </span>
                <span className="absolute bottom-2 start-2 rounded-full bg-market-navy/88 px-2 py-1 text-[8px] font-bold text-white backdrop-blur sm:text-[9px]">
                  {listing.category[language]}
                </span>
              </div>

              <div className="p-2.5 sm:p-3">
                <h3 className="line-clamp-2 min-h-[2.6em] text-[11px] font-black leading-[1.3] text-foreground sm:text-[13px]">
                  {listing.title[language]}
                </h3>
                <p className="mt-1.5 line-clamp-1 text-[10px] font-black text-market-navy sm:text-[11px]">
                  {listing.price[language]}
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground sm:text-[10px]">
                  <MapPin className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{listing.city[language]}</span>
                </div>
                <Link
                  to="/search"
                  search={listing.search}
                  className="mt-2.5 inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-secondary px-2 py-1 text-center text-[9px] font-black leading-4 text-secondary-foreground transition hover:bg-market-navy hover:text-white sm:text-[10px]"
                >
                  {language === "ar" ? "شاهد الإعلانات الحقيقية" : "View real listings"}
                </Link>
              </div>
            </article>
          ))}
          <span aria-hidden className="w-0.5 shrink-0" />
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-3 sm:pb-4" aria-hidden>
          {DEMO_LISTINGS.map((listing, index) => (
            <span
              key={listing.id}
              className={
                index === active
                  ? "h-1.5 w-5 rounded-full bg-market-navy transition-all"
                  : "size-1.5 rounded-full bg-market-silver-line transition-all"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
