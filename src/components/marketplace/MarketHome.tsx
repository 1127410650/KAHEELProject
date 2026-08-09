import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Apple,
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
  Milk,
  MessagesSquare,
  MoreHorizontal,
  Package,
  Pizza,
  Plus,
  Search,
  Sandwich,
  Shirt,
  ShoppingBasket,
  ShieldCheck,
  SlidersHorizontal,
  Soup,
  Sparkles,
  Star,
  Utensils,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import carImage from "@/assets/market/cat-cars.webp";
import propertyImage from "@/assets/market/cat-real-estate-hero.webp";

import { useI18n } from "@/i18n";
import { addListingHref } from "@/lib/add-listing";
import { useSession } from "@/lib/session";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings, type ListingFilters } from "@/lib/mkt-queries";
import { SELECTABLE_FIELDS } from "@/lib/market-primary-navigation";
import { LIVE_DEMO_VISIBLE } from "@/lib/live-demo";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/ListingCard";
import { SyriaHomeGateway } from "@/components/marketplace/home/SyriaHomeGateway";
import { PromoCarousel } from "@/components/marketplace/home/PromoCarousel";
import { WelcomeTakeover } from "@/components/marketplace/home/WelcomeTakeover";
import { Reveal } from "@/components/marketplace/home/Reveal";

import { Button } from "@/components/ui/button";

type HomeKey = `market.homeV2.${string}`;

function primaryCategory(id: string): string {
  const slug = SELECTABLE_FIELDS.find((field) => field.id === id)?.categorySlug;
  if (!slug) throw new Error(`Missing primary marketplace category: ${id}`);
  return slug;
}

const MAIN_FIELDS = [
  {
    key: "restaurants",
    href: `/search?category=${primaryCategory("restaurants")}`,
    icon: Utensils,
    image: null,
    tone: "linear-gradient(168deg,#7b2cbf 0%,#5a189a 52%,#240046 100%)",
  },
  {
    key: "groceries",
    href: "/search?domain=product",
    icon: ShoppingBasket,
    image: null,
    tone: "linear-gradient(168deg,#9d4edd 0%,#7b2cbf 50%,#3c096c 100%)",
  },
  {
    key: "realEstate",
    href: `/search?category=${primaryCategory("realestate")}`,
    icon: Building2,
    image: propertyImage,
    tone: "linear-gradient(168deg,#9d4edd 0%,#5a189a 50%,#240046 100%)",
  },
  {
    key: "cars",
    href: `/search?category=${primaryCategory("cars")}`,
    icon: Car,
    image: carImage,
    tone: "linear-gradient(168deg,#5a189a 0%,#3c096c 48%,#10002b 100%)",
  },
] as const;

