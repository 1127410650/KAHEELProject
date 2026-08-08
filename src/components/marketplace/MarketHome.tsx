import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  Baby,
  Bike,
  Building2,
  Car,
  ChevronLeft,
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
  MoreHorizontal,
  Package,
  Pizza,
  Plus,
  Search,
  Sandwich,
  Shirt,
  ShoppingBasket,
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
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
    tone: "from-[#ff6b2c] to-[#d9481a]",
  },
  {
    key: "groceries",
    href: "/search?domain=product",
    icon: ShoppingBasket,
    image: null,
    tone: "from-[#34d399] to-[#059669]",
  },
  {
    key: "realEstate",
    href: `/search?category=${primaryCategory("realestate")}`,
    icon: Building2,
    image: propertyImage,
    tone: "from-[#7c5ce6] to-[#4c2ea8]",
  },
  {
    key: "cars",
    href: `/search?category=${primaryCategory("cars")}`,
    icon: Car,
    image: carImage,
    tone: "from-[#2f80ed] to-[#0b5cc5]",
  },
] as const;

const SERVICES = [
  ["homeServices", "services", House, "bg-[#eef2ff] text-[#4558a8]"],
  ["electronics", "devices", Laptop, "bg-[#e8f2ff] text-[#2171c8]"],
  ["gifts", "events", Gift, "bg-[#fff0f3] text-[#d64972]"],
  ["sweets", "restaurants", IceCreamBowl, "bg-[#fff2e6] text-[#d96c1f]"],
  ["cafes", "restaurants", Coffee, "bg-[#f6ede7] text-[#8a5638]"],
  ["pharmacies", "services", HeartPulse, "bg-[#e7f8f3] text-[#16866e]"],
  ["more", "", MoreHorizontal, "bg-[#edf0f5] text-[#526078]"],
  ["kids", "fashion", Baby, "bg-[#fff4de] text-[#c77b15]"],
  ["beauty", "services", Flower2, "bg-[#f8ecff] text-[#9154bd]"],
  ["sports", "services", Dumbbell, "bg-[#e9f7ee] text-[#27824d]"],
  ["fashion", "fashion", Shirt, "bg-[#f4efff] text-[#7254bd]"],
  ["moving", "furniture", Bike, "bg-[#e9f7fa] text-[#23768b]"],
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
    <div className="bg-[linear-gradient(180deg,#f4f7fb_0%,#f8fafc_42%,#f7f9fc_100%)] pb-5 text-[#111827]">
      <div className="mx-auto w-full max-w-[1240px] space-y-5 px-4 pb-3 pt-3 sm:space-y-6 sm:px-5 lg:px-8">
        <div className="flex min-h-[58px] overflow-hidden rounded-[21px] border border-white/80 bg-white shadow-[0_10px_30px_rgb(11_29_67/0.08)] ring-1 ring-[#dfe6f0] transition-shadow hover:shadow-[0_12px_34px_rgb(11_29_67/0.12)] focus-within:ring-2 focus-within:ring-[#0b1d43]">
          <Link
            to="/search"
            search={{}}
            aria-label={t("market.homeV2.searchPlaceholder" as HomeKey)}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 text-xs font-medium text-[#737d8f] outline-none sm:text-sm"
          >
            <Search className="size-5 shrink-0 text-[#0b1d43] sm:size-6" aria-hidden />
            <span className="truncate">{t("market.homeV2.searchPlaceholder" as HomeKey)}</span>
          </Link>
          <Link
            to="/search"
            search={{ filters: 1 }}
            aria-label={t("market.homeV2.detailedSearch" as HomeKey)}
            className="group m-1.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[15px] bg-[#e9eef6] px-3 text-[11px] font-black text-[#0b1d43] outline-none transition hover:bg-[#dfe7f2] focus-visible:ring-2 focus-visible:ring-[#0b1d43] min-[380px]:px-4 min-[380px]:text-xs"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span>{t("market.homeV2.detailedSearch" as HomeKey)}</span>
          </Link>
        </div>

        <HeroBanner />

        {LIVE_DEMO_VISIBLE ? <LiveDemoEntry /> : null}

        <section aria-labelledby="home-fields-title">
          <h2 id="home-fields-title" className="sr-only">
            {t("market.homeV2.mainFields" as HomeKey)}
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
            {MAIN_FIELDS.map((field) => (
              <MainFieldCard
                key={field.key}
                field={field}
                liveImage={liveCategoryImages[field.key]}
              />
            ))}
          </div>
        </section>

        <SecondaryServices />

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
                    ? "min-h-11 shrink-0 rounded-full bg-[#0b1d43] px-5 text-xs font-bold text-white"
                    : "min-h-11 shrink-0 rounded-full bg-[#eef1f6] px-5 text-xs font-bold text-[#4b5563] hover:bg-[#e3e8f0]"
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
            tone="bg-[#fff0b8]"
            title={t("market.homeV2.actions.add.title" as HomeKey)}
            description={t("market.homeV2.actions.add.desc" as HomeKey)}
          />
          <QuickAction
            href="/services"
            icon={Wrench}
            tone="bg-[#dff7ee]"
            title={t("market.homeV2.actions.service.title" as HomeKey)}
            description={t("market.homeV2.actions.service.desc" as HomeKey)}
          />
          <QuickAction
            href="/student-tools"
            icon={Sparkles}
            tone="bg-[#eee4ff]"
            title={t("market.homeV2.actions.ai.title" as HomeKey)}
            description={t("market.homeV2.actions.ai.desc" as HomeKey)}
          />
        </section>
      </div>
    </div>
  );
}

