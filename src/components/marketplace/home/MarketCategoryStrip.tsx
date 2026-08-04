import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, Search, X } from "lucide-react";

import { useI18n } from "@/i18n";
import { HOME_CATEGORIES, homeCategorySearch } from "@/lib/mkt-home-nav";
import { Input } from "@/components/ui/input";

/** Keeps the rail position when the visitor returns from a search. */
const RAIL_KEY = "mkt:home:cats-scroll";

/**
 * Public marketplace category rail: one horizontally scrollable row of fields
 * plus a "more" opener that reveals the full list in a sheet. Every chip is a
 * real `/search` link — no chip is decorative.
 */
export function MarketCategoryStrip() {
  const { t, locale } = useI18n();
  const railRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const saved = Number(sessionStorage.getItem(RAIL_KEY) ?? "0");
    if (Number.isFinite(saved) && saved !== 0) rail.scrollLeft = saved;
  }, []);

  // Body scroll lock while the full list is open, so the sheet is the only
  // scrolling surface on phones.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const chipClass =
    "inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-full border border-market-navy-soft/60 px-3.5 text-xs font-medium text-market-navy-foreground/90 transition-colors hover:border-market-silver hover:bg-market-navy-soft hover:text-market-navy-foreground";

  const term = filter.trim().toLowerCase();
  const listed = HOME_CATEGORIES.filter((entry) => {
    if (entry.home) return false;
    if (!term) return true;
    return t(`market.home.cats.${entry.key}`).toLowerCase().includes(term);
  });

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
        className="market-rail mx-auto flex w-full max-w-7xl snap-x items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 sm:px-4"
      >
        {HOME_CATEGORIES.map((entry) =>
          entry.home ? (
            <Link key={entry.key} to="/" className={chipClass}>
              <Home className="size-3.5 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{t("market.home.strip.home")}</span>
            </Link>
          ) : (
            <Link
              key={entry.key}
              to="/search"
              search={homeCategorySearch(entry, locale)}
              className={chipClass}
            >
              <span className="whitespace-nowrap">{t(`market.home.cats.${entry.key}`)}</span>
            </Link>
          ),
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${chipClass} border-market-silver/70 font-semibold`}
        >
          <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">{t("market.home.strip.more")}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="flex-1 text-sm font-bold text-foreground">
              {t("market.home.strip.allTitle")}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("market.home.strip.close")}
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t("market.home.strip.searchCats")}
                className="h-10 ps-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {listed.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("market.home.strip.noCats")}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {listed.map((entry) => (
                  <li key={entry.key}>
                    <Link
                      to="/search"
                      search={homeCategorySearch(entry, locale)}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary"
                    >
                      <span className="truncate">{t(`market.home.cats.${entry.key}`)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
