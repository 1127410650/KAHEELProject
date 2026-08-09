import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles } from "lucide-react";

import catCars from "@/assets/market/cat-cars.webp";
import catDevices from "@/assets/market/cat-devices.webp";
import catEquipment from "@/assets/market/cat-equipment.webp";
import catHomeServices from "@/assets/market/cat-home-services.webp";
import catRealEstate from "@/assets/market/cat-real-estate.webp";
import catSuppliers from "@/assets/market/cat-suppliers.webp";
import { useAutoLoopRail } from "@/components/marketplace/home/useAutoLoopRail";
import { useI18n } from "@/i18n";
import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";

type Localized = { ar: string; en: string };

type DemoListing = {
  id: string;
  image: string;
  title: Localized;
  category: Localized;
  price: Localized;
  city: Localized;
  search: Record<string, string>;
};

const FEATURED_DEMOS: DemoListing[] = [
  {
    id: "demo-home",
    image: catRealEstate,
    title: { ar: "شقة عائلية بإطلالة مفتوحة", en: "Family apartment with an open view" },
    category: { ar: "عقارات", en: "Property" },
    price: { ar: "٣٢٠ مليون ل.س", en: "SYP 320m" },
    city: { ar: "دمشق", en: "Damascus" },
    search: { category: "real-estate" },
  },
  {
    id: "demo-car",
    image: catCars,
    title: { ar: "سيارة اقتصادية بحالة ممتازة", en: "Economical car in excellent condition" },
    category: { ar: "سيارات", en: "Cars" },
    price: { ar: "١١٥ مليون ل.س", en: "SYP 115m" },
    city: { ar: "حلب", en: "Aleppo" },
    search: { category: "cars" },
  },
  {
    id: "demo-laptop",
    image: catDevices,
    title: { ar: "حاسوب محمول للدراسة والعمل", en: "Laptop for study and work" },
    category: { ar: "أجهزة", en: "Devices" },
    price: { ar: "٦٫٨ مليون ل.س", en: "SYP 6.8m" },
    city: { ar: "دمشق", en: "Damascus" },
    search: { category: "devices" },
  },
  {
    id: "demo-service",
    image: catHomeServices,
    title: { ar: "فني صيانة منزلية عند الطلب", en: "On-demand home maintenance" },
    category: { ar: "خدمات", en: "Services" },
    price: { ar: "ابتداءً من ١٥٠ ألف ل.س", en: "From SYP 150k" },
    city: { ar: "حمص", en: "Homs" },
    search: { category: "services" },
  },
  {
    id: "demo-equipment",
    image: catEquipment,
    title: { ar: "معدات ورشة جاهزة للتشغيل", en: "Workshop equipment ready to operate" },
    category: { ar: "معدات", en: "Equipment" },
    price: { ar: "٤٢ مليون ل.س", en: "SYP 42m" },
    city: { ar: "ريف دمشق", en: "Rural Damascus" },
    search: { q: "معدات" },
  },
  {
    id: "demo-supplier",
    image: catSuppliers,
    title: { ar: "مواد وتجهيزات للمشاريع", en: "Project materials and equipment" },
    category: { ar: "موردون", en: "Suppliers" },
    price: { ar: "اطلب عرض سعر", en: "Request a quote" },
    city: { ar: "اللاذقية", en: "Latakia" },
    search: { q: "مورد" },
  },
];

const DEMO_PRICES: Localized[] = [
  { ar: "٢٨٠ ألف ل.س", en: "SYP 280k" },
  { ar: "٧٥٠ ألف ل.س", en: "SYP 750k" },
  { ar: "١٫٢ مليون ل.س", en: "SYP 1.2m" },
  { ar: "٩٥ ألف ل.س", en: "SYP 95k" },
  { ar: "٤٤٠ ألف ل.س", en: "SYP 440k" },
  { ar: "٢٫٤ مليون ل.س", en: "SYP 2.4m" },
];

const DEMO_CITIES: Localized[] = [
  { ar: "دمشق", en: "Damascus" },
  { ar: "حلب", en: "Aleppo" },
  { ar: "حمص", en: "Homs" },
  { ar: "اللاذقية", en: "Latakia" },
];

const STORE_DEMOS: DemoListing[] = DEMO_STORE_WORLDS.flatMap((world, worldIndex) =>
  world.stores.slice(0, 2).map((store, storeIndex) => {
    const index = worldIndex * 2 + storeIndex;
    const firstTag = store.tags[0] ?? world.shortTitle;
    return {
      id: `demo-${world.id}-${storeIndex}`,
      image: store.image,
      title: {
        ar: `${firstTag} مختارة من ${store.name}`,
        en: `${world.shortTitle} pick from ${store.name}`,
      },
      category: { ar: world.shortTitle, en: world.shortTitle },
      price: DEMO_PRICES[index % DEMO_PRICES.length]!,
      city: DEMO_CITIES[index % DEMO_CITIES.length]!,
      search: { q: firstTag },
    };
  }),
).slice(0, 12);

const DEMO_LISTINGS = [...FEATURED_DEMOS, ...STORE_DEMOS];

