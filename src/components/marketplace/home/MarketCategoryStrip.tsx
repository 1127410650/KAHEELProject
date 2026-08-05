import { useLayoutEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  PRIMARY_FIELDS,
  fieldSearchParams,
  isFieldActive,
} from "@/lib/market-primary-navigation";

/** Category row rendered inside MarketHeader as part of one sticky navy block. */
export function MarketCategoryStrip() {
  const { t, locale, dir } = useI18n();
  const railRef = useRef<HTMLElement | null>(null);
  const homeRef = useRef<HTMLAnchorElement | null>(null);
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, string | undefined>,
  });
  const current = { category: search["category"], sub: search["sub"] };
  const kept: Record<string, string> = {};

  for (const key of ["cityId", "sort", "img", "min", "max"]) {
    const value = search[key];
    if (typeof value === "string" && value !== "") kept[key] = value;
  }

  useLayoutEffect(() => {
    const alignHome = () => {
      homeRef.current?.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: dir === "rtl" ? "end" : "start",
      });
    };
    const frame = window.requestAnimationFrame(alignHome);
    window.addEventListener("resize", alignHome);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", alignHome);
    };
  }, [dir]);

  const chipClass =
    "flex h-9 w-full min-w-0 snap-start items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-medium leading-none transition-colors sm:h-10 sm:text-xs";
  const idle =
    "border-market-silver/75 bg-market-navy text-market-navy-foreground/95 hover:bg-market-navy-soft";
  const active =
    "border-market-silver bg-market-navy-soft font-semibold text-market-navy-foreground";

  return (
    <div className="w-full bg-market-navy text-market-navy-foreground">
      <style>{`
        .market-category-rail {
          grid-auto-columns: calc((100% - 18px) / 4);
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .market-category-rail::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        @media (min-width: 640px) {
          .market-category-rail {
            grid-auto-columns: calc((100% - 40px) / 6);
          }
        }
        @media (min-width: 1024px) {
          .market-category-rail {
            grid-auto-columns: calc((100% - 48px) / 7);
          }
        }
      `}</style>

      <nav
        ref={railRef}
        dir={dir}
        aria-label={t("market.home.strip.label")}
        className="market-category-rail mx-auto grid w-full max-w-[1240px] grid-flow-col gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-market-navy px-3 pb-2.5 sm:gap-2 sm:px-4 lg:px-6"
      >
        {PRIMARY_FIELDS.map((field) => {
          const label = t(`market.fields.${field.id}`);

          if (field.kind === "home") {
            return (
              <Link
                ref={homeRef}
                key={field.id}
                to="/"
                className={`${chipClass} ${idle}`}
              >
                <Home className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
              </Link>
            );
          }

          if (field.kind === "more") {
            return (
              <Link
                key={field.id}
                to="/more"
                className={`${chipClass} ${idle}`}
              >
                <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
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
              <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
