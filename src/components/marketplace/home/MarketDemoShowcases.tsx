import { Link } from "@tanstack/react-router";
import {
  Baby,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gem,
  Gift,
  Layers3,
  PawPrint,
  Shirt,
  Sparkles,
  UserRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import { DEMO_STORE_WORLDS, type DemoWorldId } from "@/lib/demo-store-worlds";

const WORLD_ICONS: Record<DemoWorldId, LucideIcon> = {
  women: Shirt,
  men: UserRound,
  kids: Baby,
  games: Gamepad2,
  clubs: Dumbbell,
  restaurants: Utensils,
  cafes: Coffee,
  jewelry: Gem,
  gifts: Gift,
  pets: PawPrint,
};

/** Compact circular world rail. Opening a world reveals its internal demo stores. */
export function MarketDemoShowcases() {
  return (
    <section
      id="store-worlds"
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-3 pb-1 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            متاجر لكل اهتمام
          </span>
          <h2 className="mt-0.5 text-[17px] font-black tracking-tight text-foreground sm:text-xl">
            تسوّق حسب عالمك
          </h2>
          <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground sm:text-xs">
            افتح العالم الذي يناسبك واستكشف متاجره.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[9px] font-bold text-muted-foreground shadow-sm sm:text-[10px]">
          <Layers3 className="size-3.5" aria-hidden />
          {DEMO_STORE_WORLDS.length}
        </span>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
        {DEMO_STORE_WORLDS.map((world) => {
          const WorldIcon = WORLD_ICONS[world.id];

          return (
            <Link
              key={world.id}
              to="/demo-stores/$worldId"
              params={{ worldId: world.id }}
              className="group w-[78px] min-w-[78px] snap-start text-center sm:w-[98px] sm:min-w-[98px]"
            >
              <div
                className={`relative mx-auto grid size-[70px] place-items-center overflow-visible rounded-full bg-gradient-to-br ${world.gradient} shadow-[0_6px_18px_rgb(15_23_42/0.14)] ring-2 ring-background transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_10px_24px_rgb(15_23_42/0.2)] sm:size-[88px]`}
              >
                <span
                  className="absolute inset-2 rounded-full border border-white/20 bg-white/10"
                  aria-hidden
                />
                <WorldIcon
                  className="relative size-7 text-white drop-shadow-md transition duration-300 group-hover:scale-110 sm:size-9"
                  strokeWidth={1.65}
                  aria-hidden
                />
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
          );
        })}
        <span aria-hidden className="w-1 shrink-0" />
      </div>
    </section>
  );
}