function compactImage(source: string) {
  return source.replace(/w=\d+/, "w=440").replace(/q=\d+/, "q=78");
}

/**
 * Dense presentation-only listing rows. Every card is visibly marked as a
 * demo and links to real search results; no fictional listing is persisted.
 */
export function MarketDemoListings() {
  const { locale } = useI18n();
  const firstRow = DEMO_LISTINGS.filter((_, index) => index % 2 === 0);
  const secondRow = DEMO_LISTINGS.filter((_, index) => index % 2 === 1);

  return (
    <section
      aria-labelledby="demo-listings-title"
      className="mx-auto w-full max-w-[1240px] px-3 pb-2 pt-5 sm:px-5 sm:pt-7 lg:px-8"
    >
      <div className="overflow-hidden rounded-[1.4rem] border border-market-silver-line bg-[linear-gradient(180deg,#ffffff_0%,#f3f7fb_100%)] py-3.5 shadow-[0_14px_34px_rgb(3_19_41/0.10)] sm:rounded-[1.8rem] sm:py-5">
        <div className="mb-3 flex items-end justify-between gap-3 px-3.5 sm:mb-4 sm:px-5">
          <div>
            <p className="inline-flex items-center gap-1 text-[9px] font-black text-market-navy-soft sm:text-[10px]">
              <Sparkles className="size-3.5" aria-hidden />
              {locale === "ar" ? "إعلانات گحيل" : "Gohail listings"}
            </p>
            <h2
              id="demo-listings-title"
              className="mt-0.5 text-[17px] font-black tracking-tight text-market-navy sm:text-xl"
            >
              {locale === "ar" ? "كل شوي بتلاقي شي" : "Always something new"}
            </h2>
            <p className="mt-0.5 text-[9px] font-medium text-market-silver-muted sm:text-[10px]">
              {locale === "ar"
                ? "نماذج تجريبية للعرض فقط — الإعلانات الحقيقية تظهر في القائمة أسفلها."
                : "Demo previews only — live listings appear in the feed below."}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-market-navy px-2.5 py-1 text-[8px] font-black text-white sm:text-[9px]">
            {DEMO_LISTINGS.length} {locale === "ar" ? "نموذجًا" : "demos"}
          </span>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          <ListingRail listings={firstRow} direction={1} locale={locale} />
          <ListingRail listings={secondRow} direction={-1} locale={locale} />
        </div>
      </div>
    </section>
  );
}

function ListingRail({
  listings,
  direction,
  locale,
}: {
  listings: DemoListing[];
  direction: -1 | 1;
  locale: "ar" | "en";
}) {
  const { railRef, interactionProps } = useAutoLoopRail(direction, direction === 1 ? 11 : 9);
  const language = locale === "ar" ? "ar" : "en";
  const loopingListings = Array.from({ length: 3 }, () => listings).flat();

  return (
    <div
      ref={railRef}
      dir="ltr"
      {...interactionProps}
      className="flex w-full gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3.5 py-0.5 touch-pan-x select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5"
    >
      {loopingListings.map((listing, index) => {
        const duplicate = Math.floor(index / listings.length) !== 1;
        return (
          <Link
            key={`${listing.id}-${index}`}
            to="/search"
            search={listing.search}
            aria-hidden={duplicate ? true : undefined}
            tabIndex={duplicate ? -1 : undefined}
            className="group/listing w-[164px] shrink-0 overflow-hidden rounded-[1.1rem] border border-market-silver-line bg-white shadow-[0_7px_18px_rgb(3_19_41/0.10)] transition duration-300 hover:-translate-y-1 hover:border-market-navy/25 hover:shadow-[0_12px_26px_rgb(3_19_41/0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-navy sm:w-[190px] sm:rounded-[1.25rem]"
          >
            <div className="relative h-[88px] overflow-hidden bg-market-panel-soft sm:h-[104px]">
              <img
                src={compactImage(listing.image)}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition duration-700 group-hover/listing:scale-[1.06]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-[#240046]/66 via-transparent to-transparent" />
              <span className="absolute start-2 top-2 rounded-full border border-white/20 bg-[#240046]/82 px-2 py-1 text-[7px] font-black text-white backdrop-blur sm:text-[8px]">
                {language === "ar" ? "تجريبي" : "Demo"}
              </span>
              <span className="absolute bottom-2 start-2 max-w-[80%] truncate rounded-full bg-white/92 px-2 py-1 text-[7px] font-black text-market-navy sm:text-[8px]">
                {listing.category[language]}
              </span>
            </div>
            <div className="p-2.5" dir={locale === "ar" ? "rtl" : "ltr"}>
              <h3 className="line-clamp-2 min-h-[2.5em] text-[10px] font-black leading-[1.28] text-market-navy sm:text-[11px]">
                {listing.title[language]}
              </h3>
              <p className="num mt-1.5 truncate text-[9px] font-black text-market-navy-soft sm:text-[10px]">
                {listing.price[language]}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[8px] font-bold text-market-silver-muted sm:text-[9px]">
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{listing.city[language]}</span>
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
