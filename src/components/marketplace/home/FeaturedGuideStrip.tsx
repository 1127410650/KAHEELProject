/**
 * "إعلانات مميزة" — the sponsored slot right under the home search bar.
 *
 * Promoted guide places only. The strip reserves its own height while loading
 * and renders nothing when there is no active promotion, so the home page never
 * shifts. Impressions are counted once per mounted card; clicks are counted
 * without delaying navigation.
 */

import { Link } from "@tanstack/react-router";
import { Sparkles, Star } from "lucide-react";
import { useEffect, useRef } from "react";

import { trackGuidePromo, useGuideFeaturedPlaces } from "@/lib/mkt-guide-community";

export function FeaturedGuideStrip() {
  const featured = useGuideFeaturedPlaces(8);
  const seen = useRef<Set<string>>(new Set());
  const rows = featured.data ?? [];

  useEffect(() => {
    for (const row of rows) {
      if (seen.current.has(row.promotion_id)) continue;
      seen.current.add(row.promotion_id);
      trackGuidePromo(row.promotion_id, "view");
    }
  }, [rows]);

  if (featured.isLoading) {
    return <div className="h-[104px] animate-pulse rounded-3xl bg-muted/40" aria-hidden />;
  }
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="إعلانات مميزة"
      className="rounded-3xl border border-market-purple/35 bg-market-purple/[0.05] p-2.5 shadow-[0_0_24px_-12px_hsl(var(--market-purple)/0.55)]"
    >
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-black text-market-purple">
        <Sparkles className="size-3.5" aria-hidden />
        إعلانات مميزة
      </h2>
      <div className="flex snap-x gap-2 overflow-x-auto pb-0.5">
        {rows.map((row) => (
          <Link
            key={row.promotion_id}
            to="/guides/syria/$slug"
            params={{ slug: row.slug }}
            onClick={() => trackGuidePromo(row.promotion_id, "click")}
            className="flex h-[64px] w-[62%] shrink-0 snap-start flex-col justify-center gap-0.5 rounded-2xl border border-market-purple/25 bg-card px-3 transition active:scale-[0.97] sm:w-[30%]"
          >
            <span className="truncate text-[12.5px] font-black leading-5">{row.name_ar}</span>
            <span className="flex items-center gap-1.5 truncate text-[10.5px] font-bold text-muted-foreground">
              {row.rating != null && (row.rating_total ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-foreground">
                  <Star className="size-3 fill-gold text-gold" aria-hidden />
                  {row.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="truncate">
                {[row.category, row.city ?? row.governorate].filter(Boolean).join(" • ")}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
