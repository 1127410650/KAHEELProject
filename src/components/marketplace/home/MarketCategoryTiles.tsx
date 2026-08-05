import { Link } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import catRealEstate from "@/assets/market/cat-real-estate.jpg";
import catCars from "@/assets/market/cat-cars.jpg";
import catDevices from "@/assets/market/cat-devices.jpg";
import catHomeServices from "@/assets/market/cat-home-services.jpg";
import catEquipment from "@/assets/market/cat-equipment.jpg";
import catSuppliers from "@/assets/market/cat-suppliers.jpg";
import catSchools from "@/assets/market/cat-schools.jpg";

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
    <section className="mx-auto w-full max-w-[1240px] px-4 py-4 sm:px-5 sm:py-6 lg:px-8">
      <h2 className="mb-2.5 text-[16px] font-black tracking-tight text-foreground sm:text-lg">
        {t("market.home.categories")}
      </h2>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {TILES.map((tile) => {
          const search =
            "q" in tile.search
              ? { q: (tile.search as { q: { ar: string; en: string } }).q[locale] }
              : (tile.search as Record<string, string>);

          return (
            <Link
              key={tile.key}
              to="/search"
              search={search}
              className="group relative overflow-hidden rounded-[1.15rem] border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)] last:col-span-2 sm:last:col-span-3"
            >
              <img
                src={tile.image}
                alt=""
                loading="lazy"
                width={768}
                height={576}
                className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] sm:h-36"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-market-navy/92 via-market-navy/10 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-5 text-market-navy-foreground">
                <p className="truncate text-xs font-black sm:text-sm">
                  {t(`market.home.tiles.${tile.key}.title`)}
                </p>
                <p className="truncate text-[10px] text-market-silver/90 sm:text-xs">
                  {t(`market.home.tiles.${tile.key}.desc`)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
