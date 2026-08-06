import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CarFront,
  Megaphone,
  MessageCircleMore,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";

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
    badge: { ar: "اختيارات كَحيل", en: "Kaheel picks" },
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

type TickerItem = {
  key: string;
  icon: LucideIcon;
  label: { ar: string; en: string };
  tone: string;
};

const TICKER_ITEMS: TickerItem[] = [
  {
    key: "fresh",
    icon: Megaphone,
    label: { ar: "إعلانات جديدة", en: "Fresh listings" },
    tone: "from-[#8665ff] to-[#4934b9] shadow-[#6f55df]/25",
  },
  {
    key: "stores",
    icon: Store,
    label: { ar: "متاجر محلية", en: "Local stores" },
    tone: "from-[#11a683] to-[#087260] shadow-[#0d9477]/25",
  },
  {
    key: "contact",
    icon: MessageCircleMore,
    label: { ar: "تواصل مباشر", en: "Direct contact" },
    tone: "from-[#f59d2a] to-[#d96b15] shadow-[#e38121]/25",
  },
  {
    key: "property",
    icon: Building2,
    label: { ar: "عقارات مختارة", en: "Selected property" },
    tone: "from-[#3188c9] to-[#185487] shadow-[#2672ac]/25",
  },
  {
    key: "cars",
    icon: CarFront,
    label: { ar: "سوق السيارات", en: "Car market" },
    tone: "from-[#eb5c72] to-[#ad2947] shadow-[#d94864]/25",
  },
  {
    key: "devices",
    icon: Smartphone,
    label: { ar: "أجهزة وتقنية", en: "Devices and tech" },
    tone: "from-[#20a4c2] to-[#12627f] shadow-[#1b8fa9]/25",
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
        data-testid="mkt-home-search"
        className="mb-2.5 flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-start shadow-[0_2px_10px_rgb(15_23_42/0.06)] transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-12 sm:rounded-2xl sm:px-4"
      >
        <Search className="size-[18px] shrink-0 text-market-navy" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:text-sm">
          {t("market.searchPlaceholder")}
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground sm:inline-flex">
          <ShoppingBag className="size-3" aria-hidden />
          {language === "ar" ? "ابحث في كَحيل" : "Search Kaheel"}
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

      <div className="relative mt-2 overflow-hidden rounded-[1.15rem] border border-market-navy/10 bg-[linear-gradient(115deg,#ffffff_0%,#f7f8ff_52%,#f5fbfa_100%)] px-1 py-1 shadow-[0_7px_24px_rgb(15_23_42/0.08)] sm:mt-3 sm:rounded-[1.45rem] sm:px-1.5 sm:py-1.5">
        <p className="sr-only">{TICKER_ITEMS.map((item) => item.label[language]).join("، ")}</p>
        <span
          aria-hidden
          className="absolute -top-7 start-[18%] size-14 rounded-full bg-violet-300/20 blur-2xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-8 end-[15%] size-16 rounded-full bg-emerald-300/20 blur-2xl"
        />
        <div
          aria-hidden
          dir={language === "ar" ? "rtl" : "ltr"}
          className="kahli-home-ticker relative flex w-max items-center gap-2 py-1 text-[10px] font-black text-market-navy sm:gap-2.5 sm:py-1.5 sm:text-[11px]"
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => {
            const Icon = item.icon;

            return (
              <span
                key={`${item.key}-${index}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/90 bg-white/88 py-1 pe-3 ps-1 shadow-[0_3px_12px_rgb(15_23_42/0.07)] backdrop-blur-sm sm:gap-2.5 sm:py-1.5 sm:pe-4 sm:ps-1.5"
              >
                <span
                  className={`kahli-ticker-icon grid size-8 place-items-center rounded-full bg-gradient-to-br text-white shadow-lg ${item.tone} sm:size-9`}
                  style={{ animationDelay: `${(index % TICKER_ITEMS.length) * 180}ms` }}
                >
                  <Icon className="size-4 sm:size-[18px]" strokeWidth={2.1} aria-hidden />
                </span>
                <span className="whitespace-nowrap">{item.label[language]}</span>
              </span>
            );
          })}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-0 w-9 bg-gradient-to-r from-white via-white/88 to-transparent sm:w-16 rtl:bg-gradient-to-l"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 w-9 bg-gradient-to-l from-white via-white/88 to-transparent sm:w-16 rtl:bg-gradient-to-r"
        />
      </div>

      <style>{`
        @keyframes kahli-home-ticker-ltr {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes kahli-home-ticker-rtl {
          from { transform: translateX(0); }
          to { transform: translateX(50%); }
        }
        .kahli-home-ticker:dir(ltr) {
          animation: kahli-home-ticker-ltr 22s linear infinite;
        }
        .kahli-home-ticker:dir(rtl) {
          animation: kahli-home-ticker-rtl 22s linear infinite;
        }
        @keyframes kahli-ticker-icon-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1.5px) scale(1.045); }
        }
        .kahli-ticker-icon {
          animation: kahli-ticker-icon-breathe 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .kahli-home-ticker,
          .kahli-ticker-icon { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