function HeroBanner() {
  const { t } = useI18n();
  return (
    <a
      href="/search?domain=product"
      className="relative block min-h-[176px] overflow-hidden rounded-[26px] bg-[linear-gradient(115deg,#ffe995_0%,#ffda60_46%,#ffc936_100%)] shadow-[0_14px_34px_rgb(118_79_5/0.15)] outline-none ring-1 ring-white/60 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#0b1d43] sm:min-h-[196px]"
    >
      <div
        className="absolute -end-14 -top-16 size-52 rounded-full bg-[#fff4bb]/55 sm:size-64"
        aria-hidden
      />
      <div
        className="absolute -bottom-20 start-[24%] size-48 rounded-full bg-[#efb91b]/35"
        aria-hidden
      />

      <div className="absolute end-3 top-1/2 hidden size-[82px] -translate-y-1/2 place-items-center rounded-full bg-[#ff5a36] text-white shadow-[0_12px_24px_rgb(188_55_28/0.24)] min-[350px]:grid sm:end-10 sm:size-28">
        <Bike className="size-12 sm:size-16" strokeWidth={1.6} aria-hidden />
        <span className="absolute -bottom-2 rounded-full bg-white px-2 py-0.5 text-[8px] font-black text-[#b7351e] shadow-sm sm:text-[10px]">
          {t("market.homeV2.hero.fast" as HomeKey)}
        </span>
      </div>

      <div className="absolute start-3 top-1/2 hidden h-[116px] w-[92px] -translate-y-1/2 rounded-[22px] bg-white/78 shadow-[0_12px_24px_rgb(94_66_12/0.14)] min-[350px]:block sm:start-10 sm:h-[132px] sm:w-[112px]">
        <div className="absolute inset-x-3 bottom-3 top-7 rounded-[16px] bg-[#f2a734]" />
        <ShoppingBasket
          className="absolute inset-x-0 bottom-5 mx-auto size-14 text-white sm:size-16"
          strokeWidth={1.7}
          aria-hidden
        />
        <Apple
          className="absolute start-3 top-2 size-8 rotate-[-12deg] text-[#ef4c3b]"
          aria-hidden
        />
        <Milk className="absolute end-3 top-1 size-9 rotate-[8deg] text-[#2e7dcc]" aria-hidden />
        <Package
          className="absolute end-1 top-11 size-8 rotate-[8deg] text-[#8b5a2b]"
          aria-hidden
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[176px] w-full flex-col items-center justify-center px-7 py-5 text-center min-[350px]:w-[58%] min-[350px]:px-0 sm:min-h-[196px] sm:w-[52%]">
        <span className="rounded-full bg-[#ef4444] px-3 py-1 text-[10px] font-bold text-white sm:text-xs">
          {t("market.homeV2.hero.badge" as HomeKey)}
        </span>
        <h1 className="mt-2 text-[23px] font-black leading-tight text-[#241a08] sm:text-3xl">
          {t("market.homeV2.hero.title" as HomeKey)}
        </h1>
        <p className="mt-1 text-[11px] font-bold text-[#59451f] sm:text-sm">
          {t("market.homeV2.hero.desc" as HomeKey)}
        </p>
        <span className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[#111827] px-5 text-xs font-bold text-white shadow-[0_8px_18px_rgb(17_24_39/0.18)]">
          {t("market.homeV2.hero.cta" as HomeKey)}{" "}
          <ChevronLeft className="ms-1 size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
        </span>
      </div>
    </a>
  );
}

function LiveDemoEntry() {
  const { locale } = useI18n();
  return (
    <Link
      to="/demo"
      className="group relative flex min-h-[112px] overflow-hidden rounded-[24px] bg-[#071d46] px-4 py-4 text-white shadow-[0_14px_34px_rgb(7_29_70/0.18)] outline-none ring-1 ring-white/60 transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#0b5cc5] sm:min-h-[124px] sm:px-6"
    >
      <div className="absolute -end-10 -top-16 size-44 rounded-full bg-[#1685ff]/45 blur-3xl" />
      <div className="absolute -bottom-20 start-[35%] size-40 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="relative flex w-full items-center gap-3 sm:gap-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 sm:size-14">
          <Sparkles className="size-6 text-cyan-200" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-cyan-200 sm:text-[10px]">
            <span className="size-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
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
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#071d46] shadow-lg transition group-hover:-translate-x-1 rtl:group-hover:translate-x-1">
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
      className={`group relative min-h-[278px] w-[47%] min-w-[164px] shrink-0 snap-start overflow-hidden rounded-[26px] bg-gradient-to-b ${field.tone} p-4 text-white shadow-[0_12px_26px_rgb(20_34_62/0.13)] outline-none ring-1 ring-white/60 transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#0b1d43] sm:w-auto sm:min-w-0 lg:min-h-[300px]`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[21px] font-black leading-tight">
            {t(`market.homeV2.fields.${field.key}.title` as HomeKey)}
          </h3>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/16 backdrop-blur-sm">
            <Icon className="size-5" aria-hidden />
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-white/92 sm:text-xs">
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
          className="absolute inset-x-0 bottom-0 h-[62%] w-full object-cover transition-transform duration-500 [mask-image:linear-gradient(to_bottom,transparent,black_25%)] group-hover:scale-[1.025]"
        />
      ) : (
        <CategoryArtwork category={field.key} />
      )}
      <span className="absolute inset-x-3 bottom-3 z-10 inline-flex min-h-10 items-center justify-center rounded-full bg-white px-3 text-xs font-black text-[#0b1d43] shadow-[0_6px_14px_rgb(11_29_67/0.10)]">
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
        className="absolute inset-x-3 bottom-12 top-[88px] overflow-hidden rounded-[25px] bg-[radial-gradient(circle_at_50%_42%,#fff7e8_0%,#ffd6a4_52%,#d8491c_53%,#b83113_100%)]"
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
      className="absolute inset-x-3 bottom-12 top-[88px] overflow-hidden rounded-[25px] bg-[radial-gradient(circle_at_45%_40%,#f2fff9_0%,#b7f3da_48%,#0a9d70_49%,#067653_100%)]"
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

function SecondaryServices() {
  const { t, locale } = useI18n();
  return (
    <section
      aria-label={t("market.homeV2.secondaryServices" as HomeKey)}
      className="rounded-[26px] border border-white/80 bg-white p-3 shadow-[0_10px_28px_rgb(11_29_67/0.07)] ring-1 ring-[#edf1f6] sm:p-5"
    >
      <div
        className={
          locale === "ar"
            ? "grid grid-cols-4 gap-x-1 gap-y-3 min-[390px]:grid-cols-6"
            : "grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6"
        }
      >
        {SERVICES.map(([key, slug, Icon, tone]) => (
          <a
            key={key}
            href={key === "more" ? "/more" : `/search?category=${slug}`}
            className="group flex min-h-[80px] flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-1 text-center text-[10px] font-bold text-[#1f2937] outline-none focus-visible:ring-2 focus-visible:ring-[#0b1d43] sm:text-xs"
          >
            <span
              className={`grid size-12 place-items-center rounded-full ${tone} shadow-[inset_0_0_0_1px_rgb(255_255_255/0.65)] transition-transform group-hover:-translate-y-0.5`}
            >
              <Icon className="size-5" aria-hidden />
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
      <h2 id={id} className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
        <Icon className="size-5 text-[#f59e0b] sm:size-6" aria-hidden />
        <span>{title}</span>
      </h2>
      <a
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-[#0b5cc5] hover:underline"
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
          <Skeleton key={i} className="h-60 min-w-[46%] rounded-[22px] sm:min-w-[30%]" />
        ))}
      </div>
    );
  if (query.isError)
    return (
      <div className="mt-3 rounded-[22px] bg-white p-5 text-center text-sm text-[#6b7280]">
        <p>{errorLabel}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void query.refetch()}>
          {retryLabel}
        </Button>
      </div>
    );
  if (!query.data?.length)
    return (
      <p className="mt-3 rounded-[22px] bg-white px-4 py-5 text-center text-sm text-[#6b7280]">
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
      className={`flex min-h-[76px] items-center gap-3 rounded-[22px] px-4 ${tone} outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#0b1d43]`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/80 text-[#0b1d43]">
        <Icon className="size-6" aria-hidden />
      </span>
      <span>
        <strong className="block text-sm font-black text-[#111827]">{title}</strong>
        <span className="text-[11px] text-[#4b5563]">{description}</span>
      </span>
    </a>
  );
}
