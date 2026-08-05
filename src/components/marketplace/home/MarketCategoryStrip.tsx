import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  PRIMARY_FIELDS,
  fieldSearchParams,
  isFieldActive,
} from "@/lib/market-primary-navigation";

/**
 * Primary marketplace categories, visually merged with the header. The strip is
 * independently sticky directly below the 56px mobile header, so both rows stay
 * fixed as one navy navigation block while the page content scrolls underneath.
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

  const chipClass =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors sm:h-10 sm:px-3.5 sm:text-xs";
  const idle =
    "border-market-navy-soft/80 bg-market-navy text-market-navy-foreground/90 hover:border-market-silver hover:bg-market-navy-soft hover:text-market-navy-foreground";
  const active =
    "border-market-silver bg-market-navy-soft font-semibold text-market-navy-foreground";

  return (
    <div className="sticky top-14 z-[35] -mt-px w-full border-t border-market-navy-soft/35 border-b border-market-navy-soft/60 bg-market-navy text-market-navy-foreground shadow-sm">
      <nav
        aria-label={t("market.home.strip.label")}
        className="mx-auto flex w-full max-w-[1240px] items-center gap-1.5 overflow-x-auto overscroll-x-contain bg-market-navy px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:px-4 lg:px-6"
      >
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
      </nav>
    </div>
  );
}
