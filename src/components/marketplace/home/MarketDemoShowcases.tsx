import { Link } from "@tanstack/react-router";
import { Layers3, Sparkles } from "lucide-react";

import { DEMO_STORE_WORLDS } from "@/lib/demo-store-worlds";

/** Compact circular world rail. Opening a world reveals its internal demo stores. */
export function MarketDemoShowcases() {
  return (
    <section
      id="store-worlds"
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-4 pb-1 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            تجارب مصممة لكل نشاط
          </span>
          <h2 className="mt-0.5 text-[17px] font-black tracking-tight text-foreground sm:text-xl">
            اكتشف عوالم المتاجر
          </h2>
          <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground sm:text-xs">
            اختر العالم المناسب، ثم استكشف المتاجر الموجودة بداخله.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[9px] font-bold text-muted-foreground shadow-sm sm:text-[10px]">
          <Layers3 className="size-3.5" aria-hidden />
          {DEMO_STORE_WORLDS.length}
        </span>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
        {DEMO_STORE_WORLDS.map((world, index) => (
          <Link
            key={world.id}
            to="/demo-stores/$worldId"
            params={{ worldId: world.id }}
            className="group w-[92px] min-w-[92px] snap-start text-center sm:w-[108px] sm:min-w-[108px]"
          >
            <div
              className={`relative mx-auto size-[84px] rounded-full bg-gradient-to-br ${world.gradient} p-[3px] shadow-[0_8px_24px_rgb(15_23_42/0.16)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_12px_28px_rgb(15_23_42/0.22)] sm:size-[98px]`}
            >
              <div className="relative size-full overflow-hidden rounded-full border-2 border-background bg-muted">
                <img
                  src={world.image}
                  alt=""
                  loading={index < 5 ? "eager" : "lazy"}
                  className="size-full object-cover transition duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/5" aria-hidden />
              </div>
              <span className="absolute -bottom-1.5 start-1/2 inline-flex min-w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background bg-market-navy px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm">
                {world.stores.length}
              </span>
            </div>

            <h3 className="mt-3 truncate text-[11px] font-black text-foreground sm:text-xs">
              {world.title}
            </h3>
            <p className="mt-0.5 truncate text-[8px] font-medium text-muted-foreground sm:text-[9px]">
              {world.shortTitle}
            </p>
          </Link>
        ))}
        <span aria-hidden className="w-1 shrink-0" />
      </div>
    </section>
  );
}