const SERVICES = [
  ["homeServices", "services", House, "bg-[#e0aaff]/38 text-[#3c096c]"],
  ["electronics", "devices", Laptop, "bg-[#c77dff]/30 text-[#5a189a]"],
  ["gifts", "events", Gift, "bg-[#e0aaff]/46 text-[#7b2cbf]"],
  ["sweets", "restaurants", IceCreamBowl, "bg-[#c77dff]/34 text-[#3c096c]"],
  ["cafes", "restaurants", Coffee, "bg-[#e0aaff]/34 text-[#5a189a]"],
  ["pharmacies", "services", HeartPulse, "bg-[#9d4edd]/18 text-[#3c096c]"],
  ["more", "", MoreHorizontal, "bg-[#e0aaff]/32 text-[#240046]"],
  ["kids", "fashion", Baby, "bg-[#c77dff]/24 text-[#7b2cbf]"],
  ["beauty", "services", Flower2, "bg-[#e0aaff]/52 text-[#5a189a]"],
  ["sports", "services", Dumbbell, "bg-[#9d4edd]/16 text-[#3c096c]"],
  ["fashion", "fashion", Shirt, "bg-[#c77dff]/28 text-[#7b2cbf]"],
  ["moving", "furniture", Package, "bg-[#e0aaff]/38 text-[#5a189a]"],
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
    <div className="bg-white pb-5 text-[#240046]">
      <div className="mx-auto w-full max-w-[1240px] space-y-4 px-3 pb-3 pt-3 sm:space-y-6 sm:px-5 lg:px-8">
        <div className="k-surface flex min-h-[56px] overflow-hidden rounded-[20px] focus-within:border-[#9d4edd]/60 focus-within:ring-2 focus-within:ring-[#7b2cbf]/30 sm:min-h-[60px]">
          <Link
            to="/search"
            search={{}}
            aria-label={t("market.homeV2.searchPlaceholder" as HomeKey)}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 text-xs font-medium text-[#5a189a] outline-none sm:text-sm"
          >
            <Search className="size-5 shrink-0 text-[#3c096c] sm:size-6" aria-hidden />
            <span className="truncate">{t("market.homeV2.searchPlaceholder" as HomeKey)}</span>
          </Link>
          <Link
            to="/search"
            search={{ filters: 1 }}
            aria-label={t("market.homeV2.detailedSearch" as HomeKey)}
            className="k-press group m-1.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[15px] bg-[linear-gradient(140deg,#7b2cbf,#5a189a)] px-3 text-[11px] font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7b2cbf] min-[380px]:px-4 min-[380px]:text-xs"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span>{t("market.homeV2.detailedSearch" as HomeKey)}</span>
          </Link>
        </div>

        <PromoCarousel addHref={addHref} />
        <WelcomeTakeover />

        <Reveal as="section">
          <section aria-labelledby="home-fields-title">
            <h2 id="home-fields-title" className="sr-only">
              {t("market.homeV2.mainFields" as HomeKey)}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
              {MAIN_FIELDS.map((field) => (
                <MainFieldCard
                  key={field.key}
                  field={field}
                  liveImage={liveCategoryImages[field.key]}
                />
              ))}
            </div>
          </section>
        </Reveal>

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
  return (
    <Link
      to="/demo"
      className="group relative flex min-h-[112px] overflow-hidden rounded-[24px] bg-[linear-gradient(110deg,#10002b,#3c096c_62%,#7b2cbf)] px-4 py-4 text-white shadow-[0_14px_34px_rgb(36_0_70/0.2)] outline-none ring-1 ring-white/60 transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#c77dff] sm:min-h-[124px] sm:px-6"
    >
      <div className="absolute -end-10 -top-16 size-44 rounded-full bg-[#c77dff]/38 blur-3xl" />
      <div className="absolute -bottom-20 start-[35%] size-40 rounded-full bg-[#e0aaff]/18 blur-3xl" />
      <div className="relative flex w-full items-center gap-3 sm:gap-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 sm:size-14">
          <Sparkles className="size-6 text-[#e0aaff]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-[#e0aaff] sm:text-[10px]">
            <span className="size-1.5 rounded-full bg-[#f59e0b] motion-safe:animate-pulse" />
            {locale === "ar" ? "بيئة تجريبية حيّة" : "Live demo environment"}
          </span>
          <strong className="mt-1 block text-base font-black sm:text-xl">
            {locale === "ar"
              ? "جرّب كل أنواع الحسابات قبل الإطلاق"
              : "Explore every account type before launch"}
          </strong>
          <span className="mt-1 block line-clamp-1 text-[9px] text-white/62 sm:text-xs">
            {locale === "ar"
              ? "عميل، متجر، عيادة، حلاق، محطة، ناقل، وإدارة المنصة"
              : "Customer, store, clinic, barber, station, carrier, and platform operations"}
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
}: {
  field: (typeof MAIN_FIELDS)[number];
  liveImage?: string | undefined;
}) {
  const { t } = useI18n();
  const Icon = field.icon;
  const image = liveImage ?? field.image;
  return (
    <a
      href={field.href}
      style={{ backgroundImage: field.tone }}
      className="group k-deep k-lift relative min-h-[208px] min-w-0 p-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7b2cbf] sm:min-h-[260px] sm:p-4 lg:min-h-[292px]"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[17px] font-black leading-[1.15] tracking-tight sm:text-[21px]">
            {t(`market.homeV2.fields.${field.key}.title` as HomeKey)}
          </h3>
          <span className="k-glass grid size-8 shrink-0 place-items-center rounded-full sm:size-9">
            <Icon className="size-4 sm:size-5" aria-hidden />
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[9px] font-medium leading-4 text-white/92 min-[380px]:text-[10px] sm:text-xs sm:leading-5">
          {t(`market.homeV2.fields.${field.key}.desc` as HomeKey)}
        </p>
      </div>
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          width={360}
          height={220}
          className="absolute inset-x-0 bottom-0 h-[64%] w-full object-cover transition-transform duration-500 [mask-image:linear-gradient(to_bottom,transparent,black_24%)] group-hover:scale-[1.035]"
        />
      ) : (
        <CategoryArtwork category={field.key} />
      )}
      <span className="absolute inset-x-2.5 bottom-2.5 z-10 inline-flex min-h-10 items-center justify-center rounded-full bg-white px-2 text-[10px] font-black text-[#3c096c] shadow-[0_1px_1px_rgb(36_0_70/0.08),0_8px_18px_-6px_rgb(36_0_70/0.35)] transition-transform duration-200 group-hover:-translate-y-0.5 sm:inset-x-3 sm:bottom-3 sm:px-3 sm:text-xs">
        {t(`market.homeV2.fields.${field.key}.cta` as HomeKey)}
        <ChevronLeft className="ms-1 size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
      </span>
    </a>
  );
}

