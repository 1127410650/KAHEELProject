import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import { CampaignAsset } from "@/components/marketplace/campaign/CampaignAsset";
import { trackCampaign, useLiveCampaigns, type LiveCampaign } from "@/lib/mkt-campaigns";
import heroImage from "@/assets/market/kaheel-home-hero-v2.webp";
import propertyImage from "@/assets/market/cat-real-estate-hero.webp";
import carImage from "@/assets/market/cat-cars.webp";
import servicesImage from "@/assets/market/cat-home-services.webp";

type Slide = {
  id: string;
  image: string;
  href: string;
  badgeAr: string;
  badgeEn: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  /** Set when the slide is a paid animated campaign instead of an editorial one. */
  campaign?: LiveCampaign;
};

const AUTOPLAY_MS = 5_200;


/**
 * The promotional banner rail. Native scroll-snap does the moving, so touch
 * dragging is the browser's own smooth gesture and autoplay is only a timed
 * `scrollTo`. Any user interaction (touch, wheel, keyboard, hover) pauses it,
 * and it never runs while off-screen, in a hidden tab, or under
 * `prefers-reduced-motion`.
 */
export function PromoCarousel({ addHref }: { addHref: string }) {
  const { locale, t } = useI18n();
  const railRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const holdingRef = useRef(false);
  const visibleRef = useRef(true);
  const ar = locale === "ar";
  const { data: campaigns } = useLiveCampaigns("home_banner");

  const slides: Slide[] = [
    {
      id: "hero",
      image: heroImage,
      href: "/search?domain=product",
      badgeAr: t("market.homeV2.hero.badge"),
      badgeEn: t("market.homeV2.hero.badge"),
      titleAr: t("market.homeV2.hero.title"),
      titleEn: t("market.homeV2.hero.title"),
      descAr: t("market.homeV2.hero.desc"),
      descEn: t("market.homeV2.hero.desc"),
    },
    {
      id: "real-estate",
      image: propertyImage,
      href: "/search?category=real-estate",
      badgeAr: "عقارات",
      badgeEn: "Real estate",
      titleAr: "ابحث عن بيتك القادم",
      titleEn: "Find your next home",
      descAr: "شقق وفلل وأراضٍ من ملّاك ومكاتب موثوقة",
      descEn: "Apartments, villas and land from trusted offices",
    },
    {
      id: "cars",
      image: carImage,
      href: "/search?category=cars",
      badgeAr: "سيارات",
      badgeEn: "Cars",
      titleAr: "سيارات بأسعار السوق",
      titleEn: "Cars at market prices",
      descAr: "قارن العروض وتواصل مع البائع مباشرة",
      descEn: "Compare offers and reach the seller directly",
    },
    {
      id: "add",
      image: servicesImage,
      href: addHref,
      badgeAr: "مجانًا",
      badgeEn: "Free",
      titleAr: "أضف إعلانك في دقيقة",
      titleEn: "Post your ad in a minute",
      descAr: "اعرض منتجك أو خدمتك على عملاء كَحيل",
      descEn: "Show your product or service to Kaheel customers",
    },
    // Paid animated campaigns ride the same rail, after the editorial slides.
    ...(campaigns ?? []).map((campaign) => ({
      id: `campaign-${campaign.id}`,
      image: heroImage,
      href: campaign.click_url,
      badgeAr: campaign.badge_ar,
      badgeEn: campaign.badge_en,
      titleAr: campaign.title_ar,
      titleEn: campaign.title_en,
      descAr: campaign.subtitle_ar,
      descEn: campaign.subtitle_en,
      campaign,
    })),
  ];

  const goTo = useCallback((next: number, smooth = true) => {
    const rail = railRef.current;
    if (!rail) return;
    const slide = rail.children[next] as HTMLElement | undefined;
    if (!slide) return;
    rail.scrollTo({ left: slide.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Keep the dots in sync with wherever the user dragged the rail.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = rail.clientWidth || 1;
        setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(rail.scrollLeft / width))));
      });
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", onScroll);
    };
  }, [slides.length]);

  // A campaign counts as seen once it is the slide on screen.
  const activeCampaignId = slides[index]?.campaign?.id ?? null;
  useEffect(() => {
    if (activeCampaignId) trackCampaign(activeCampaignId, "impression");
  }, [activeCampaignId]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
      },
      { threshold: 0.25 },
    );
    observer.observe(rail);

    const timer = window.setInterval(() => {
      if (reduced.matches) return;
      if (holdingRef.current) return;
      if (!visibleRef.current) return;
      if (document.visibilityState !== "visible") return;
      const width = rail.clientWidth || 1;
      const current = Math.round(rail.scrollLeft / width);
      const next = (current + 1) % slides.length;
      const target = rail.children[next] as HTMLElement | undefined;
      if (target) rail.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
    }, AUTOPLAY_MS);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [slides.length]);

  const hold = () => {
    holdingRef.current = true;
  };
  const release = () => {
    holdingRef.current = false;
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={ar ? "عروض كَحيل" : "Kaheel offers"}
      className="relative"
      onPointerDown={hold}
      onPointerUp={release}
      onPointerCancel={release}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={hold}
      onBlur={release}
      onWheel={hold}
    >
      <div
        ref={railRef}
        className="market-promo-rail flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[24px] sm:rounded-[30px]"
      >
        {slides.map((slide, slideIndex) => (
          <a
            key={slide.id}
            href={slide.href}
            onClick={() => {
              if (slide.campaign) trackCampaign(slide.campaign.id, "click");
            }}
            aria-label={ar ? slide.titleAr : slide.titleEn}
            aria-roledescription="slide"
            className="group relative block min-h-[132px] w-full shrink-0 snap-start snap-always overflow-hidden rounded-[24px] border border-brand-400/35 bg-white outline-none sm:min-h-[172px] sm:rounded-[30px]"
          >
            {slide.campaign ? (
              <CampaignAsset campaign={slide.campaign} />
            ) : (
              <img
                src={slide.image}
                alt=""
                width={1728}
                height={920}
                fetchPriority={slideIndex === 0 ? "high" : "low"}
                loading={slideIndex === 0 ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 size-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.015]"
                aria-hidden
              />
            )}
            <div className="relative z-10 mx-auto flex min-h-[132px] w-[78%] max-w-[520px] flex-col items-center justify-center rounded-[20px] bg-white/78 px-[var(--page-x)] py-2 text-center backdrop-blur-[2px] sm:min-h-[172px] sm:w-[52%]">
              <span className="rounded-full bg-brand-950 px-3 py-1 text-desc font-bold text-white shadow-sm sm:text-desc">
                {ar ? slide.badgeAr : slide.badgeEn}
              </span>
              {slideIndex === 0 ? (
                <h1 className="text-page mt-1 line-clamp-2 font-black leading-tight text-brand-950 min-[380px]:text-section sm:mt-1.5 sm:text-[30px]">
                  {ar ? slide.titleAr : slide.titleEn}
                </h1>
              ) : (
                <p className="mt-1 line-clamp-2 text-body font-black leading-tight text-brand-950 min-[380px]:text-section sm:mt-1.5 sm:text-[30px]">
                  {ar ? slide.titleAr : slide.titleEn}
                </p>
              )}
              <p className="mt-1 line-clamp-2 text-desc font-bold text-brand-800 min-[380px]:text-desc sm:text-desc">
                {ar ? slide.descAr : slide.descEn}
              </p>
              <span className="mt-1.5 inline-flex min-h-9 items-center rounded-full bg-brand-900 px-4 text-desc font-bold text-white shadow-[0_8px_20px_rgb(138_79_255/0.24)] sm:mt-2 sm:min-h-10 sm:text-desc">
                {t("market.homeV2.hero.cta")}
                <ChevronLeft className="ms-1 size-4 ltr:rotate-180 rtl:rotate-0" aria-hidden />
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* Tiny dashes. The button keeps a 16px tap row, the visible dash is 4px,
          so the rail gains no dead space under the banner. */}
      <div className="mt-0.5 flex h-4 items-center justify-center gap-1">
        {slides.map((slide, dotIndex) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(dotIndex)}
            aria-label={
              ar ? `الانتقال إلى العرض ${dotIndex + 1}` : `Go to offer ${dotIndex + 1}`
            }
            aria-current={dotIndex === index ? "true" : undefined}
            className="flex h-4 items-center px-0.5"
          >
            <span
              className={
                dotIndex === index
                  ? "block h-1 w-4 rounded-full bg-brand-900 transition-all duration-300"
                  : "block h-1 w-1 rounded-full bg-brand-400/60 transition-all duration-300 hover:bg-brand-700"
              }
            />
          </button>
        ))}
      </div>

    </section>
  );
}
