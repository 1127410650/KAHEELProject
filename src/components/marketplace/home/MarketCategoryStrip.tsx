import { useLayoutEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import { PRIMARY_FIELDS, fieldSearchParams, isFieldActive } from "@/lib/market-primary-navigation";
import { useAutoLoopRail } from "@/components/marketplace/home/useAutoLoopRail";

/**
 * A continuous row of compact category circles. Three identical groups make
 * the loop seamless while the native rail stays swipeable on touch screens.
 */
export function MarketCategoryStrip() {
  const { t, locale, dir } = useI18n();
  const headerMarkerRef = useRef<HTMLDivElement | null>(null);
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

  useLayoutEffect(() => {
    const header = headerMarkerRef.current?.closest("header");
    header?.classList.add("market-home-header");
    return () => {
      header?.classList.remove("market-home-header");
    };
  }, []);

  const chipClass =
    "flex size-[58px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-full border px-1.5 text-center text-[8px] font-black leading-[1.15] transition duration-300 sm:size-[64px] sm:text-[9px] lg:size-[68px] lg:text-[10px]";
  const idle =
    "border-white/55 bg-white text-market-navy shadow-[0_4px_14px_rgb(8_35_70/0.16)] hover:-translate-y-0.5 hover:border-white";
  const active =
    "border-white bg-market-navy-soft text-white shadow-[0_4px_16px_rgb(255_255_255/0.18)]";
  const loopingFields = Array.from({ length: 3 }, () => PRIMARY_FIELDS).flat();

  return (
    <div
      ref={headerMarkerRef}
      className="w-full border-t border-white/18 bg-market-navy text-market-navy-foreground"
    >
      <style>{`
        .market-home-header > div:first-child {
          min-height: 52px;
          padding-inline: 16px;
          padding-block: 6px;
          gap: 6px;
        }
        .market-home-header > div:first-child > a:first-child {
          padding-inline: 4px;
          padding-block: 3px;
        }
        .market-home-header > div:first-child > a:first-child span {
          font-size: 15px;
          line-height: 1;
        }
        .market-home-header > div:first-child > a:nth-of-type(2) {
          height: 36px;
          padding-inline: 12px;
          font-size: 11px;
        }
        .market-home-header > div:first-child > div:last-child a {
          height: 32px;
          padding-inline: 10px;
          font-size: 11px;
        }
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
        @media (min-width: 640px) {
          .market-home-header > div:first-child {
            min-height: 56px;
            padding-inline: 20px;
            padding-block: 7px;
          }
          .market-home-header > div:first-child > a:nth-of-type(2) {
            height: 40px;
            padding-inline: 16px;
            font-size: 12px;
          }
        }
        @media (min-width: 1024px) {
          .market-home-header > div:first-child {
            padding-inline: 32px;
          }
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
                  <Home className="size-3.5 shrink-0 sm:size-4" aria-hidden />
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
                  <LayoutGrid className="size-3.5 shrink-0 sm:size-4" aria-hidden />
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
