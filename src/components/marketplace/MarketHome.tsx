import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  BadgeCheck,
  Building2,
  Car,
  ChevronLeft,
  Clock3,
  Coffee,
  Dumbbell,
  Flower2,
  Flame,
  Gift,
  HeartPulse,
  House,
  IceCreamBowl,
  Laptop,
  MessagesSquare,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Shirt,
  ShoppingBasket,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Utensils,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import carImage from "@/assets/market/cat-cars.webp";
import propertyImage from "@/assets/market/cat-real-estate-hero.webp";
import restaurantsImage from "@/assets/market/cat-restaurants-hero.webp";
import groceriesImage from "@/assets/market/cat-groceries-hero.webp";

import { useI18n } from "@/i18n";
import { addListingHref } from "@/lib/add-listing";
import { useSession } from "@/lib/session";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings, type ListingFilters } from "@/lib/mkt-queries";
import { SELECTABLE_FIELDS } from "@/lib/market-primary-navigation";
import { LIVE_DEMO_VISIBLE } from "@/lib/live-demo";
import { DemoParcelScene, useDemoSceneCopy } from "@/components/marketplace/home/DemoParcelScene";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import { SyriaHomeGateway } from "@/components/marketplace/home/SyriaHomeGateway";
import { PromoCarousel } from "@/components/marketplace/home/PromoCarousel";
import { HomeAdStrip } from "@/components/marketplace/home/HomeAdStrip";
import { ExclusiveOffersRail } from "@/components/marketplace/season/ExclusiveOffersRail";
import { SeasonalLayer } from "@/components/marketplace/season/SeasonalLayer";


import { FeaturedGuideStrip } from "@/components/marketplace/home/FeaturedGuideStrip";
import { HomeSearchBar } from "@/components/marketplace/home/HomeSearchBar";

import { KaheelStories } from "@/components/marketplace/home/KaheelStories";

import { Reveal } from "@/components/marketplace/home/Reveal";
import { useStaggerIn } from "@/components/marketplace/home/useStaggerIn";

import { Button } from "@/components/ui/button";

type HomeKey = `market.homeV2.${string}`;

function primaryCategory(id: string): string {
  const slug = SELECTABLE_FIELDS.find((field) => field.id === id)?.categorySlug;
  if (!slug) throw new Error(`Missing primary marketplace category: ${id}`);
  return slug;
}

/**
 * Bento tiles for the four primary fields.
 *
 * `span` drives the visual rhythm instead of a uniform grid: «المطاعم» is the
 * hero tile, the rest read as companions. `ratio` is the reserved aspect box, so
 * every tile has its height before the photo decodes and nothing shifts.
 */
const MAIN_FIELDS = [
  {
    key: "restaurants",
    href: `/search?category=${primaryCategory("restaurants")}`,
    icon: Utensils,
    image: restaurantsImage,
    width: 900,
    height: 675,
    span: "col-span-full min-[360px]:col-span-2 sm:col-span-3 sm:row-span-2",
    ratio: "aspect-[16/11] sm:aspect-[4/5]",
  },
  {
    key: "groceries",
    href: "/search?domain=product",
    icon: ShoppingBasket,
    image: groceriesImage,
    width: 900,
    height: 675,
    span: "col-span-full min-[360px]:col-span-1 sm:col-span-3",
    ratio: "aspect-[16/9] min-[360px]:aspect-[3/4] sm:aspect-[16/9]",
  },
  {
    key: "realEstate",
    href: `/search?category=${primaryCategory("realestate")}`,
    icon: Building2,
    image: propertyImage,
    width: 768,
    height: 576,
    span: "col-span-full min-[360px]:col-span-1 sm:col-span-3",
    ratio: "aspect-[16/9] min-[360px]:aspect-[3/4] sm:aspect-[16/9]",
  },
  {
    key: "cars",
    href: `/search?category=${primaryCategory("cars")}`,
    icon: Car,
    image: carImage,
    width: 768,
    height: 576,
    span: "col-span-full sm:col-span-6",
    ratio: "aspect-[16/7] sm:aspect-[16/6]",
  },
] as const;

/**
 * Secondary service tiles.
 *
 * Every tile carries the exact destination it promises: the category root plus a
 * search term when the tile is narrower than its category (a pharmacy is not
 * «all services»). No tile points at a page that cannot answer its own label.
 */
