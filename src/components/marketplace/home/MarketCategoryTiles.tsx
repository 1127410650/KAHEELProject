import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import catRealEstate from "@/assets/market/cat-real-estate.webp";
import catCars from "@/assets/market/cat-cars.webp";
import catDevices from "@/assets/market/cat-devices.webp";
import catHomeServices from "@/assets/market/cat-home-services.webp";
import catEquipment from "@/assets/market/cat-equipment.webp";
import catSuppliers from "@/assets/market/cat-suppliers.webp";
import catSchools from "@/assets/market/cat-schools.webp";

const TILES = [
  { key: "realestate", image: catRealEstate, search: { category: "real-estate" } },
  { key: "cars", image: catCars, search: { q: { ar: "سيارة", en: "car" } } },
  { key: "devices", image: catDevices, search: { q: { ar: "جهاز", en: "device" } } },
  { key: "schools", image: catSchools, search: { category: "schools-universities" } },
  { key: "homeServices", image: catHomeServices, search: { category: "maintenance" } },
  { key: "equipment", image: catEquipment, search: { category: "equipment" } },
  { key: "suppliers", image: catSuppliers, search: { category: "factories" } },
] as const;

export function MarketCategoryTiles() {
  const { t, locale } = useI18n();

  return (
    <section
      id="market-categories"
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-3 pb-2 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-black tracking-tight text-foreground sm:text-lg">
            {t("market.home.categories")}
          </h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
            {locale === "ar" ? "تسوّق حسب القسم." : "Shop by category."}
          </p>
        </div>
        <Link
          to="/more"
          className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-black text-primary sm:text-xs"
        >
          {locale === "ar" ? "عرض الكل" : "View all"}
          <ChevronLeft className="size-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-7 sm:gap-3">
        {TILES.map((tile) => {
          const search =
            "q" in tile.search
              ? { q: (tile.search as { q: { ar: string; en: string } }).q[locale] }
              : (tile.search as Record<string, string>);

          return (
            <Link key={tile.key} to="/search" search={search} className="group min-w-0 text-center">
              <div className="relative mx-auto aspect-square w-full max-w-[104px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_3px_12px_rgb(15_23_42/0.07)] transition group-hover:-translate-y-0.5 group-hover:shadow-panel sm:max-w-[124px]">
                <img
                  src={tile.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={256}
                  height={256}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.045]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-market-navy/40 via-transparent to-white/5"
                  aria-hidden
                />
              </div>
              <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[9px] font-black leading-[1.2] text-foreground min-[360px]:text-[10px] sm:text-xs">
                {t(`market.home.tiles.${tile.key}.title`)}
              </p>
              <span className="sr-only">{t(`market.home.tiles.${tile.key}.desc`)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
