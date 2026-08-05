import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  PRIMARY_FIELDS,
  fieldSearchParams,
  isFieldActive,
} from "@/lib/market-primary-navigation";

/**
 * Primary marketplace categories merged with the header. The rail is sticky,
 * full-width, horizontally scrollable by touch, and uses safe edge spacers so
 * the first and last chips are never clipped.
 */
export function MarketCategoryStrip() {
  const { t, locale } = useI18n();
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

  const chipClass =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium leading-none transition-colors sm:h-10 sm:px-3.5 sm:text-xs";
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
      `}</style>
      <div className="sticky top-[56px] z-[35] -mt-px w-full overflow-hidden border-b border-market-navy-soft/50 bg-market-navy text-market-navy-foreground shadow-sm">
        <nav
          aria-label={t("market.home.strip.label")}
          className="flex w-full touch-pan-x items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-market-navy py-2 [scroll-padding-inline:12px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:[scroll-padding-inline:16px]"
        >
          <span aria-hidden className="w-3 shrink-0 sm:w-4" />
          {PRIMARY_FIELDS.map((field) => {
            const label = t(`market.fields.${field.id}`);
            if (field.kind === "home") {
              return (
                <Link key={field.id} to="/" className={`${chipClass} ${idle}`}>
                  <Home className="size-3.5 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            }
            if (field.kind === "more") {
              return (
                <Link
                  key={field.id}
                  to="/more"
                  className={`${chipClass} ${idle} border-market-silver/70 font-semibold`}
                >
                  <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
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
          <span aria-hidden className="w-3 shrink-0 sm:w-4" />
        </nav>
      </div>
    </>
  );
}