const SERVICES = [
  { key: "homeServices", href: "/search?category=services", icon: House },
  { key: "electronics", href: "/search?category=devices", icon: Laptop },
  { key: "gifts", href: "/search?category=events&q=%D9%87%D8%AF%D8%A7%D9%8A%D8%A7", icon: Gift },
  {
    key: "sweets",
    href: "/search?category=restaurants&q=%D8%AD%D9%84%D9%88%D9%8A%D8%A7%D8%AA",
    icon: IceCreamBowl,
  },
  {
    key: "cafes",
    href: "/search?category=restaurants&q=%D9%83%D8%A7%D9%81%D9%8A%D9%87",
    icon: Coffee,
  },
  {
    key: "pharmacies",
    href: "/search?category=services&q=%D8%B5%D9%8A%D8%AF%D9%84%D9%8A%D8%A9",
    icon: HeartPulse,
  },
  { key: "more", href: "/more", icon: MoreHorizontal },
  { key: "kids", href: "/search?category=fashion&q=%D8%A3%D8%B7%D9%81%D8%A7%D9%84", icon: Baby },
  {
    key: "beauty",
    href: "/search?category=services&q=%D8%AA%D8%AC%D9%85%D9%8A%D9%84",
    icon: Flower2,
  },
  {
    key: "sports",
    href: "/search?category=services&q=%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9",
    icon: Dumbbell,
  },
  { key: "fashion", href: "/search?category=fashion", icon: Shirt },
  { key: "moving", href: "/search?category=furniture&q=%D9%86%D9%82%D9%84", icon: Package },
] as const;


const FEATURE_FILTERS = [
  ["all", ""],
  ["realEstate", "real-estate"],
  ["cars", "cars"],
  ["devices", "devices"],
  ["jobs", "jobs"],
  ["services", "services"],
] as const;

function useHomeListings(filters: Pick<ListingFilters, "categorySlug" | "type" | "featuredOnly">) {
  const { locale } = useI18n();
  const { preference } = useMarketPreference();
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;
  return useQuery({
    queryKey: ["mkt", "home-v2", filters, locale, geoKey],
    retry: 1,
    queryFn: () =>
      loadListings(
        {
          countryIso2: preference.countryIso2,
          cityId: preference.cityId ?? undefined,
          ...filters,
          limit: 8,
        },
        locale,
      ),
  });
}

