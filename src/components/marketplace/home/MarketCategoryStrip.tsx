import { useLayoutEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import { PRIMARY_FIELDS, fieldSearchParams, isFieldActive } from "@/lib/market-primary-navigation";

/**
 * One uninterrupted category rail inside the sticky marketplace header.
 * Items keep their natural width, so no label is clipped or removed at any
 * breakpoint. Touch, trackpad and desktop arrow controls all move the same rail.
 */
export function MarketCategoryStrip() {
  const { t, locale, dir } = useI18n();
  const railRef = useRef<HTMLElement | null>(null);
  const homeRef = useRef<HTMLAnchorElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
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
    const rail = railRef.current;
    const header = rail?.closest("header");
    header?.classList.add("market-home-header");

    const measure = () => {
      if (!rail) return;
      setOverflowing(rail.scrollWidth > rail.clientWidth + 2);
    };
    const alignHome = () => {
      homeRef.current?.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: dir === "rtl" ? "end" : "start",
      });
    };

    const frame = window.requestAnimationFrame(() => {
      measure();
      alignHome();
    });
    const observer =
      typeof ResizeObserver !== "undefined" && rail ? new ResizeObserver(measure) : null;
    if (rail) observer?.observe(rail);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      header?.classList.remove("market-home-header");
    };
  }, [dir]);

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const logicalDirection = dir === "rtl" ? -direction : direction;
    rail.scrollBy({
      left: logicalDirection * Math.max(260, rail.clientWidth * 0.72),
      behavior: "smooth",
    });
  };

  const chipClass =
    "flex h-8 min-w-max shrink-0 snap-start items-center justify-center gap-1.5 rounded-full border px-3.5 text-[10px] font-semibold leading-none transition-colors sm:h-9 sm:px-4 sm:text-[11px] lg:h-10 lg:px-5 lg:text-xs";
  const idle =
    "border-market-silver/70 bg-market-navy text-market-navy-foreground/95 hover:border-market-silver hover:bg-market-navy-soft";
  const active =
    "border-market-silver bg-market-navy-soft font-bold text-market-navy-foreground shadow-inner";
  const StartIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const EndIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="w-full border-t border-white/12 bg-market-navy text-market-navy-foreground">
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
          scroll-padding-inline: 8px;
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

      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-2 px-2 pb-2 pt-0.5 sm:px-3 sm:pb-2.5 lg:px-5">
        {overflowing ? (
          <button
            type="button"
            onClick={() => scrollRail(-1)}
            aria-label={locale === "ar" ? "التصنيفات السابقة" : "Previous categories"}
            className="hidden size-9 shrink-0 place-items-center rounded-full border border-market-silver/70 bg-market-navy-soft text-market-navy-foreground transition hover:bg-market-silver hover:text-market-navy md:grid"
          >
            <StartIcon className="size-4" aria-hidden />
          </button>
        ) : null}

        <nav
          ref={railRef}
          dir={dir}
          aria-label={t("market.home.strip.label")}
          className="market-category-rail flex min-w-0 flex-1 snap-x snap-proximity items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-2 touch-pan-x select-none sm:gap-2.5 sm:px-3"
        >
          {PRIMARY_FIELDS.map((field) => {
            const label = t(`market.fields.${field.id}`);

            if (field.kind === "home") {
              return (
                <Link ref={homeRef} key={field.id} to="/" className={`${chipClass} ${idle}`}>
                  <Home className="size-3.5 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            }

            if (field.kind === "more") {
              return (
                <Link key={field.id} to="/more" className={`${chipClass} ${idle}`}>
                  <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{label}</span>
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
                  key={field.id}
                  to="/services"
                  aria-current={on ? "page" : undefined}
                  className={`${chipClass} ${on ? active : idle}`}
                  lang={locale}
                >
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            }

            const on = isFieldActive(field, current);
            return (
              <Link
                key={field.id}
                to="/search"
                search={{ ...kept, ...fieldSearchParams(field) }}
                aria-current={on ? "page" : undefined}
                className={`${chipClass} ${on ? active : idle}`}
                lang={locale}
              >
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
          <span aria-hidden className="w-0.5 shrink-0" />
        </nav>

        {overflowing ? (
          <button
            type="button"
            onClick={() => scrollRail(1)}
            aria-label={locale === "ar" ? "التصنيفات التالية" : "Next categories"}
            className="hidden size-9 shrink-0 place-items-center rounded-full border border-market-silver/70 bg-market-navy-soft text-market-navy-foreground transition hover:bg-market-silver hover:text-market-navy md:grid"
          >
            <EndIcon className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
