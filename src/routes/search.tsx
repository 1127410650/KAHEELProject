import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Loader2, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import { geoName, loadCities, loadCountries } from "@/lib/mkt-geo";
import { PAGE_SIZE, loadCategories, loadListingTypes, loadListingsPage } from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, type ListingCardData } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export interface SearchParams {
  q?: string | undefined;
  category?: string | undefined;
  sub?: string | undefined;
  type?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  cityId?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  verified?: string | undefined;
  deal?: string | undefined;
  sort?: string | undefined;
  view?: string | undefined;
  advertiser?: string | undefined;
}

const title = "نتائج البحث — سوق تحقّق";
const description =
  "ابحث وفلتر إعلانات الخدمات والمقاولات ومواد البناء والمعدات حسب التصنيف والمدينة والسعر.";

export const Route = createFileRoute("/search")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const pick = (key: keyof SearchParams) =>
      typeof search[key] === "string" && search[key] !== "" ? (search[key] as string) : undefined;
    const out: SearchParams = {};
    for (const key of [
      "q",
      "category",
      "sub",
      "type",
      "city",
      "country",
      "cityId",
      "min",
      "max",
      "verified",
      "deal",
      "sort",
      "view",
      "advertiser",
    ] as const) {
      const value = pick(key);
      if (value !== undefined) out[key] = value;
    }
    return out;
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { t, locale } = useI18n();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const types = useQuery({ queryKey: ["mkt", "types"], queryFn: loadListingTypes });
  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const selectedCountry = (countries.data ?? []).find((c) => c.iso2 === params.country);
  const cities = useQuery({
    queryKey: ["mkt", "cities", selectedCountry?.id],
    enabled: !!selectedCountry?.id,
    queryFn: () => loadCities(selectedCountry?.id),
  });

  // Results load page by page as the visitor scrolls instead of one big batch.
  const listings = useInfiniteQuery({
    queryKey: ["mkt", "search", params, locale],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadListingsPage(
        {
          q: params.q,
          categorySlug: params.category,
          subcategoryId: params.sub,
          type: params.type,
          city: params.city,
          countryIso2: params.country,
          cityId: params.cityId,
          minPrice: params.min ? Number(params.min) : undefined,
          maxPrice: params.max ? Number(params.max) : undefined,
          
          advertiser:
            params.advertiser === "individual" || params.advertiser === "business"
              ? params.advertiser
              : undefined,
          deal: params.deal === "sale" || params.deal === "rent" ? params.deal : undefined,
          sort:
            params.sort === "views" || params.sort === "price_asc" || params.sort === "price_desc"
              ? params.sort
              : "newest",
        },
        locale,
        pageParam,
      ),
    getNextPageParam: (last, all) => (last.fetched < PAGE_SIZE ? undefined : all.length),
  });

  // De-duplicate defensively: a listing published between two page fetches must
  // never render twice.
  const rows = (() => {
    const seen = new Set<string>();
    const out: ListingCardData[] = [];
    for (const page of listings.data?.pages ?? []) {
      for (const row of page.rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  })();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && listings.hasNextPage && !listings.isFetchingNextPage) {
        void listings.fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [listings.hasNextPage, listings.isFetchingNextPage, listings.fetchNextPage, rows.length]);

  // Remember where the visitor was so opening an ad and coming back lands on the
  // same card instead of jumping to the top of the results.
  const scrollKey = `tahqaq.mkt.search.scroll:${JSON.stringify(params)}`;
  const restored = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      // A navigation away resets scrollY to 0; keep the last real position.
      if (window.scrollY > 0) window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  useEffect(() => {
    if (typeof window === "undefined" || restored.current || rows.length === 0) return;
    const saved = Number(window.sessionStorage.getItem(scrollKey) ?? "0");
    if (!saved) {
      restored.current = true;
      return;
    }
    // Keep pulling pages until the saved offset exists in the document again.
    if (document.documentElement.scrollHeight < saved + window.innerHeight) {
      if (listings.hasNextPage && !listings.isFetchingNextPage) void listings.fetchNextPage();
      return;
    }
    restored.current = true;
    // The router also restores scroll on back; re-apply a few frames later so the
    // saved position wins once the results are laid out.
    const timers = [0, 60, 200, 500].map((delay) =>
      window.setTimeout(() => window.scrollTo({ top: saved }), delay),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));

  }, [
    rows.length,
    scrollKey,
    listings.hasNextPage,
    listings.isFetchingNextPage,
    listings.fetchNextPage,
  ]);



  function update(patch: Partial<SearchParams>) {
    const next: SearchParams = { ...params, ...patch };
    for (const key of Object.keys(next) as (keyof SearchParams)[]) {
      if (!next[key]) delete next[key];
    }
    void navigate({ search: next, replace: true });
  }

  const roots = (categories.data ?? []).filter((c) => !c.parent_id);
  const subs = (categories.data ?? []).filter(
    (c) => c.parent_id && roots.find((r) => r.slug === params.category)?.id === c.parent_id,
  );
  const view = params.view === "list" ? "list" : "grid";

  return (
    <MarketShell>
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-5 sm:px-4 sm:py-6 lg:grid-cols-[260px_1fr]">
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {filtersOpen ? t("common.close") : t("common.filter")}
        </Button>

        <aside
          className={
            filtersOpen
              ? "space-y-4 rounded-xl border border-border bg-card p-4"
              : "hidden space-y-4 rounded-xl border border-border bg-card p-4 lg:block"
          }
        >
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("common.filter")}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="q">{t("common.search")}</Label>
            <Input
              id="q"
              defaultValue={params.q ?? ""}
              onBlur={(e) => update({ q: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") update({ q: (e.target as HTMLInputElement).value });
              }}
              placeholder={t("market.searchPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("market.filters.category")}</Label>
            <select
              value={params.category ?? ""}
              onChange={(e) => update({ category: e.target.value, sub: undefined })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t("market.filters.all")}</option>
              {roots.map((c) => (
                <option key={c.id} value={c.slug}>
                  {locale === "ar" ? c.name_ar : c.name_en}
                </option>
              ))}
            </select>
          </div>

          {subs.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("market.filters.subcategory")}</Label>
              <select
                value={params.sub ?? ""}
                onChange={(e) => update({ sub: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{t("market.filters.all")}</option>
                {subs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "ar" ? c.name_ar : c.name_en}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("market.filters.type")}</Label>
            <select
              value={params.type ?? ""}
              onChange={(e) => update({ type: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t("market.filters.all")}</option>
              {(types.data ?? []).map((tp) => (
                <option key={tp.code} value={tp.code}>
                  {locale === "ar" ? tp.name_ar : tp.name_en}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("market.geo.country")}</Label>
            <select
              value={params.country ?? ""}
              onChange={(e) => update({ country: e.target.value, cityId: undefined })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t("market.geo.allCountries")}</option>
              {(countries.data ?? []).map((c) => (
                <option key={c.id} value={c.iso2}>
                  {geoName(c, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("market.filters.city")}</Label>
            <select
              value={params.cityId ?? ""}
              onChange={(e) => update({ cityId: e.target.value })}
              disabled={!selectedCountry}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
            >
              <option value="">{t("market.filters.allCities")}</option>
              {(cities.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {geoName(c, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="min">{t("market.filters.minPrice")}</Label>
              <Input
                id="min"
                dir="ltr"
                inputMode="numeric"
                defaultValue={params.min ?? ""}
                onBlur={(e) => update({ min: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max">{t("market.filters.maxPrice")}</Label>
              <Input
                id="max"
                dir="ltr"
                inputMode="numeric"
                defaultValue={params.max ?? ""}
                onBlur={(e) => update({ max: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("market.filters.deal")}</Label>
            <select
              value={params.deal ?? ""}
              onChange={(e) => update({ deal: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t("market.filters.all")}</option>
              <option value="sale">{t("market.filters.sale")}</option>
              <option value="rent">{t("market.filters.rent")}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("market.filters.advertiser")}</Label>
            <select
              value={params.advertiser ?? ""}
              onChange={(e) => update({ advertiser: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t("market.filters.all")}</option>
              <option value="individual">{t("market.advertiser.individual")}</option>
              <option value="business">{t("market.advertiser.business")}</option>
            </select>
          </div>


          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void navigate({ search: {} })}
          >
            {t("common.reset")}
          </Button>
        </aside>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t("market.resultsCount", { count: rows.length })}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={params.sort ?? "newest"}
                onChange={(e) => update({ sort: e.target.value })}
                aria-label={t("market.filters.sort")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="newest">{t("market.sort.newest")}</option>
                <option value="views">{t("market.sort.views")}</option>
                <option value="price_asc">{t("market.sort.priceAsc")}</option>
                <option value="price_desc">{t("market.sort.priceDesc")}</option>
              </select>
              <div className="inline-flex rounded-md border border-input">
                <button
                  type="button"
                  aria-label={t("market.view.grid")}
                  onClick={() => update({ view: "grid" })}
                  className={
                    view === "grid"
                      ? "bg-primary p-2 text-primary-foreground"
                      : "p-2 text-muted-foreground"
                  }
                >
                  <LayoutGrid className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("market.view.list")}
                  onClick={() => update({ view: "list" })}
                  className={
                    view === "list"
                      ? "bg-primary p-2 text-primary-foreground"
                      : "p-2 text-muted-foreground"
                  }
                >
                  <List className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>

          {listings.isLoading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">{t("market.noResults")}</p>
              <Link
                to="/dashboard/ads/new"
                className="mt-3 inline-block text-sm font-medium text-primary"
              >
                {t("market.addListing")}
              </Link>
            </div>
          ) : view === "grid" ? (
            <>
              {/* Compact rows on phones, gallery grid from tablet up. */}
              <div className="flex flex-col gap-2.5 sm:hidden">
                {rows.map((l) => (
                  <ListingCard key={l.id} listing={l} view="row" />
                ))}
              </div>
              <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              {rows.map((l) => (
                <ListingCard key={l.id} listing={l} view="list" />
              ))}
            </div>
          )}

          <div ref={sentinel} className="h-10" aria-hidden />
          {listings.isFetchingNextPage && (
            <p className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("common.loading")}
            </p>
          )}
          {!listings.hasNextPage && rows.length > 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {t("market.endOfResults")}
            </p>
          )}
        </section>
      </div>
    </MarketShell>
  );
}