export function MarketHome() {
  const { t } = useI18n();
  const { session } = useSession();
  const [featuredCategory, setFeaturedCategory] = useState("");
  const fieldsRef = useStaggerIn<HTMLDivElement>();
  const restaurants = useHomeListings({ categorySlug: "restaurants" });
  const groceries = useHomeListings({ type: "product" });
  const featured = useHomeListings({
    categorySlug: featuredCategory || undefined,
    featuredOnly: true,
  });
  const addHref = addListingHref({ authenticated: !!session });
  const restaurantImage = restaurants.data?.find((listing) => listing.imageUrl)?.imageUrl;
  const groceryImage = groceries.data?.find((listing) => listing.imageUrl)?.imageUrl;
  const liveCategoryImages: Partial<Record<(typeof MAIN_FIELDS)[number]["key"], string>> = {
    ...(restaurantImage ? { restaurants: restaurantImage } : {}),
    ...(groceryImage ? { groceries: groceryImage } : {}),
  };

  return (
    /* k-page-surface: سطح أبيض يصبح شفافًا وحده عندما تكون خلفية اليوم مفعّلة. */
    <div className="k-page-surface bg-white pb-5 text-[#240046]">
      <div className="mx-auto w-full max-w-[1240px] space-y-6 px-3 pb-3 pt-3 sm:space-y-9 sm:px-5 lg:px-8">
        <HomeSearchBar
          label={t("market.homeV2.searchPlaceholder" as HomeKey)}
          detailedLabel={t("market.homeV2.detailedSearch" as HomeKey)}
        />


        <KaheelStories />

        <PromoCarousel addHref={addHref} />

        <Reveal as="section">

          <section
            aria-labelledby="home-fields-title"
            className="relative isolate overflow-hidden rounded-3xl"
          >
            <SeasonalLayer placement="stores" showMascot={false} />
            <h2 id="home-fields-title" className="sr-only">
              {t("market.homeV2.mainFields" as HomeKey)}
            </h2>
            <div
              ref={fieldsRef}
              data-field-grid
              className="relative z-10 grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:grid-cols-6 sm:gap-3"
            >
              {MAIN_FIELDS.map((field, index) => (
                <MainFieldCard
                  key={field.key}
                  field={field}
                  step={index}
                  liveImage={liveCategoryImages[field.key]}
                />
              ))}
            </div>
          </section>

        </Reveal>

        <HomeAdStrip addHref={addHref} />

        <Reveal>
          <ExclusiveOffersRail />
        </Reveal>



        <ListingRail
          title={t("market.homeV2.nearbyRestaurants" as HomeKey)}
          icon={Flame}
          href="/search?category=restaurants"
          query={restaurants}
          empty={t("market.homeV2.noRestaurantOffers" as HomeKey)}
        />

        <section aria-labelledby="featured-title">
          <SectionHeading
            id="featured-title"
            icon={Star}
            tone="gold"
            title={t("market.homeV2.featured" as HomeKey)}
            href="/search?featured=1"
          />

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {FEATURE_FILTERS.map(([key, slug]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFeaturedCategory(slug)}
                aria-pressed={featuredCategory === slug}
                className={
                  featuredCategory === slug
                    ? "k-press min-h-11 shrink-0 rounded-full bg-[linear-gradient(140deg,#5a189a,#3c096c)] px-5 text-xs font-black text-white shadow-[0_8px_18px_-8px_rgb(60_9_108/0.7)]"
                    : "k-press min-h-11 shrink-0 rounded-full border border-[#c77dff]/35 bg-white px-5 text-xs font-bold text-[#5a189a] hover:border-[#9d4edd]/50 hover:bg-[#e0aaff]/22"
                }
              >
                {t(`market.homeV2.filters.${key}` as HomeKey)}
              </button>
            ))}
          </div>
          <QueryRail
            query={featured}
            empty={t("market.homeV2.noFeatured" as HomeKey)}
            retryLabel={t("market.retry")}
            errorLabel={t("market.loadError")}
          />
        </section>

        <FeaturedGuideStrip />





        <Reveal>
          <BenefitsStrip />
        </Reveal>

        <Reveal>
          <SecondaryServices />
        </Reveal>

        <Reveal>
          <SyriaHomeGateway />
        </Reveal>

        {LIVE_DEMO_VISIBLE ? (
          <Reveal>
            <LiveDemoEntry />
          </Reveal>
        ) : null}

        <section
          aria-label={t("market.homeV2.quickActions" as HomeKey)}
          className="grid gap-2 sm:grid-cols-3"
        >
          <QuickAction
            href={addHref}
            icon={Plus}
            tone="bg-[#fff4de]"
            title={t("market.homeV2.actions.add.title" as HomeKey)}
            description={t("market.homeV2.actions.add.desc" as HomeKey)}
          />
          <QuickAction
            href="/services"
            icon={Wrench}
            tone="bg-[#e0aaff]/28"
            title={t("market.homeV2.actions.service.title" as HomeKey)}
            description={t("market.homeV2.actions.service.desc" as HomeKey)}
          />
          <QuickAction
            href="/guides/students"
            icon={Sparkles}
            tone="bg-[#c77dff]/24"
            title={t("market.homeV2.actions.ai.title" as HomeKey)}
            description={t("market.homeV2.actions.ai.desc" as HomeKey)}
          />
        </section>
      </div>
    </div>
  );
}

// The single hero banner became the first slide of `PromoCarousel`.