function CategoryArtwork({ category }: { category: (typeof MAIN_FIELDS)[number]["key"] }) {
  if (category === "restaurants")
    return (
      <div
        className="absolute inset-x-3 bottom-12 top-[82px] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#e0aaff_52%,#7b2cbf_53%,#3c096c_100%)] sm:top-[88px] sm:rounded-[25px]"
        aria-hidden
      >
        <span className="absolute start-3 top-4 grid size-14 -rotate-6 place-items-center rounded-2xl bg-white text-[#ef5a2f] shadow-lg">
          <Pizza className="size-9" strokeWidth={1.7} />
        </span>
        <span className="absolute end-3 top-7 grid size-16 rotate-6 place-items-center rounded-full bg-[#fff7e7] text-[#b85c25] shadow-lg">
          <Soup className="size-10" strokeWidth={1.7} />
        </span>
        <span className="absolute bottom-3 start-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-2xl bg-[#ffe7a8] text-[#a6431f] shadow-lg">
          <Sandwich className="size-10" strokeWidth={1.7} />
        </span>
      </div>
    );
  return (
    <div
      className="absolute inset-x-3 bottom-12 top-[82px] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_45%_40%,#ffffff_0%,#e0aaff_48%,#9d4edd_49%,#5a189a_100%)] sm:top-[88px] sm:rounded-[25px]"
      aria-hidden
    >
      <ShoppingBasket
        className="absolute bottom-5 start-1/2 size-24 -translate-x-1/2 text-white drop-shadow-lg"
        strokeWidth={1.45}
      />
      <Apple className="absolute start-5 top-4 size-11 -rotate-12 text-[#e74c3c] drop-shadow" />
      <Milk className="absolute end-5 top-3 size-12 rotate-6 text-[#2176c9] drop-shadow" />
      <Package className="absolute bottom-5 end-3 size-10 rotate-6 text-[#f4bc48] drop-shadow" />
    </div>
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
  const { t, locale } = useI18n();
  return (
    <section aria-label={t("market.homeV2.secondaryServices" as HomeKey)} className="py-1">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="k-eyebrow">
            {locale === "ar" ? "قصص كَحيل" : "Kaheel stories"}
          </p>
          <h2 className="k-h2">
            {t("market.homeV2.secondaryServices" as HomeKey)}
          </h2>
        </div>
        <a
          href="/more"
          className="text-[11px] font-black text-[#7b2cbf] hover:underline sm:text-xs"
        >
          {t("common.viewAll")}
        </a>
      </div>
      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:px-0">
        {SERVICES.map(([key, slug, Icon, tone]) => (
          <a
            key={key}
            href={key === "more" ? "/more" : `/search?category=${slug}`}
            className="k-press group flex w-[70px] shrink-0 flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-1 text-center text-[9px] font-bold text-[#3c096c] outline-none focus-visible:ring-2 focus-visible:ring-[#7b2cbf] sm:w-auto sm:text-[10px]"
          >
            <span
              className={`grid size-14 place-items-center rounded-full border-2 border-white ${tone} shadow-[inset_0_1px_0_#fff,0_0_0_1.5px_rgb(199_125_255/0.34),0_8px_18px_-8px_rgb(60_9_108/0.45)] transition-transform duration-200 group-hover:-translate-y-0.5 sm:size-16`}
            >
              <Icon className="size-5 sm:size-6" aria-hidden />
            </span>
            <span className="line-clamp-2 leading-4">
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
}: {
  id: string;
  icon: typeof Flame;
  title: string;
  href: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="k-h2 flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#f3e3ff,#e0aaff)] text-[#5a189a] shadow-[inset_0_1px_0_#fff,0_5px_12px_-6px_rgb(60_9_108/0.45)] sm:size-9">
          <Icon className="size-4 sm:size-5" aria-hidden />
        </span>
        <span className="truncate">{title}</span>
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
