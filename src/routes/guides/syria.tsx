import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { GuidePlaceCard } from "@/components/marketplace/GuidePlaceCard";
import {
  EMPTY_GUIDE_FILTERS,
  GUIDE_PAGE_SIZE,
  buildGuideFacets,
  fetchGuideFacetRows,
  fetchGuidePlaces,
  type GuideFacetOption,
  type GuideFilters,
} from "@/lib/mkt-guide-places";

import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/guides/syria")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "دليل سوريا — كَحيل" },
      {
        name: "description",
        content:
          "دليل سوريا: جهات حكومية، مشافٍ، جامعات، خدمات وأماكن — بحث فوري وفلاتر بالمحافظة والقطاع مع مصادر ظاهرة.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "دليل سوريا — كَحيل" },
      {
        property: "og:description",
        content: "ابحث في دليل سوريا حسب القطاع والمحافظة والتصنيف مع اتجاهات وطرق تواصل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...canonicalMeta("/guides/syria"),
    ],
    links: canonicalLinks("/guides/syria"),
  }),
  component: SyriaGuidePage,
});

function SyriaGuidePage() {
  const [filters, setFilters] = useState<GuideFilters>(EMPTY_GUIDE_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filters.query.trim()), 250);
    return () => clearTimeout(timer);
  }, [filters.query]);

  const effective = useMemo<GuideFilters>(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, filters.sector, filters.governorate, filters.category]);

  const facets = useQuery({
    queryKey: ["guide-facets"],
    queryFn: fetchGuideFacets,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const places = useQuery({
    queryKey: ["guide-places", effective, page],
    queryFn: () => fetchGuidePlaces(effective, page),
    placeholderData: keepPreviousData,
  });

  const total = places.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / GUIDE_PAGE_SIZE));

  return (
    <MarketShell>
      <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5fb_0%,#ffffff_28%,#f8f7fc_100%)] pb-10">
        <section className="relative isolate overflow-hidden bg-market-navy text-white">
          <div className="absolute inset-0 bg-gradient-to-l from-market-navy-dark/95 via-market-navy/80 to-market-navy-soft/60" />
          <div className="market-hero-band relative mx-auto flex w-full max-w-[1240px] flex-col justify-end px-4 sm:px-6 lg:px-8">
            <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black backdrop-blur sm:text-xs">
              <ShieldCheck className="size-4" aria-hidden />
              مصادر ظاهرة وشارات تحقق صادقة
            </span>
            <h1 className="max-w-3xl font-black tracking-tight">دليل سوريا</h1>
            <p className="mt-1.5 max-w-2xl text-white/85">
              جهات حكومية ومشافٍ وجامعات وخدمات وأماكن، مع اتجاهات وطرق تواصل مباشرة.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-[10px] font-bold text-white/88 sm:text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {total.toLocaleString("en-US")} سجل
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">بحث فوري</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">فلاتر بالمحافظة والقطاع</span>
            </div>
          </div>
        </section>

        <section className="sticky top-[56px] z-20 border-b border-border/70 bg-background/95 shadow-sm backdrop-blur">
          <div className="mx-auto w-full max-w-[1240px] space-y-2.5 px-4 py-3 sm:px-6 lg:px-8">
            <label className="relative block" htmlFor="syria-guide-search">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="syria-guide-search"
                value={filters.query}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="ابحث بالاسم أو المدينة أو العنوان…"
                className="h-11 w-full rounded-2xl border border-input bg-background pe-4 ps-10 text-sm outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
              />
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <FilterSelect
                label="القطاع"
                value={filters.sector}
                options={facets.data?.sectors ?? []}
                onChange={(value) => setFilters((current) => ({ ...current, sector: value }))}
              />
              <FilterSelect
                label="المحافظة"
                value={filters.governorate}
                options={facets.data?.governorates ?? []}
                onChange={(value) => setFilters((current) => ({ ...current, governorate: value }))}
              />
              <FilterSelect
                label="التصنيف"
                value={filters.category}
                options={facets.data?.categories ?? []}
                onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          {places.isLoading ? (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 animate-pulse rounded-3xl border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : places.error ? (
            <p className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5 text-sm font-bold text-destructive">
              تعذّر تحميل الدليل، حاول لاحقًا.
            </p>
          ) : (places.data?.rows.length ?? 0) === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <Sparkles className="mx-auto mb-2 size-5 text-market-navy" aria-hidden />
              <p className="text-sm font-black">لا نتائج مطابقة</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                جرّب كلمة أقصر أو أزل بعض الفلاتر.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-[12px] font-bold text-muted-foreground">
                صفحة {page + 1} من {pages} — {total.toLocaleString("en-US")} نتيجة
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {places.data!.rows.map((place) => (
                  <GuidePlaceCard key={place.id} place={place} />
                ))}
              </div>

              <nav className="mt-6 flex items-center justify-center gap-2" aria-label="ترقيم الصفحات">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-black disabled:opacity-40"
                >
                  <ChevronRight className="size-3.5" aria-hidden />
                  السابق
                </button>
                <span className="rounded-xl bg-market-navy px-3.5 py-2 text-[11px] font-black text-white">
                  {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
                  disabled={page + 1 >= pages}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-black disabled:opacity-40"
                >
                  التالي
                  <ChevronLeft className="size-3.5" aria-hidden />
                </button>
              </nav>
            </>
          )}
        </section>
      </main>
    </MarketShell>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-2xl border border-input bg-background px-3 text-[12px] font-bold outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
      >
        <option value="">{label}: الكل</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
