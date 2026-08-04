import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Home, LayoutGrid } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  PRIMARY_FIELDS,
  fieldSearchParams,
  isFieldActive,
} from "@/lib/market-primary-navigation";

/** Keeps the rail position when the visitor returns from a search or an ad. */
const RAIL_KEY = "mkt:home:cats-scroll";

/**
 * Public marketplace primary-fields rail: ONE horizontally scrollable row, in
 * the approved order, read from `market-primary-navigation` so home, search and
 * the listing form can never show a different list.
 *
 * «الرئيسية» links to `/`, «المزيد» opens `/more` (the approved extra-fields
 * panel — the list is deliberately not repeated inside a sheet here), and every
 * other chip is a real `/search` link on a real category id.
 */
export function MarketCategoryStrip() {
  const { t, locale } = useI18n();
  const railRef = useRef<HTMLDivElement | null>(null);
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, string | undefined>,
  });
  const current = { category: search["category"], sub: search["sub"] };
  // City, sort and the other filters survive a field change.
  const kept: Record<string, string> = {};
  for (const key of ["cityId", "sort", "img", "min", "max"]) {
    const value = search[key];
    if (typeof value === "string" && value !== "") kept[key] = value;
  }

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const saved = Number(sessionStorage.getItem(RAIL_KEY) ?? "0");
    if (Number.isFinite(saved) && saved !== 0) rail.scrollLeft = saved;
  }, []);

  const chipClass =
    "inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors";
  const idle =
    "border-market-navy-soft/60 text-market-navy-foreground/90 hover:border-market-silver hover:bg-market-navy-soft hover:text-market-navy-foreground";
  const active =
    "border-market-silver bg-market-navy-soft text-market-navy-foreground font-semibold";

  return (
    <div className="border-b border-market-navy-soft/50 bg-market-navy">
      <div
        ref={railRef}
        aria-label={t("market.home.strip.label")}
        onWheel={(event) => {
          const rail = railRef.current;
          if (!rail) return;
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          rail.scrollLeft += event.deltaY;
        }}
        onScroll={() => {
          if (railRef.current) {
            sessionStorage.setItem(RAIL_KEY, String(railRef.current.scrollLeft));
          }
        }}
        className="market-rail mx-auto flex w-full max-w-[1240px] snap-x items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-1.5 sm:px-4 lg:px-6"
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
      </div>
    </div>
  );
}
