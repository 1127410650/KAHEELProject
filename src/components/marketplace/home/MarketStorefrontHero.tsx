import { Link } from "@tanstack/react-router";
import {
  Building2,
  CarFront,
  Check,
  MessageCircleMore,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";

type Language = "ar" | "en";

type QuickLink = {
  key: string;
  icon: LucideIcon;
  label: Record<Language, string>;
  search: Record<string, string>;
};

const QUICK_LINKS: QuickLink[] = [
  {
    key: "property",
    icon: Building2,
    label: { ar: "عقارات", en: "Property" },
    search: { category: "real-estate" },
  },
  {
    key: "cars",
    icon: CarFront,
    label: { ar: "سيارات", en: "Cars" },
    search: { q: "car" },
  },
  {
    key: "devices",
    icon: Smartphone,
    label: { ar: "أجهزة", en: "Devices" },
    search: { q: "device" },
  },
  {
    key: "stores",
    icon: Store,
    label: { ar: "متاجر", en: "Stores" },
    search: { q: "store" },
  },
];

type TickerItem = {
  key: string;
  icon: LucideIcon;
  label: Record<Language, string>;
  tone: string;
};

const TICKER_ITEMS: TickerItem[] = [
  {
    key: "fresh",
    icon: Sparkles,
    label: { ar: "إعلانات جديدة", en: "Fresh listings" },
    tone: "from-[#0144fd] to-[#012bea] shadow-[#0144fd]/30",
  },
  {
    key: "stores",
    icon: Store,
    label: { ar: "متاجر محلية", en: "Local stores" },
    tone: "from-[#2f5cff] to-[#0c228a] shadow-[#2f5cff]/25",
  },
  {
    key: "contact",
    icon: MessageCircleMore,
    label: { ar: "تواصل مباشر", en: "Direct contact" },
    tone: "from-[#416dff] to-[#10266f] shadow-[#416dff]/25",
  },
  {
    key: "property",
    icon: Building2,
    label: { ar: "عقارات مختارة", en: "Selected property" },
    tone: "from-[#013af8] to-[#08185f] shadow-[#013af8]/25",
  },
  {
    key: "cars",
    icon: CarFront,
    label: { ar: "سوق السيارات", en: "Car market" },
    tone: "from-[#244df1] to-[#0f194f] shadow-[#244df1]/25",
  },
  {
    key: "devices",
    icon: Smartphone,
    label: { ar: "أجهزة وتقنية", en: "Devices and tech" },
    tone: "from-[#6080ff] to-[#18389f] shadow-[#6080ff]/25",
  },
];

const HERO_COPY: Record<
  Language,
  { eyebrow: string; title: string; body: string; search: string; hint: string }
> = {
  ar: {
    eyebrow: "سوق كَحيل — كل شيء يتحرّك معك",
    title: "اكتشف السوق بطريقة أسرع وأذكى",
    body: "عقارات وسيارات وأجهزة ومتاجر وخدمات؛ ابحث وتواصل من مكان واحد.",
    search: "ابحث عمّا تحتاجه…",
    hint: "بحث سريع داخل كَحيل",
  },
  en: {
    eyebrow: "Kaheel marketplace — everything moves with you",
    title: "Discover the market, faster and smarter",
    body: "Property, cars, devices, stores and services — search and connect in one place.",
    search: "Search for what you need…",
    hint: "Fast search across Kaheel",
  },
};

/**
 * An original, CSS-only marketplace opening inspired by the supplied reference's
 * electric-blue depth and restrained motion. No external video, borrowed asset,
 * timer, or scroll listener is needed, so the first viewport stays lightweight.
 */
export function MarketStorefrontHero() {
  const { locale, t } = useI18n();
  const language: Language = locale === "ar" ? "ar" : "en";
  const copy = HERO_COPY[language];

  return (
    <section className="market-motion-home mx-auto w-full max-w-[1240px] px-3 pb-1 pt-2 sm:px-5 sm:pt-3 lg:px-8">
      <div
        data-testid="kaheel-home-hero"
        className="kaheel-space-hero relative isolate overflow-hidden rounded-[1.35rem] border border-market-silver-line/70 bg-market-void text-market-silver shadow-[0_18px_58px_rgb(1_20_105/0.26)] sm:rounded-[1.85rem]"
      >
        <span className="kaheel-space-grid" aria-hidden />
        <span className="kaheel-space-glow kaheel-space-glow-start" aria-hidden />
        <span className="kaheel-space-glow kaheel-space-glow-end" aria-hidden />

        <div className="relative grid min-h-[318px] items-center gap-3 px-4 py-4 sm:min-h-[350px] sm:px-6 sm:py-6 md:min-h-[420px] md:grid-cols-[1.05fr_0.95fr] md:gap-5 lg:min-h-[440px] lg:px-9 lg:py-8">
          <div className="relative z-10 min-w-0 md:max-w-[36rem]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-white/8 px-2.5 py-1 text-[8px] font-black text-market-silver backdrop-blur-md sm:px-3 sm:py-1.5 sm:text-[10px]">
              <Sparkles className="size-3.5 text-market-electric" aria-hidden />
              {copy.eyebrow}
            </span>

            <h1 className="mt-2.5 max-w-[22ch] text-balance text-[1.65rem] font-black leading-[1.12] tracking-[-0.035em] text-white sm:mt-3 sm:text-[2.35rem] lg:text-[3rem]">
              {copy.title}
            </h1>
            <p className="mt-2 line-clamp-2 max-w-[35rem] text-[10px] leading-5 text-market-silver-muted sm:mt-2.5 sm:text-[13px] sm:leading-6">
              {copy.body}
            </p>

            <Link
              to="/search"
              search={{}}
              aria-label={t("market.nav.search")}
              data-testid="mkt-home-search"
              className="group mt-3 flex min-h-12 w-full max-w-[39rem] items-center gap-2 rounded-full border border-white/14 bg-market-panel/95 py-1 pe-1 ps-3.5 text-start shadow-[0_12px_30px_rgb(0_0_0/0.30)] backdrop-blur-xl transition hover:border-market-electric/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-electric sm:mt-4 sm:min-h-14 sm:ps-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-white/92 sm:text-sm">
                  {copy.search}
                </span>
                <span className="mt-0.5 hidden text-[9px] text-market-silver-muted min-[360px]:block sm:text-[10px]">
                  {copy.hint}
                </span>
              </span>
              <SlidersHorizontal
                className="size-[18px] shrink-0 text-market-silver-muted transition group-hover:text-white"
                aria-hidden
              />
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-market-electric text-white shadow-[0_8px_24px_rgb(1_68_253/0.42)] transition group-hover:bg-market-electric-dark sm:size-12">
                <Search className="size-[18px] sm:size-5" aria-hidden />
              </span>
            </Link>

            <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:mt-3 sm:max-w-[39rem] sm:gap-2">
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;
                const search =
                  item.key === "cars"
                    ? { q: language === "ar" ? "سيارة" : "car" }
                    : item.key === "devices"
                      ? { q: language === "ar" ? "جهاز" : "device" }
                      : item.key === "stores"
                        ? { q: language === "ar" ? "متجر" : "store" }
                        : item.search;

                return (
                  <Link
                    key={item.key}
                    to="/search"
                    search={search}
                    className="group/quick flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.055] px-1 py-1.5 text-center text-[8px] font-black text-market-silver-muted backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-market-electric/55 hover:bg-market-electric/12 hover:text-white sm:flex-row sm:gap-1.5 sm:rounded-2xl sm:px-2.5 sm:py-2 sm:text-[10px]"
                  >
                    <Icon
                      className="size-4 shrink-0 text-market-electric-bright transition group-hover/quick:text-white"
                      aria-hidden
                    />
                    <span className="truncate">{item.label[language]}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div
            className="kaheel-orbit-stage relative mx-auto hidden h-[310px] w-full max-w-[390px] self-center md:block lg:h-[330px] lg:max-w-[420px]"
            aria-hidden
          >
            <span className="kaheel-orbit-ring kaheel-orbit-ring-outer" />
            <span className="kaheel-orbit-ring kaheel-orbit-ring-inner" />
            <span className="kaheel-orbit-beam" />

            <span className="kaheel-orbit-core">
              <span className="kaheel-orbit-core-mark">كَحيل</span>
              <ShoppingBag className="size-7 sm:size-9" strokeWidth={1.7} />
            </span>

            <MotionCard
              className="kaheel-orbit-card-property"
              icon={Building2}
              label={language === "ar" ? "عقار جديد" : "New property"}
            />
            <MotionCard
              className="kaheel-orbit-card-car"
              icon={CarFront}
              label={language === "ar" ? "سيارة" : "Car"}
            />
            <MotionCard
              className="kaheel-orbit-card-store"
              icon={Store}
              label={language === "ar" ? "متجر" : "Store"}
            />
            <span className="kaheel-orbit-success">
              <Check className="size-3.5" />
              {language === "ar" ? "تم التواصل" : "Connected"}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-2 overflow-hidden rounded-[1.15rem] border border-market-silver-line bg-market-panel px-1 py-1 shadow-[0_10px_28px_rgb(0_0_0/0.20)] sm:mt-3 sm:rounded-[1.45rem] sm:px-1.5 sm:py-1.5">
        <p className="sr-only">{TICKER_ITEMS.map((item) => item.label[language]).join("، ")}</p>
        <span
          aria-hidden
          className="absolute -top-8 start-[18%] size-16 rounded-full bg-market-electric/18 blur-2xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-8 end-[15%] size-16 rounded-full bg-market-electric-bright/12 blur-2xl"
        />
        <div
          aria-hidden
          dir={language === "ar" ? "rtl" : "ltr"}
          className="kahli-home-ticker relative flex w-max items-center gap-2 py-1 text-[10px] font-black text-market-silver sm:gap-2.5 sm:py-1.5 sm:text-[11px]"
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => {
            const Icon = item.icon;

            return (
              <span
                key={`${item.key}-${index}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] py-1 pe-3 ps-1 shadow-[0_5px_16px_rgb(0_0_0/0.18)] backdrop-blur-sm sm:gap-2.5 sm:py-1.5 sm:pe-4 sm:ps-1.5"
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
          className="pointer-events-none absolute inset-y-0 start-0 w-9 bg-gradient-to-r from-market-panel via-market-panel/90 to-transparent sm:w-16 rtl:bg-gradient-to-l"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 w-9 bg-gradient-to-l from-market-panel via-market-panel/90 to-transparent sm:w-16 rtl:bg-gradient-to-r"
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
          animation: kahli-home-ticker-ltr 24s linear infinite;
        }
        .kahli-home-ticker:dir(rtl) {
          animation: kahli-home-ticker-rtl 24s linear infinite;
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

function MotionCard({
  className,
  icon: Icon,
  label,
}: {
  className: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className={`kaheel-orbit-card ${className}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-market-electric text-white shadow-[0_6px_18px_rgb(1_68_253/0.36)]">
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <span className="whitespace-nowrap text-[9px] font-black text-white sm:text-[10px]">
        {label}
      </span>
    </span>
  );
}
