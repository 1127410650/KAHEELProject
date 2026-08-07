import { useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Armchair,
  BriefcaseBusiness,
  Building2,
  CarFront,
  Code2,
  GraduationCap,
  HandCoins,
  Home,
  LayoutGrid,
  Lightbulb,
  Palette,
  PartyPopper,
  Plane,
  School,
  SearchX,
  Shirt,
  Smartphone,
  Sparkles,
  Trees,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { PRIMARY_FIELDS, fieldSearchParams, isFieldActive } from "@/lib/market-primary-navigation";
import { useAutoLoopRail } from "@/components/marketplace/home/useAutoLoopRail";

const FIELD_ICONS: Record<string, LucideIcon> = {
  home: Home,
  realestate: Building2,
  cars: CarFront,
  devices: Smartphone,
  aqardeal: HandCoins,
  restaurants: Utensils,
  furniture: Armchair,
  services: Wrench,
  fashion: Shirt,
  jobs: BriefcaseBusiness,
  training: GraduationCap,
  schools: School,
  events: PartyPopper,
  programming: Code2,
  gardens: Trees,
  arts: Palette,
  lostfound: SearchX,
  projects: Lightbulb,
  travel: Plane,
  more: LayoutGrid,
};

/**
 * A continuous row of compact category circles. Three identical groups make
 * the loop seamless while the native rail stays swipeable on touch screens.
 */
export function MarketCategoryStrip() {
  const { t, locale, dir } = useI18n();
  const { railRef, interactionProps } = useAutoLoopRail<HTMLElement>(1, 15);
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, string | undefined>,
  });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = { category: search["category"], sub: search["sub"] };
  const kept: Record<string, string> = {};

  for (const key of ["cityId", "sort", "img", "min", "max"]) {
    const value = search[key];
    if (typeof value === "string" && value !== "") kept[key] = value;
  }

  const chipClass =
    "relative flex size-[62px] shrink-0 snap-start flex-col items-center justify-center gap-1 overflow-hidden rounded-full border px-1.5 text-center text-[8px] font-black leading-[1.12] backdrop-blur transition duration-300 after:pointer-events-none after:absolute after:inset-[3px] after:rounded-full after:border after:border-current after:opacity-[0.08] sm:size-[68px] sm:text-[9px] lg:size-[72px] lg:text-[10px]";
  const idle =
    "border-white/80 bg-white/[0.97] text-market-navy shadow-[0_7px_18px_rgb(7_21_47/0.22),inset_0_1px_0_rgb(255_255_255/0.95)] hover:-translate-y-1 hover:border-white hover:bg-white";
  const active =
    "border-white/90 bg-[linear-gradient(145deg,#1671df,#08499a)] text-white shadow-[0_8px_22px_rgb(11_92_197/0.32),inset_0_1px_0_rgb(255_255_255/0.28)]";
  const loopingFields = Array.from({ length: 3 }, () => PRIMARY_FIELDS).flat();

  return (
    <div className="relative w-full overflow-hidden border-t border-white/14 bg-[radial-gradient(circle_at_18%_-45%,rgb(84_160_255/0.48),transparent_39%),linear-gradient(105deg,#07152f_0%,#0b1d43_48%,#0b5cc5_135%)] text-market-navy-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />
      <style>{`
        .market-category-rail {
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-padding-inline: 10px;
        }
        .market-category-rail::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1320px] px-0 pb-2 pt-1 sm:pb-2.5">
        <nav
          ref={railRef}
          dir="ltr"
          aria-label={t("market.home.strip.label")}
          {...interactionProps}
          className="market-category-rail flex w-full snap-x snap-proximity items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 py-1 touch-pan-x select-none sm:gap-2.5 sm:px-3 lg:px-5"
        >
          {loopingFields.map((field, index) => {
            const label = t(`market.fields.${field.id}`);
            const key = `${field.id}-${index}`;
            const Icon = FIELD_ICONS[field.id] ?? Sparkles;
            const duplicate = Math.floor(index / PRIMARY_FIELDS.length) !== 1;
            const accessibilityProps = duplicate
              ? ({ "aria-hidden": true, tabIndex: -1 } as const)
              : {};

            if (field.kind === "home") {
              return (
                <Link
                  key={key}
                  to="/"
                  className={`${chipClass} ${idle}`}
                  lang={locale}
                  {...accessibilityProps}
                >
                  <Icon className="relative z-[1] size-3.5 shrink-0 sm:size-4" aria-hidden />
                  <span className="line-clamp-2 max-w-full" dir={dir}>
                    {label}
                  </span>
                </Link>
              );
            }

            if (field.kind === "more") {
              return (
                <Link
                  key={key}
                  to="/more"
                  className={`${chipClass} ${idle}`}
                  lang={locale}
                  {...accessibilityProps}
                >
                  <Icon className="relative z-[1] size-3.5 shrink-0 sm:size-4" aria-hidden />
                  <span className="line-clamp-2 max-w-full" dir={dir}>
                    {label}
                  </span>
                </Link>
              );
            }

            // Services have a real booking marketplace, not only classified ads.
            // The taxonomy id stays unchanged, while its primary destination is
            // the canonical service directory.
            if (field.id === "services") {
              const on = pathname === "/services" || pathname.startsWith("/services/");
              return (
                <Link
                  key={key}
                  to="/services"
                  aria-current={on ? "page" : undefined}
                  className={`${chipClass} ${on ? active : idle}`}
                  lang={locale}
                  {...accessibilityProps}
                >
                  <Icon className="relative z-[1] size-3.5 shrink-0 sm:size-4" aria-hidden />
                  <span className="line-clamp-2 max-w-full" dir={dir}>
                    {label}
                  </span>
                </Link>
              );
            }

            const on = isFieldActive(field, current);
            return (
              <Link
                key={key}
                to="/search"
                search={{ ...kept, ...fieldSearchParams(field) }}
                aria-current={on ? "page" : undefined}
                className={`${chipClass} ${on ? active : idle}`}
                lang={locale}
                {...accessibilityProps}
              >
                <Icon className="relative z-[1] size-3.5 shrink-0 sm:size-4" aria-hidden />
                <span className="line-clamp-2 max-w-full" dir={dir}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
