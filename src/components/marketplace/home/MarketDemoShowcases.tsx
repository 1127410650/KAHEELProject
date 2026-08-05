import { Link } from "@tanstack/react-router";
import { ArrowLeft, Layers3, Sparkles } from "lucide-react";

import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";

/**
 * The marketplace home exposes categories of demo storefronts, not individual
 * fake stores. Opening a world reveals the multiple demo stores inside it.
 */
export function MarketDemoShowcases() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-3 pb-1 pt-5 sm:px-4 sm:pt-7 lg:px-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            تجارب مصممة لكل نشاط
          </span>
          <h2 className="mt-1 text-lg font-black tracking-tight text-foreground sm:text-2xl">
            اكتشف عوالم المتاجر
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            ادخل العالم المناسب وشاهد داخله عدة متاجر تجريبية بتصاميم وصور ومنتجات مختلفة.
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold text-muted-foreground shadow-sm sm:inline-flex">
          <Layers3 className="size-3.5" aria-hidden />
          {DEMO_STORE_WORLDS.length} عوالم
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {DEMO_STORE_WORLDS.map((world, index) => (
          <Link
            key={world.id}
            to="/demo-stores/$worldId"
            params={{ worldId: world.id }}
            className={`group relative isolate min-h-52 overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-br ${world.gradient} text-white shadow-panel transition duration-300 hover:-translate-y-1 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-60`}
          >
            <img
              src={world.image}
              alt=""
              loading={index < 4 ? "eager" : "lazy"}
              className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" aria-hidden />
            <div
              className={`absolute inset-0 bg-gradient-to-br ${world.gradient} opacity-25 mix-blend-color`}
              aria-hidden
            />
            <div className="relative flex h-full min-h-52 flex-col justify-end p-3.5 sm:min-h-60 sm:p-4">
              <span className="mb-auto w-fit rounded-full border border-white/25 bg-black/20 px-2 py-1 text-[9px] font-bold text-white/90 backdrop-blur-md sm:text-[10px]">
                {world.eyebrow}
              </span>
              <h3 className="text-base font-black leading-tight drop-shadow sm:text-xl">{world.title}</h3>
              <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-white/75 sm:text-[11px] sm:leading-5">
                {world.description}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/15 pt-2.5">
                <span className="text-[9px] font-bold text-white/80 sm:text-[10px]">
                  {world.stores.length} متاجر داخلية
                </span>
                <span className="grid size-7 place-items-center rounded-full bg-white text-slate-950 transition group-hover:-translate-x-1">
                  <ArrowLeft className="size-3.5" aria-hidden />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
