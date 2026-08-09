import { Link } from "@tanstack/react-router";
import { BadgeCheck, Layers3, Sparkles, Star, Store } from "lucide-react";

import { useI18n } from "@/i18n";
import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";
import { useAutoLoopRail } from "@/components/marketplace/home/useAutoLoopRail";

function compactWorldImage(source: string, width = 620) {
  return source.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, "q=80");
}

const DEMO_STORES = DEMO_STORE_WORLDS.flatMap((world) => {
  const store = world.stores[0];
  return store ? [{ world, store }] : [];
});

/**
 * Presentation-only worlds and stores. They are intentionally derived from
 * static in-app data, clearly marked as demos, and never written to Supabase.
 */
export function MarketDemoShowcases() {
  const { locale } = useI18n();
  const firstRow = DEMO_STORE_WORLDS.filter((_, index) => index % 2 === 0);
  const secondRow = DEMO_STORE_WORLDS.filter((_, index) => index % 2 === 1);

  return (
    <>
      <section
        id="store-worlds"
        aria-labelledby="store-worlds-title"
        className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-3 pb-1 pt-3 sm:px-5 sm:pt-4 lg:px-8"
      >
        <div className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/12 bg-[radial-gradient(circle_at_12%_0%,rgba(199,125,255,0.32),transparent_32%),linear-gradient(135deg,#240046_0%,#5a189a_54%,#3c096c_100%)] py-3.5 text-white shadow-[0_18px_46px_rgb(36_0_70/0.24)] sm:rounded-[1.8rem] sm:py-5">
          <div
            className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full border border-white/10 bg-white/[0.035]"
            aria-hidden
          />
          <div className="relative mb-3 flex items-end justify-between gap-3 px-3.5 sm:mb-4 sm:px-5">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1 text-[9px] font-black text-[#b9d1ea] sm:text-[10px]">
                <Sparkles className="size-3" aria-hidden />
                {locale === "ar" ? "عوالم گحيل" : "Gohail worlds"}
              </p>
              <h2
                id="store-worlds-title"
                className="mt-0.5 text-[17px] font-black tracking-tight text-white sm:text-xl"
              >
                {locale === "ar" ? "كل شيء له عالم" : "A world for everything"}
              </h2>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/14 bg-white/[0.08] px-2.5 py-1 text-[9px] font-bold text-white/82 backdrop-blur sm:text-[10px]">
              <Layers3 className="size-3.5 text-[#c8dcf0]" aria-hidden />
              {DEMO_STORE_WORLDS.length} {locale === "ar" ? "عوالم" : "worlds"}
            </span>
          </div>

          <div className="relative space-y-2.5 sm:space-y-3">
            <WorldRail worlds={firstRow} direction={1} locale={locale} />
            <WorldRail worlds={secondRow} direction={-1} locale={locale} />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="demo-stores-title"
        className="mx-auto w-full max-w-[1240px] px-3 pb-2 pt-4 sm:px-5 sm:pt-6 lg:px-8"
      >
        <div className="mb-3 flex items-end justify-between gap-3 px-0.5 sm:mb-4">
          <div>
            <p className="inline-flex items-center gap-1 text-[9px] font-black text-market-navy-soft sm:text-[10px]">
              <Store className="size-3.5" aria-hidden />
              {locale === "ar" ? "متاجر للعرض" : "Store previews"}
            </p>
            <h2
              id="demo-stores-title"
              className="mt-0.5 text-[17px] font-black tracking-tight text-market-navy sm:text-xl"
            >
              {locale === "ar" ? "متاجر فيها كل الحكاية" : "Stores with a story inside"}
            </h2>
          </div>
          <span className="rounded-full border border-market-silver-line bg-white px-2.5 py-1 text-[8px] font-black text-market-silver-muted shadow-sm sm:text-[9px]">
            {locale === "ar" ? "بيانات تجريبية" : "Demo data"}
          </span>
        </div>

        <StoreRail locale={locale} />
      </section>
    </>
  );
}

function WorldRail({
  worlds,
  direction,
  locale,
}: {
  worlds: typeof DEMO_STORE_WORLDS;
  direction: -1 | 1;
  locale: "ar" | "en";
}) {
  const { railRef, interactionProps } = useAutoLoopRail(direction, 13);
  const loopingWorlds = Array.from({ length: 3 }, () => worlds).flat();

  return (
    <div
      ref={railRef}
      dir="ltr"
      {...interactionProps}
      className="flex w-full gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-0.5 touch-pan-x select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5"
    >
      {loopingWorlds.map((world, index) => {
        const duplicate = Math.floor(index / worlds.length) !== 1;
        return (
          <Link
            key={`${world.id}-${index}`}
            to="/demo-stores/$worldId"
            params={{ worldId: world.id }}
            aria-hidden={duplicate ? true : undefined}
            tabIndex={duplicate ? -1 : undefined}
            className="group/world relative isolate h-[86px] w-[154px] shrink-0 overflow-hidden rounded-[1.15rem] border border-white/15 bg-market-navy text-white shadow-[0_10px_24px_rgb(0_0_0/0.26)] transition duration-300 hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_14px_30px_rgb(0_0_0/0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-[100px] sm:w-[180px] lg:h-[108px] lg:w-[194px]"
          >
            <img
              src={compactWorldImage(world.image)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover transition duration-700 ease-out group-hover/world:scale-[1.07]"
            />
            <span
              className="absolute inset-0 bg-gradient-to-t from-[#020b18]/95 via-[#041a35]/28 to-white/[0.06]"
              aria-hidden
            />
            <span
              className="relative flex h-full flex-col justify-end px-3 py-2.5"
              dir={locale === "ar" ? "rtl" : "ltr"}
            >
              <span className="block line-clamp-1 text-[11px] font-black leading-tight drop-shadow sm:text-[13px]">
                {world.title}
              </span>
              <span className="mt-1 block text-[8px] font-bold text-white/78 sm:text-[9px]">
                {world.stores.length} {locale === "ar" ? "متاجر مختارة" : "curated stores"}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function StoreRail({ locale }: { locale: "ar" | "en" }) {
  const { railRef, interactionProps } = useAutoLoopRail(-1, 10);
  const loopingStores = Array.from({ length: 3 }, () => DEMO_STORES).flat();

  return (
    <div
      ref={railRef}
      dir="ltr"
      {...interactionProps}
      className="flex w-full gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-0.5 pb-2 pt-0.5 touch-pan-x select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
    >
      {loopingStores.map(({ world, store }, index) => {
        const duplicate = Math.floor(index / DEMO_STORES.length) !== 1;
        return (
          <Link
            key={`${world.id}-${index}`}
            to="/demo-stores/$worldId"
            params={{ worldId: world.id }}
            aria-hidden={duplicate ? true : undefined}
            tabIndex={duplicate ? -1 : undefined}
            className="group/store relative w-[270px] shrink-0 overflow-hidden rounded-[1.35rem] border border-market-silver-line bg-white shadow-[0_12px_28px_rgb(3_19_41/0.12)] transition duration-300 hover:-translate-y-1 hover:border-market-navy/25 hover:shadow-[0_18px_38px_rgb(3_19_41/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-navy sm:w-[318px] sm:rounded-[1.6rem]"
          >
            <div className="relative h-[78px] overflow-hidden sm:h-[88px]">
              <img
                src={compactWorldImage(world.image, 760)}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition duration-700 group-hover/store:scale-[1.04]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-[#240046]/92 via-[#240046]/28 to-transparent" />
              <span className="absolute start-2.5 top-2.5 rounded-full border border-white/20 bg-[#240046]/78 px-2 py-1 text-[8px] font-black text-white backdrop-blur">
                {locale === "ar" ? "نموذج متجر" : "Demo store"}
              </span>
              <span className="absolute bottom-2.5 end-2.5 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[8px] font-black text-market-navy shadow-sm">
                <Star className="size-3 fill-current" aria-hidden />
                {store.rating}
              </span>
              <div
                className="absolute bottom-2.5 start-2.5 text-white"
                dir={locale === "ar" ? "rtl" : "ltr"}
              >
                <span className="flex items-center gap-1 text-[12px] font-black drop-shadow sm:text-[13px]">
                  {store.name}
                  <BadgeCheck className="size-3.5 text-[#d9e8f6]" aria-hidden />
                </span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3" dir={locale === "ar" ? "rtl" : "ltr"}>
              <div className="grid grid-cols-3 gap-1.5">
                {world.stores.slice(0, 3).map((preview, previewIndex) => (
                  <span
                    key={`${preview.name}-${previewIndex}`}
                    className="relative aspect-[1.12] overflow-hidden rounded-xl bg-market-panel-soft"
                  >
                    <img
                      src={compactWorldImage(preview.image, 300)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition duration-500 group-hover/store:scale-[1.03]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-[#240046]/76 via-transparent to-transparent" />
                    <span className="absolute bottom-1 start-1 max-w-[calc(100%-0.5rem)] truncate rounded-full bg-white/90 px-1.5 py-0.5 text-[6px] font-black text-market-navy sm:text-[7px]">
                      {locale === "ar" ? "إعلان" : "Ad"} {previewIndex + 1}
                    </span>
                  </span>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black text-market-navy sm:text-[11px]">
                    {store.subtitle}
                  </p>
                  <p className="mt-0.5 truncate text-[8px] font-bold text-market-silver-muted sm:text-[9px]">
                    {store.tags.join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-market-navy px-2.5 py-1 text-[8px] font-black text-white sm:text-[9px]">
                  {store.count}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
