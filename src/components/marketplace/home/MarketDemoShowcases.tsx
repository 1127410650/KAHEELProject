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

import { useI18n } from "@/i18n";
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

const WORLD_TONES = [
  "from-[#6080ff] to-[#0144fd]",
  "from-[#2f5cff] to-[#0c228a]",
  "from-[#0144fd] to-[#0f194f]",
  "from-[#416dff] to-[#10266f]",
] as const;

function WorldLink({
  world,
  tone,
  duplicate = false,
}: {
  world: (typeof DEMO_STORE_WORLDS)[number];
  tone: string;
  duplicate?: boolean;
}) {
  const WorldIcon = WORLD_ICONS[world.id];

  return (
    <Link
      to="/demo-stores/$worldId"
      params={{ worldId: world.id }}
      tabIndex={duplicate ? -1 : undefined}
      className="group/world w-[54px] min-w-[54px] text-center outline-none sm:w-[70px] sm:min-w-[70px]"
    >
      <div
        className={`relative mx-auto grid size-[46px] place-items-center overflow-visible rounded-full bg-gradient-to-br ${tone} shadow-[0_7px_18px_rgb(1_68_253/0.20)] ring-2 ring-market-panel-soft transition duration-300 group-hover/world:-translate-y-1 group-hover/world:scale-[1.04] group-hover/world:shadow-[0_10px_24px_rgb(1_68_253/0.28)] group-focus-visible/world:-translate-y-1 group-focus-visible/world:ring-market-silver sm:size-[60px]`}
      >
        <span
          className="absolute inset-1.5 rounded-full border border-white/25 bg-[radial-gradient(circle_at_34%_26%,rgba(255,255,255,.30),transparent_42%)]"
          aria-hidden
        />
        <span
          className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-white/75 shadow-[0_0_8px_white]"
          aria-hidden
        />
        <WorldIcon
          className="relative size-5 text-white drop-shadow-md transition duration-300 group-hover/world:scale-110 sm:size-6"
          strokeWidth={1.7}
          aria-hidden
        />
        <span className="absolute -bottom-1 start-1/2 inline-flex min-w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-market-panel bg-market-electric px-1 py-0.5 text-[7px] font-black text-white shadow-sm sm:text-[8px]">
          {world.stores.length}
        </span>
      </div>

      <h3 className="mt-1.5 truncate text-[8px] font-black text-market-silver sm:text-[9px]">
        {world.title}
      </h3>
      <p className="mt-0.5 hidden truncate text-[8px] font-bold text-muted-foreground sm:block">
        {world.shortTitle}
      </p>
    </Link>
  );
}

/** A lively circular world rail placed directly below the storefront ticker. */
export function MarketDemoShowcases() {
  const { dir, locale } = useI18n();

  return (
    <section
      id="store-worlds"
      aria-label={locale === "ar" ? "عوالم التسوق" : "Shopping worlds"}
      className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-3 pb-1 pt-1.5 sm:px-5 sm:pt-2 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-[1.05rem] border border-market-silver-line bg-market-panel px-2 pb-1.5 pt-2 shadow-[0_8px_22px_rgb(0_0_0/0.20)] sm:rounded-[1.4rem] sm:px-3 sm:pb-2 sm:pt-2.5">
        <span
          aria-hidden
          className="absolute -start-10 -top-14 size-36 rounded-full bg-market-electric/22 blur-3xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-16 end-[12%] size-36 rounded-full bg-market-electric-bright/16 blur-3xl"
        />

        <div className="relative mb-1 flex items-center justify-between gap-2 sm:mb-1.5">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 text-[8px] font-black text-market-electric-bright sm:text-[9px]">
              <Sparkles className="size-3" aria-hidden />
              {locale === "ar" ? "عوالم كَحيل" : "Kaheel worlds"}
            </span>
            <h2 className="mt-0.5 truncate text-[13px] font-black tracking-tight text-market-silver sm:text-[15px]">
              {locale === "ar" ? "اختر جوّك وادخل عالمك" : "Pick your vibe and enter your world"}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-market-electric px-1.5 py-0.5 text-[7px] font-black text-white shadow-[0_5px_14px_rgb(1_68_253/0.25)] sm:px-2 sm:text-[8px]">
            <Layers3 className="size-3 text-market-silver" aria-hidden />
            {DEMO_STORE_WORLDS.length} {locale === "ar" ? "عوالم" : "worlds"}
          </span>
        </div>

        <div className="kahli-worlds-viewport group/worlds relative overflow-hidden py-0.5">
          <div
            dir={dir}
            className="kahli-worlds-track flex w-max items-start motion-reduce:translate-x-0"
          >
            <div className="flex shrink-0 items-start gap-2 pe-2 sm:gap-2.5 sm:pe-2.5">
              {DEMO_STORE_WORLDS.map((world, index) => (
                <WorldLink
                  key={world.id}
                  world={world}
                  tone={WORLD_TONES[index % WORLD_TONES.length] ?? WORLD_TONES[0]}
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="flex shrink-0 items-start gap-2 pe-2 sm:gap-2.5 sm:pe-2.5"
            >
              {DEMO_STORE_WORLDS.map((world, index) => (
                <WorldLink
                  key={`copy-${world.id}`}
                  world={world}
                  tone={WORLD_TONES[index % WORLD_TONES.length] ?? WORLD_TONES[0]}
                  duplicate
                />
              ))}
            </div>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 w-8 bg-gradient-to-r from-market-panel to-transparent sm:w-12 rtl:bg-gradient-to-l"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-l from-market-panel to-transparent sm:w-12 rtl:bg-gradient-to-r"
          />
        </div>
      </div>

      <style>{`
        @keyframes kahli-worlds-flow-ltr {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes kahli-worlds-flow-rtl {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(50%, 0, 0); }
        }
        .kahli-worlds-track {
          backface-visibility: hidden;
          transform: translate3d(0, 0, 0);
          will-change: transform;
        }
        .kahli-worlds-track > div {
          backface-visibility: hidden;
        }
        .kahli-worlds-track:dir(ltr) {
          animation: kahli-worlds-flow-ltr 30s linear infinite;
        }
        .kahli-worlds-track:dir(rtl) {
          animation: kahli-worlds-flow-rtl 30s linear infinite;
        }
        .kahli-worlds-viewport:focus-within .kahli-worlds-track {
          animation-play-state: paused;
        }
        @media (hover: hover) and (pointer: fine) {
          .kahli-worlds-viewport:hover .kahli-worlds-track {
            animation-play-state: paused;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .kahli-worlds-viewport { overflow-x: auto; scrollbar-width: none; }
          .kahli-worlds-viewport::-webkit-scrollbar { display: none; }
          .kahli-worlds-track { animation: none !important; }
          .kahli-worlds-track > div[aria-hidden="true"] { display: none; }
        }
      `}</style>
    </section>
  );
}