function LiveDemoEntry() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const copy = useDemoSceneCopy();
  return (
    <Link
      to="/demo"
      className="group relative flex min-h-[112px] overflow-hidden rounded-[24px] bg-[linear-gradient(110deg,#10002b,#3c096c_62%,#7b2cbf)] px-4 py-4 text-white shadow-[0_14px_34px_rgb(36_0_70/0.2)] outline-none ring-1 ring-white/60 transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#c77dff] sm:min-h-[124px] sm:px-6"
    >
      <div className="absolute -end-10 -top-16 size-44 rounded-full bg-[#c77dff]/38 blur-3xl" />
      <div className="absolute -bottom-20 start-[35%] size-40 rounded-full bg-[#e0aaff]/18 blur-3xl" />
      <div className="relative flex w-full items-center gap-3 sm:gap-5">
        <DemoParcelScene scene={copy.scene} />
        <span className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-[#e0aaff] sm:text-[10px]">
            <span className="size-1.5 rounded-full bg-[#f59e0b] motion-safe:animate-pulse" />
            {locale === "ar" ? "بيئة تجريبية حيّة" : "Live demo environment"}
          </span>
          <strong className="mt-1 block text-base font-black sm:text-xl">
            {ar ? copy.titleAr : copy.titleEn}
          </strong>
          <span className="mt-0.5 block text-[10px] font-bold text-[#e0aaff] sm:text-sm">
            {ar ? copy.subtitleAr : copy.subtitleEn}
          </span>
          <span className="mt-1 block line-clamp-1 text-[9px] text-white/62 sm:text-xs">
            {ar
              ? "جرّب كل أنواع الحسابات: عميل، متجر، عيادة، حلاق، محطة، ناقل، وإدارة المنصة"
              : "Try every account type: customer, store, clinic, barber, station, carrier, operations"}
          </span>
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#3c096c] shadow-lg transition group-hover:-translate-x-1 rtl:group-hover:translate-x-1">
          <ChevronLeft className="size-5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function MainFieldCard({
  field,
  liveImage,
  step,
}: {
  field: (typeof MAIN_FIELDS)[number];
  liveImage?: string | undefined;
  step: number;
}) {
  const { t } = useI18n();
  const Icon = field.icon;
  const image = liveImage ?? field.image;
  return (
    <a
      href={field.href}
      data-field-card
      style={{ "--k-step": step } as React.CSSProperties}
      className={`group k-press k-rise relative isolate flex min-w-0 overflow-hidden rounded-[22px] border border-white/55 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_16px_34px_-18px_rgb(60_9_108/0.55)] outline-none ring-1 ring-[#c77dff]/25 focus-visible:ring-2 focus-visible:ring-[#7b2cbf] ${field.span} ${field.ratio}`}
    >
      {/* The photo IS the card: it fills the reserved aspect box, so the colour
          of each tile comes from real content instead of one flat purple. */}
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        width={field.width}
        height={field.height}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.05]"
      />
      {/* Readability scrim: dark only at the bottom where the text sits. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgb(16_0_43/0.9)_0%,rgb(36_0_70/0.6)_40%,rgb(36_0_70/0.06)_68%,transparent_100%)]"
      />

      {/* Small identity badge instead of a heavy white button. */}
      <span className="k-glass absolute end-2.5 top-2.5 grid size-8 place-items-center rounded-full text-white sm:size-9">
        <Icon className="size-4 sm:size-[18px]" aria-hidden />
      </span>

      <span className="relative z-10 mt-auto flex w-full min-w-0 items-end gap-1.5 p-2.5 text-white min-[360px]:gap-2 min-[360px]:p-3 sm:p-4">
        <span className="min-w-0 flex-1">
          <h3 className="text-[clamp(15px,4.6vw,20px)] font-black leading-tight tracking-tight break-words drop-shadow-[0_2px_8px_rgb(16_0_43/0.75)]">
            {t(`market.homeV2.fields.${field.key}.title` as HomeKey)}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[clamp(11px,3.2vw,14px)] font-semibold leading-snug text-white/88 break-words">
            {t(`market.homeV2.fields.${field.key}.desc` as HomeKey)}
          </p>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/18 text-white backdrop-blur-sm transition-transform duration-300 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 sm:size-9">
          <ChevronLeft className="size-4 ltr:rotate-180 sm:size-5" aria-hidden />
        </span>
      </span>
    </a>
  );
}

function BenefitsStrip() {
  const { locale } = useI18n();
  const benefits = [
    [Clock3, "وصول أسرع", "Faster access"],
    [BadgeCheck, "خيارات موثوقة", "Trusted choices"],
    [MessagesSquare, "تواصل مباشر", "Direct contact"],
    [ShieldCheck, "تجربة آمنة", "Safer experience"],
  ] as const;
  return (
    <section
      aria-label={locale === "ar" ? "مزايا كَحيل" : "Kaheel benefits"}
      className="k-surface grid grid-cols-2 overflow-hidden sm:grid-cols-4"
    >
      {benefits.map(([Icon, ar, en], index) => (
        <div
          key={ar}
          className={`flex min-h-[68px] items-center gap-2.5 px-3 py-3 sm:min-h-[76px] sm:px-4 ${
            index % 2 ? "border-s border-[#c77dff]/25" : ""
          } ${index >= 2 ? "border-t border-[#c77dff]/25 sm:border-t-0" : ""}`}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_25%,#f3e3ff,#e0aaff_78%)] text-[#3c096c] shadow-[inset_0_1px_0_#fff,0_4px_10px_-4px_rgb(60_9_108/0.35)]">
            <Icon className="size-5" aria-hidden />
          </span>
          <strong className="text-[11px] font-black text-[#240046] sm:text-xs">
            {locale === "ar" ? ar : en}
          </strong>
        </div>
      ))}
    </section>
  );
}

