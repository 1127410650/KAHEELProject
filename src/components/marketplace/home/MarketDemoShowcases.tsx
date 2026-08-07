import { Link } from "@tanstack/react-router";
import { Layers3 } from "lucide-react";

import { useI18n } from "@/i18n";
import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";

function compactWorldImage(source: string) {
  return source.replace(/w=\d+/, "w=520").replace(/q=\d+/, "q=80");
}

/**
 * Static world grid. The previous infinite marquee duplicated every item and
 * clipped Arabic names during motion; wrapping the real items into rows keeps
 * every label complete and removes continuous animation from the home screen.
 */
export function MarketDemoShowcases() {
  const { locale } = useI18n();

  return (
    <section
      id="store-worlds"
      aria-labelledby="store-worlds-title"
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-3 pb-1 pt-2 sm:px-5 sm:pt-3 lg:px-8"
    >
      <div className="rounded-[1.05rem] border border-market-silver-line bg-market-panel px-2.5 pb-2.5 pt-2.5 shadow-[0_7px_20px_rgb(0_0_0/0.16)] sm:rounded-[1.3rem] sm:px-3.5 sm:pb-3.5 sm:pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[8px] font-black text-market-electric-bright sm:text-[9px]">
              {locale === "ar" ? "عوالم كَحيل" : "Kaheel worlds"}
            </p>
            <h2
              id="store-worlds-title"
              className="mt-0.5 text-[13px] font-black tracking-tight text-market-silver sm:text-[15px]"
            >
              {locale === "ar" ? "اختر عالمك" : "Choose your world"}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[8px] font-bold text-muted-foreground sm:text-[9px]">
            <Layers3 className="size-3.5 text-market-electric-bright" aria-hidden />
            {DEMO_STORE_WORLDS.length} {locale === "ar" ? "عوالم" : "worlds"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 sm:gap-2">
          {DEMO_STORE_WORLDS.map((world) => (
            <Link
              key={world.id}
              to="/demo-stores/$worldId"
              params={{ worldId: world.id }}
              className="group/world relative isolate min-h-[72px] min-w-0 overflow-hidden rounded-xl border border-white/10 bg-market-panel-soft text-white shadow-[0_5px_14px_rgb(0_0_0/0.20)] transition duration-300 hover:-translate-y-0.5 hover:border-white/35 hover:shadow-[0_9px_20px_rgb(0_0_0/0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-market-electric sm:min-h-[82px]"
            >
              <img
                src={compactWorldImage(world.image)}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover transition duration-500 ease-out group-hover/world:scale-[1.06]"
              />
              <span
                className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/25 to-black/5 transition duration-300 group-hover/world:from-black/80"
                aria-hidden
              />
              <span className="relative flex min-h-[72px] flex-col justify-end px-2.5 py-2 sm:min-h-[82px] sm:px-3">
                <span className="block whitespace-normal text-[10px] font-black leading-[1.25] drop-shadow-md sm:text-[11px]">
                  {world.title}
                </span>
                <span className="mt-0.5 block text-[7px] font-bold text-white/75 drop-shadow sm:text-[8px]">
                  {world.stores.length} {locale === "ar" ? "متاجر" : "stores"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
