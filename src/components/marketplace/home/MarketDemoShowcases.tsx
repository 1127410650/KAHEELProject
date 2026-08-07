import { Link } from "@tanstack/react-router";
import { Layers3 } from "lucide-react";

import { useI18n } from "@/i18n";
import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";
import { useAutoLoopRail } from "@/components/marketplace/home/useAutoLoopRail";

function compactWorldImage(source: string) {
  return source.replace(/w=\d+/, "w=520").replace(/q=\d+/, "q=80");
}

/**
 * Two compact, independently swipeable world rows. The first moves left and
 * the second right; touching one pauses only that row before it resumes.
 */
export function MarketDemoShowcases() {
  const { locale } = useI18n();
  const firstRow = DEMO_STORE_WORLDS.filter((_, index) => index % 2 === 0);
  const secondRow = DEMO_STORE_WORLDS.filter((_, index) => index % 2 === 1);

  return (
    <section
      id="store-worlds"
      aria-labelledby="store-worlds-title"
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-3 pb-1 pt-2 sm:px-5 sm:pt-3 lg:px-8"
    >
      <div className="overflow-hidden rounded-[1.05rem] border border-market-silver-line bg-white px-0 pb-2.5 pt-2.5 shadow-[0_7px_20px_rgb(8_35_70/0.10)] sm:rounded-[1.3rem] sm:pb-3 sm:pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 px-2.5 sm:px-3.5">
            <p className="text-[8px] font-black text-market-navy-soft sm:text-[9px]">
              {locale === "ar" ? "عوالم كَحيل" : "Kaheel worlds"}
            </p>
            <h2
              id="store-worlds-title"
              className="mt-0.5 text-[13px] font-black tracking-tight text-market-navy sm:text-[15px]"
            >
              {locale === "ar" ? "اختر عالمك" : "Choose your world"}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 px-2.5 text-[8px] font-bold text-market-silver-muted sm:px-3.5 sm:text-[9px]">
            <Layers3 className="size-3.5 text-market-navy-soft" aria-hidden />
            {DEMO_STORE_WORLDS.length} {locale === "ar" ? "عوالم" : "worlds"}
          </span>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <WorldRail worlds={firstRow} direction={1} locale={locale} />
          <WorldRail worlds={secondRow} direction={-1} locale={locale} />
        </div>
      </div>
    </section>
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
  const { railRef, interactionProps } = useAutoLoopRail(direction, 12);
  const loopingWorlds = Array.from({ length: 3 }, () => worlds).flat();

  return (
    <div
      ref={railRef}
      dir="ltr"
      {...interactionProps}
      className="flex w-full gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2.5 py-0.5 touch-pan-x select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:px-3.5"
    >
      {loopingWorlds.map((world, index) => (
        <Link
          key={`${world.id}-${index}`}
          to="/demo-stores/$worldId"
          params={{ worldId: world.id }}
          aria-hidden={Math.floor(index / worlds.length) !== 1 ? true : undefined}
          tabIndex={Math.floor(index / worlds.length) !== 1 ? -1 : undefined}
          className="group/world relative isolate h-[64px] w-[116px] shrink-0 overflow-hidden rounded-[0.85rem] border border-market-navy/10 bg-market-navy text-white shadow-[0_4px_12px_rgb(8_35_70/0.16)] transition duration-300 hover:-translate-y-0.5 hover:border-market-navy/35 hover:shadow-[0_7px_16px_rgb(8_35_70/0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-navy sm:h-[72px] sm:w-[136px]"
        >
          <img
            src={compactWorldImage(world.image)}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition duration-500 ease-out group-hover/world:scale-[1.05]"
          />
          <span
            className="absolute inset-0 bg-gradient-to-t from-market-navy/95 via-market-navy/26 to-transparent"
            aria-hidden
          />
          <span
            className="relative flex h-full flex-col justify-end px-2 py-1.5"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <span className="block line-clamp-1 text-[9px] font-black leading-tight drop-shadow-sm sm:text-[10px]">
              {world.title}
            </span>
            <span className="mt-0.5 block text-[7px] font-bold text-white/82 sm:text-[8px]">
              {world.stores.length} {locale === "ar" ? "متاجر" : "stores"}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