function SecondaryServices() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="secondary-services-title">
      <SectionHeading
        id="secondary-services-title"
        icon={SlidersHorizontal}
        title={t("market.homeV2.secondaryServices" as HomeKey)}
        href="/more"
      />
      <div className="-mx-3 mt-3 flex gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:px-0">
        {SERVICES.map(({ key, href, icon: Icon }) => (
          <a
            key={key}
            href={href}
            className="k-press group flex w-[70px] shrink-0 flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-1 text-center text-[10px] font-bold text-[#3c096c] outline-none focus-visible:ring-2 focus-visible:ring-[#7b2cbf] sm:w-auto"
          >
            {/* One shared chip for every tile: the labels differentiate them, not 12 tints. */}
            <span className="grid size-14 place-items-center rounded-full border-2 border-white bg-[radial-gradient(circle_at_32%_25%,#f3e3ff,#e0aaff_78%)] text-[#3c096c] shadow-[inset_0_1px_0_#fff,0_0_0_1.5px_rgb(199_125_255/0.34),0_8px_18px_-8px_rgb(60_9_108/0.45)] transition-transform duration-200 group-hover:-translate-y-0.5 sm:size-16">
              <Icon className="size-5 sm:size-6" aria-hidden />
            </span>
            <span className="flex min-h-8 items-start justify-center leading-4">
              {t(`market.homeV2.services.${key}` as HomeKey)}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}


function SectionHeading({
  id,
  icon: Icon,
  title,
  href,
  tone = "purple",
}: {
  id: string;
  icon: typeof Flame;
  title: string;
  href: string;
  tone?: "purple" | "gold";
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="k-h2 flex min-w-0 items-center gap-2">
        <span
          className={
            tone === "gold"
              ? "k-gold-chip grid size-8 shrink-0 place-items-center rounded-xl sm:size-9"
              : "grid size-8 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#f3e3ff,#e0aaff)] text-[#5a189a] shadow-[inset_0_1px_0_#fff,0_5px_12px_-6px_rgb(60_9_108/0.45)] sm:size-9"
          }
        >
          <Icon className="size-4 sm:size-5" aria-hidden />
        </span>
        <span className="text-balance break-words">{title}</span>
      </h2>

      <a
        href={href}
        className="k-press inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-xs font-black text-[#7b2cbf] hover:bg-[#e0aaff]/28"
      >
        {t("common.viewAll")}
        <ChevronLeft className="ms-1 size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
      </a>
    </div>
  );
}

function ListingRail({
  title,
  icon,
  href,
  query,
  empty,
}: {
  title: string;
  icon: typeof Flame;
  href: string;
  query: ReturnType<typeof useHomeListings>;
  empty: string;
}) {
  const { t } = useI18n();
  return (
    <section>
      <SectionHeading id="nearby-restaurants" icon={icon} title={title} href={href} />
      <QueryRail
        query={query}
        empty={empty}
        retryLabel={t("market.retry")}
        errorLabel={t("market.loadError")}
      />
    </section>
  );
}

function QueryRail({
  query,
  empty,
  retryLabel,
  errorLabel,
}: {
  query: ReturnType<typeof useHomeListings>;
  empty: string;
  retryLabel: string;
  errorLabel: string;
}) {
  if (query.isPending)
    return (
      <div className="mt-3 flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-[46%] min-w-[160px] max-w-[230px] shrink-0 sm:w-[30%]">
            <ListingCardSkeleton />
          </div>
        ))}
      </div>
    );
  if (query.isError)
    return (
      <div className="k-surface mt-3 p-5 text-center text-sm text-[#5a189a]">
        <p>{errorLabel}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void query.refetch()}>
          {retryLabel}
        </Button>
      </div>
    );
  if (!query.data?.length)
    return (
      <p className="k-surface mt-3 px-4 py-5 text-center text-sm text-[#5a189a]">
        {empty}
      </p>
    );
  return (
    <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
      {query.data.map((listing) => (
        <div
          key={listing.id}
          className="w-[46%] min-w-[160px] max-w-[230px] shrink-0 snap-start sm:w-[30%]"
        >
          <ListingCard listing={listing} />
        </div>
      ))}
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  tone,
  title,
  description,
}: {
  href: string;
  icon: typeof Plus;
  tone: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className={`k-surface k-lift flex min-h-[80px] items-center gap-3 px-4 ${tone} outline-none focus-visible:ring-2 focus-visible:ring-[#7b2cbf]`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[#3c096c] shadow-[inset_0_1px_0_#fff,0_6px_14px_-6px_rgb(60_9_108/0.45)]">
        <Icon className="size-6" aria-hidden />
      </span>
      <span>
        <strong className="block text-sm font-black tracking-tight text-[#240046]">{title}</strong>
        <span className="text-[11px] text-[#5a189a]">{description}</span>
      </span>
    </a>
  );
}
