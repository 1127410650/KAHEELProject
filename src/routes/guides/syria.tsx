import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Navigation, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { GuidePlaceCard } from "@/components/marketplace/GuidePlaceCard";
import { LocationSheet } from "@/components/marketplace/LocationSheet";
import { RADIUS_OPTIONS, useNearbyOrigin, type RadiusKm } from "@/lib/mkt-nearby";
import { GuideFilterBar } from "@/components/marketplace/guide/GuideFilterBar";
import { GuideDirectoryNotice } from "@/components/marketplace/guide/GuideDirectoryNotice";
import { OsmAttribution } from "@/components/marketplace/guide/OsmAttribution";
import {
  EMPTY_GUIDE_FILTERS,
  GUIDE_PAGE_SIZE,
  buildGuideFacets,
  fetchGuideFacetRows,
  fetchGuidePlaces,
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
  }, [
    debouncedQuery,
    filters.sector,
    filters.governorate,
    filters.category,
    filters.subcategory,
  ]);

  const facetRows = useQuery({
    queryKey: ["guide-facet-rows"],
    queryFn: fetchGuideFacetRows,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const facets = useMemo(
    () => buildGuideFacets(facetRows.data ?? [], filters),
    [facetRows.data, filters],
  );
  /*
   * «الأقرب إليك» للدليل: المسافة والترتيب في القاعدة. بلا موقع نبقى على
   * الترتيب الافتراضي داخل المحافظة المختارة، بلا كسر ولا نتائج فارغة.
   */
  const { origin } = useNearbyOrigin();
  const [nearest, setNearest] = useState(false);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const nearActive = nearest && !!origin;
  const near = nearActive
    ? { lat: origin!.lat, lng: origin!.lng, radiusKm }
    : undefined;

  const places = useQuery({
    queryKey: [
      "guide-places",
      effective,
      page,
      near ? `${near.lat.toFixed(3)},${near.lng.toFixed(3)},${radiusKm ?? "all"}` : null,
    ],
    queryFn: () => fetchGuidePlaces(effective, page, near),
    placeholderData: keepPreviousData,
  });


  const total = places.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / GUIDE_PAGE_SIZE));

  return (
    <MarketShell>
      <main className="min-h-screen bg-background pb-10">
        <section className="relative isolate overflow-hidden border-b border-border bg-background text-foreground">
          <div className="market-hero-band relative mx-auto flex w-full max-w-[1240px] flex-col justify-end px-[var(--page-x)]">
            <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-secondary px-3 py-[var(--sp-2)] text-desc font-black text-primary sm:text-desc">
              <ShieldCheck className="size-4" aria-hidden />
              مصادر ظاهرة وشارات تحقق صادقة
            </span>
            <h1 className="max-w-3xl font-black">دليل سوريا</h1>
            <p className="mt-1.5 max-w-2xl text-muted-foreground">
              جهات حكومية ومشافٍ وجامعات وخدمات وأماكن، مع اتجاهات وطرق تواصل مباشرة.
            </p>
            <div className="mt-[var(--sp-3)] flex flex-wrap gap-2 text-desc font-bold text-muted-foreground sm:text-desc">
              <span className="rounded-full border border-border bg-secondary px-3 py-[var(--sp-2)]">
                {total.toLocaleString("en-US")} سجل
              </span>
              <span className="rounded-full border border-border bg-secondary px-3 py-[var(--sp-2)]">بحث فوري</span>
              <span className="rounded-full border border-border bg-secondary px-3 py-[var(--sp-2)]">فلاتر بالمحافظة والقطاع</span>
            </div>
          </div>
        </section>


        <section className="sticky top-[56px] z-20 border-b border-border/70 bg-background/95 shadow-sm backdrop-blur">
          <div className="mx-auto w-full max-w-[1240px] space-y-[var(--sp-3)] px-[var(--page-x)] py-3">
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
                className="h-11 w-full rounded-[var(--r-card)] border border-input bg-background pe-4 ps-10 text-sm outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={nearest}
                onClick={() => {
                  if (!origin) {
                    setLocationOpen(true);
                    return;
                  }
                  setPage(0);
                  setNearest((value) => !value);
                }}
                className={
                  nearActive
                    ? "k-press k-toggle-active inline-flex h-9 items-center gap-1 rounded-xl px-3 text-desc font-black"
                    : "k-press inline-flex h-9 items-center gap-1 rounded-xl border border-primary/30 bg-card px-3 text-desc font-black text-primary"
                }
              >
                <Navigation className="size-3.5" aria-hidden />
                الأقرب إليك
              </button>
              {nearActive && (
                <select
                  value={radiusKm ?? ""}
                  onChange={(event) => {
                    setPage(0);
                    const km = Number(event.target.value);
                    setRadiusKm(
                      (RADIUS_OPTIONS as readonly number[]).includes(km) ? (km as RadiusKm) : null,
                    );
                  }}
                  aria-label="النطاق"
                  className="h-9 rounded-xl border border-primary/25 bg-card px-2 text-desc font-bold"
                >
                  <option value="">كل سوريا</option>
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={String(km)}>
                      داخل {km} كم
                    </option>
                  ))}
                </select>
              )}
            </div>

            <GuideFilterBar
              filters={filters}
              facets={facets}
              total={total}
              loading={places.isLoading}
              onChange={setFilters}
            />


          </div>
        </section>

        <div className="mx-auto w-full max-w-[1240px] px-[var(--page-x)] pt-4">
          <GuideDirectoryNotice />
        </div>

        <section className="mx-auto w-full max-w-[1240px] px-[var(--page-x)] py-5 sm:py-7">
          {places.isLoading ? (
            <div className="grid grid-cols-1 gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 animate-pulse rounded-[var(--r-card)] border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : places.error ? (
            <p className="rounded-[var(--r-card)] border border-destructive/30 bg-destructive/5 p-5 text-sm font-bold text-destructive">
              تعذّر تحميل الدليل، حاول لاحقًا.
            </p>
          ) : (places.data?.rows.length ?? 0) === 0 ? (
            <div className="rounded-[var(--r-card)] border border-border bg-card p-8 text-center">
              <Sparkles className="mx-auto mb-2 size-5 text-market-navy" aria-hidden />
              <p className="text-sm font-black">لا نتائج مطابقة</p>
              <p className="mt-1 text-desc text-muted-foreground">
                جرّب كلمة أقصر أو أزل بعض الفلاتر.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-desc font-bold text-muted-foreground">
                صفحة {page + 1} من {pages} — {total.toLocaleString("en-US")} نتيجة
              </div>
              <div className="grid grid-cols-1 gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-3">
                {places.data!.rows.map((place) => (
                  <GuidePlaceCard key={place.id} place={place} />
                ))}
              </div>

              <nav className="mt-6 flex items-center justify-center gap-2" aria-label="ترقيم الصفحات">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-desc font-black disabled:opacity-40"
                >
                  <ChevronRight className="size-3.5" aria-hidden />
                  السابق
                </button>
                <span className="rounded-xl bg-market-navy px-[var(--sp-4)] py-2 text-desc font-black text-white">
                  {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
                  disabled={page + 1 >= pages}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-desc font-black disabled:opacity-40"
                >
                  التالي
                  <ChevronLeft className="size-3.5" aria-hidden />
                </button>
              </nav>
            </>
          )}
          <OsmAttribution className="mt-6" />
        </section>
      </main>
      {locationOpen && (
        <LocationSheet open={locationOpen} onOpenChange={setLocationOpen} />
      )}
    </MarketShell>
  );
}
