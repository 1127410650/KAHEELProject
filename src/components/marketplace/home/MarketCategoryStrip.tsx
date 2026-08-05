import { useEffect, useLayoutEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  PRIMARY_FIELDS,
  fieldSearchParams,
  isFieldActive,
} from "@/lib/market-primary-navigation";

/**
 * Sticky marketplace categories. CSS snap is reinforced with a small runtime
 * snapper because RTL horizontal scrolling behaves differently across Safari,
 * Chrome, and embedded preview browsers.
 */
export function MarketCategoryStrip() {
  const { t, locale, dir } = useI18n();
  const railRef = useRef<HTMLElement | null>(null);
  const homeRef = useRef<HTMLAnchorElement | null>(null);
  const snapTimer = useRef<number | null>(null);
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, string | undefined>,
  });
  const current = { category: search["category"], sub: search["sub"] };
  const kept: Record<string, string> = {};

  for (const key of ["cityId", "sort", "img", "min", "max"]) {
    const value = search[key];
    if (typeof value === "string" && value !== "") kept[key] = value;
  }

  useEffect(() => {
    document.documentElement.classList.add("market-home-scrollbar-hidden");
    return () => document.documentElement.classList.remove("market-home-scrollbar-hidden");
  }, []);

  useLayoutEffect(() => {
    const alignHome = () => {
      homeRef.current?.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: dir === "rtl" ? "end" : "start",
      });
    };

    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(alignHome);
      return () => window.cancelAnimationFrame(second);
    });

    window.addEventListener("resize", alignHome);
    return () => {
      window.cancelAnimationFrame(first);
      window.removeEventListener("resize", alignHome);
    };
  }, [dir]);

  useEffect(() => {
    return () => {
      if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
    };
  }, []);

  const chipClass =
    "flex h-9 w-full min-w-0 snap-start snap-always items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-medium leading-none transition-colors sm:h-10 sm:text-xs";
  const idle =
    "border-market-navy-soft/80 bg-market-navy text-market-navy-foreground/90 hover:border-market-silver hover:bg-market-navy-soft hover:text-market-navy-foreground";
  const active =
    "border-market-silver bg-market-navy-soft font-semibold text-market-navy-foreground";

  return (
    <>
      <style>{`
        html.market-home-scrollbar-hidden,
        html.market-home-scrollbar-hidden body {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html.market-home-scrollbar-hidden::-webkit-scrollbar,
        html.market-home-scrollbar-hidden body::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .market-category-rail {
          grid-auto-columns: calc((100% - 24px - 18px) / 4);
          scroll-snap-type: x mandatory;
          scroll-padding-inline: 12px;
        }
        @media (min-width: 640px) {
          .market-category-rail {
            grid-auto-columns: calc((100% - 32px - 40px) / 6);
            scroll-padding-inline: 16px;
          }
        }
        @media (min-width: 1024px) {
          .market-category-rail {
            grid-auto-columns: calc((100% - 32px - 48px) / 7);
          }
        }
      `}</style>

      <div className="sticky top-[56px] z-[35] -mt-px w-full overflow-hidden border-b border-market-navy-soft/50 bg-market-navy text-market-navy-foreground shadow-sm">
        <nav
          ref={railRef}
          dir={dir}
          aria-label={t("market.home.strip.label")}
          className="market-category-rail grid w-full grid-flow-col gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-market-navy px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:px-4"
        >
          {PRIMARY_FIELDS.map((field) => {
            const label = t(`market.fields.${field.id}`);

            if (field.kind === "home") {
              return (
                <Link
                  ref={homeRef}
                  data-category-tab
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
                  data-category-tab
                  key={field.id}
                  to="/more"
                  className={`${chipClass} ${idle} border-market-silver/70 font-semibold`}
                >
                  <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
                </Link>
              );
            }

            const on = isFieldActive(field, current);
            return (
              <Link
                data-category-tab
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
    </>
  );
}
