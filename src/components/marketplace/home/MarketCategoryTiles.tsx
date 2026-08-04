import { Link } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import catRealEstate from "@/assets/market/cat-real-estate.jpg";
import catCars from "@/assets/market/cat-cars.jpg";
import catDevices from "@/assets/market/cat-devices.jpg";
import catHomeServices from "@/assets/market/cat-home-services.jpg";
import catEquipment from "@/assets/market/cat-equipment.jpg";
import catSuppliers from "@/assets/market/cat-suppliers.jpg";
import catSchools from "@/assets/market/cat-schools.jpg";

/** Every tile links to a real `/search` query, mapped to the live taxonomy. */
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
    <section className="mx-auto w-full max-w-[1240px] px-4 lg:px-6 py-5 sm:py-7">
      <h2 className="mb-3 text-base font-bold tracking-tight text-foreground sm:text-lg">
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
              className="group relative overflow-hidden rounded-2xl border border-border bg-card"
            >
              <img
                src={tile.image}
                alt=""
                loading="lazy"
                width={768}
                height={576}
                className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-36"
              />
              <div className="absolute inset-x-0 bottom-0 bg-market-navy/85 px-3 py-2 text-market-navy-foreground">
                <p className="truncate text-xs font-bold sm:text-sm">
                  {t(`market.home.tiles.${tile.key}.title`)}
                </p>
                <p className="truncate text-[11px] text-market-silver sm:text-xs">
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
