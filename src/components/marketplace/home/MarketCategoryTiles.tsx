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
    <section
      id="market-categories"
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-4 pb-2 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="mb-2.5">
        <h2 className="text-[16px] font-black tracking-tight text-foreground sm:text-lg">
          {t("market.home.categories")}
        </h2>
        <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
          مرّر أفقيًا واختر المجال الذي تريد تصفحه.
        </p>
      </div>

      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3">
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
              className="group relative h-[104px] w-[148px] min-w-[148px] snap-start overflow-hidden rounded-[1.05rem] border border-border bg-card shadow-[0_4px_14px_rgb(15_23_42/0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(15_23_42/0.13)] sm:h-[118px] sm:w-[176px] sm:min-w-[176px]"
            >
              <img
                src={tile.image}
                alt=""
                loading="lazy"
                width={768}
                height={576}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-market-navy/92 via-market-navy/10 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8 text-market-navy-foreground">
                <p className="truncate text-[11px] font-black sm:text-xs">
                  {t(`market.home.tiles.${tile.key}.title`)}
                </p>
                <p className="mt-0.5 truncate text-[8px] text-market-silver/90 sm:text-[9px]">
                  {t(`market.home.tiles.${tile.key}.desc`)}
                </p>
              </div>
            </Link>
          );
        })}
        <span aria-hidden className="w-1 shrink-0" />
      </div>
    </section>
  );
}
