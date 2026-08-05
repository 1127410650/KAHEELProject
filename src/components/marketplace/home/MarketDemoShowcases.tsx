import { Link } from "@tanstack/react-router";
import { ArrowLeft, Layers3, Sparkles } from "lucide-react";

import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";

/** The home exposes compact store worlds; each world opens its internal stores. */
export function MarketDemoShowcases() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-4 pb-1 pt-4 sm:px-5 sm:pt-6 lg:px-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            تجارب مصممة لكل نشاط
          </span>
          <h2 className="mt-0.5 text-[17px] font-black tracking-tight text-foreground sm:text-2xl">
            اكتشف عوالم المتاجر
          </h2>
          <p className="mt-0.5 max-w-2xl text-[10px] leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            كل عالم يضم عدة متاجر تجريبية بصور وهوية ومنتجات مختلفة.
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
            className={`group relative isolate aspect-[4/5] overflow-hidden rounded-[1.2rem] border border-white/10 bg-gradient-to-br ${world.gradient} text-white shadow-panel transition duration-300 hover:-translate-y-1 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:aspect-[3/4] sm:rounded-[1.35rem]`}
          >
            <img
              src={world.image}
              alt=""
              loading={index < 4 ? "eager" : "lazy"}
              className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/28 to-black/5" aria-hidden />
            <div className={`absolute inset-0 bg-gradient-to-br ${world.gradient} opacity-20 mix-blend-color`} aria-hidden />

            <div className="relative flex h-full flex-col justify-end p-3 sm:p-3.5">
              <span className="mb-auto w-fit max-w-full truncate rounded-full border border-white/20 bg-black/20 px-2 py-1 text-[8px] font-bold text-white/90 backdrop-blur-md sm:text-[9px]">
                {world.eyebrow}
              </span>
              <h3 className="text-[15px] font-black leading-tight drop-shadow sm:text-lg">{world.title}</h3>
              <p className="mt-1 line-clamp-1 text-[9px] leading-4 text-white/72 sm:text-[10px]">
                {world.description}
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/15 pt-2">
                <span className="text-[8px] font-bold text-white/82 sm:text-[9px]">
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
