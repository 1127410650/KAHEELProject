import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search, ShoppingBag, Sparkles } from "lucide-react";

import { useI18n } from "@/i18n";
import catCars from "@/assets/market/cat-cars.webp";
import catDevices from "@/assets/market/cat-devices.webp";
import catRealEstate from "@/assets/market/cat-real-estate.webp";

type Promo = {
  key: string;
  image: string;
  search: Record<string, string>;
  badge: { ar: string; en: string };
  title: { ar: string; en: string };
  description: { ar: string; en: string };
};

const PROMOS: Promo[] = [
  {
    key: "everything",
    image: catDevices,
    search: {},
    badge: { ar: "اختيارات كحلي", en: "Kahli picks" },
    title: { ar: "كل ما تبحث عنه أقرب", en: "Everything you need, closer" },
    description: {
      ar: "منتجات، أجهزة، متاجر وإعلانات جديدة في مكان واحد.",
      en: "Products, devices, stores and new listings in one place.",
    },
  },
  {
    key: "property",
    image: catRealEstate,
    search: { category: "real-estate" },
    badge: { ar: "عالم العقار", en: "Property world" },
    title: { ar: "بيتك يبدأ من هنا", en: "Your next home starts here" },
    description: {
      ar: "استكشف أحدث العقارات للبيع والإيجار.",
      en: "Explore the latest properties for sale and rent.",
    },
  },
  {
    key: "cars",
    image: catCars,
    search: { category: "cars" },
    badge: { ar: "سوق السيارات", en: "Car market" },
    title: { ar: "اختر سيارتك بثقة", en: "Find your car with confidence" },
    description: {
      ar: "عروض سيارات حديثة من الأفراد والمتاجر.",
      en: "Fresh car offers from people and stores.",
    },
  },
];

/**
 * Fast, CSS-only storefront opening. It borrows the dense retail hierarchy of
 * large commerce apps without copying their branding, assets or controls.
 */
export function MarketStorefrontHero() {
  const { locale, t } = useI18n();
  const language = locale === "ar" ? "ar" : "en";

  return (
    <section className="mx-auto w-full max-w-[1240px] px-3 pb-1 pt-2.5 sm:px-5 sm:pt-4 lg:px-8">
      <Link
        to="/search"
        search={{}}
        aria-label={t("market.nav.search")}
        className="mb-2.5 flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-start shadow-[0_2px_10px_rgb(15_23_42/0.06)] transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-12 sm:rounded-2xl sm:px-4"
      >
        <Search className="size-[18px] shrink-0 text-market-navy" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:text-sm">
          {t("market.searchPlaceholder")}
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground sm:inline-flex">
          <ShoppingBag className="size-3" aria-hidden />
          {language === "ar" ? "ابحث في كحلي" : "Search Kahli"}
        </span>
      </Link>

      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-3">
        {PROMOS.map((promo, index) => (
          <Link
            key={promo.key}
            to="/search"
            search={
              promo.key === "cars" ? { q: language === "ar" ? "سيارة" : "car" } : promo.search
            }
            className="group relative h-[154px] min-w-[86%] snap-center overflow-hidden rounded-2xl bg-market-navy shadow-[0_8px_26px_rgb(15_23_42/0.14)] sm:h-[206px] sm:min-w-0 sm:snap-start"
          >
            <img
              src={promo.image}
              alt=""
              width={768}
              height={576}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "low"}
              decoding="async"
              className="size-full object-cover transition duration-700 group-hover:scale-[1.035]"
            />
            <div
              className="absolute inset-0 bg-gradient-to-l from-market-navy/96 via-market-navy/72 to-market-navy/12"
              aria-hidden
            />
            <div className="absolute inset-0 flex flex-col items-start justify-center p-4 text-white sm:p-5">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[9px] font-black backdrop-blur-sm sm:text-[10px]">
                <Sparkles className="size-3" aria-hidden />
                {promo.badge[language]}
              </span>
              <h1
                className={
                  index === 0
                    ? "mt-2 max-w-[16rem] text-xl font-black leading-tight tracking-tight sm:text-3xl"
                    : "mt-2 max-w-[13rem] text-lg font-black leading-tight tracking-tight sm:text-xl"
                }
              >
                {promo.title[language]}
              </h1>
              <p className="mt-1.5 line-clamp-2 max-w-[17rem] text-[10px] leading-5 text-white/78 sm:text-xs sm:leading-6">
                {promo.description[language]}
              </p>
              <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-market-navy shadow-sm sm:text-xs">
                {language === "ar" ? "تسوّق الآن" : "Explore now"}
                <ArrowLeft className="size-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
