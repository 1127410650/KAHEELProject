import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Loader2, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { geoName, loadCities, loadCountries, useMarketPreference } from "@/lib/mkt-geo";
import type { MktBusiness } from "@/lib/mkt";
import { purposesFor } from "@/lib/mkt-taxonomy";
import {
  PAGE_SIZE,
  loadBusinessesPage,
  loadCategories,
  loadListingTypes,
  loadListingsPage,
} from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, type ListingCardData } from "@/components/marketplace/ListingCard";
import { BusinessCard } from "@/components/marketplace/BusinessCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface SearchParams {
  q?: string | undefined;
  /** One of the five broad fields shown on the home page. */
  domain?: string | undefined;
  category?: string | undefined;
  sub?: string | undefined;
  type?: string | undefined;
  cityId?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  img?: string | undefined;
  sort?: string | undefined;
}

const PARAM_KEYS = [
  "q",
  "domain",
  "category",
  "sub",
  "type",
  "cityId",
  "min",
  "max",
  "img",
  "sort",
] as const;

type DomainKey = "realestate" | "service" | "product" | "equipment_rent" | "business";

interface DomainDef {
  key: DomainKey;
  categorySlug?: string;
  typeCode?: string;
}

/** The five broad fields. Each one maps onto real query constraints only. */
const DOMAINS: DomainDef[] = [
  { key: "realestate", categorySlug: "real-estate" },
  { key: "service", typeCode: "service" },
  { key: "product", typeCode: "product" },
  { key: "equipment_rent", typeCode: "equipment_rent" },
  { key: "business" },
];



const SORTS = ["newest", "oldest", "price_asc", "price_desc"] as const;
type SortKey = (typeof SORTS)[number];

const VIEW_STORAGE_KEY = "tahqaq.mkt.search.view";

const title = "البحث في السوق — سوق تحقّق";
const description =
  "ابحث عن العقارات والخدمات والموردين والمعدات ومواد البناء وفلتر النتائج حسب التصنيف والمدينة والسعر.";

export const Route = createFileRoute("/search")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const out: SearchParams = {};
    for (const key of PARAM_KEYS) {
      const value = search[key];
      if (typeof value === "string" && value !== "") out[key] = value;
    }
    // Entry points that predate the field selector (home quick strip, saved
    // links) still resolve to one of the five fields instead of being dropped.
    if (!out.domain) {
      if (search["advertiser"] === "business") out.domain = "business";
      else if (out.category === "real-estate") out.domain = "realestate";
      else if (
        out.type === "service" ||
        out.type === "product" ||
        out.type === "equipment_rent"
      ) {
        out.domain = out.type;
      }
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
  const isMobile = useIsMobile();

  const domain = (DOMAINS.find((d) => d.key === params.domain)?.key ?? undefined) as
    | DomainKey
    | undefined;
  const domainDef = DOMAINS.find((d) => d.key === domain);
  const sort: SortKey = (SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "newest";
  const businessMode = domain === "business";

  /** Only a UI preference — never part of the query or of the shared URL. */
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "list" || saved === "grid") setView(saved);
  }, []);
  const chooseView = (next: "grid" | "list") => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const update = useCallback(
    (patch: Partial<SearchParams>) => {
      const next: SearchParams = { ...params, ...patch };
      for (const key of PARAM_KEYS) if (!next[key]) delete next[key];
      void navigate({ search: next, replace: true });
    },
    [navigate, params],
  );

  /* ── search term: one field, debounced, kept in the URL so a refresh keeps it ── */
  const [term, setTerm] = useState(params.q ?? "");
  const termRef = useRef(params.q ?? "");
  useEffect(() => {
    // External changes (back/forward, header entry) win over the local draft.
    if ((params.q ?? "") !== termRef.current) {
      termRef.current = params.q ?? "";
      setTerm(params.q ?? "");
    }
  }, [params.q]);
  useEffect(() => {
    if (term === (params.q ?? "")) return;
    const id = window.setTimeout(() => {
      termRef.current = term;
      update({ q: term });
    }, 450);
    return () => window.clearTimeout(id);
  }, [term, params.q, update]);

  /* ── reference data ── */
  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const types = useQuery({ queryKey: ["mkt", "types"], queryFn: loadListingTypes });
  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });

  // The country always comes from the account (Saudi Arabia for guests); it is
  // never a search filter and cannot be changed from this page.
  const { preference } = useMarketPreference();
  const accountCountryIso2 = preference.countryIso2;
  const country = (countries.data ?? []).find((c) => c.iso2 === accountCountryIso2);
  const cities = useQuery({
    queryKey: ["mkt", "cities", country?.id],
    enabled: !!country?.id,
    queryFn: () => loadCities(country?.id),
  });

  const roots = useMemo(
    () => (categories.data ?? []).filter((c) => !c.parent_id),
    [categories.data],
  );
  const activeRoot = roots.find(
    (r) => r.slug === (domainDef?.categorySlug ?? params.category),
  );
  const subs = useMemo(
    () => (categories.data ?? []).filter((c) => c.parent_id && c.parent_id === activeRoot?.id),
    [categories.data, activeRoot?.id],
  );
  // Offer types are derived from the chosen category path, so no impossible
  // combination is ever offered.
  const allowedTypes = useMemo(() => {
    const all = types.data ?? [];
    if (!activeRoot) return all;
    const allowed = purposesFor(activeRoot.slug);
    return all.filter((tp) => allowed.includes(tp.code));
  }, [types.data, activeRoot]);

  const activeFilterCount = [
    params.domain,
    params.category,
    params.sub,
    params.type,
    params.cityId,
    params.min,
    params.max,
    params.img,
  ].filter(Boolean).length;

  /* ── results ── */
  const listingKey = { ...params, sort, country: accountCountryIso2 };
  const listings = useInfiniteQuery({
    queryKey: ["mkt", "search", "listings", listingKey, locale],
    enabled: !businessMode,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadListingsPage(
        {
          q: params.q,
          categorySlug: domainDef?.categorySlug ?? params.category,
          subcategoryId: params.sub,
          type: domainDef?.typeCode ?? params.type,
          countryIso2: accountCountryIso2,
          cityId: params.cityId,
          minPrice: params.min ? Number(params.min) : undefined,
          maxPrice: params.max ? Number(params.max) : undefined,
          withImageOnly: params.img === "1",
          sort,
        },
        locale,
        pageParam,
      ),
    getNextPageParam: (last, all) => (last.fetched < PAGE_SIZE ? undefined : all.length),
  });

  const businesses = useInfiniteQuery({
    queryKey: ["mkt", "search", "businesses", listingKey],
    enabled: businessMode,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadBusinessesPage(
        {
          q: params.q,
          countryIso2: accountCountryIso2,
          cityId: params.cityId,
          sort: sort === "oldest" ? "oldest" : "newest",
        },
        pageParam,
      ),
    getNextPageParam: (last, all) => (last.fetched < PAGE_SIZE ? undefined : all.length),
  });

  const active = businessMode ? businesses : listings;

  // Defensive de-duplication: a record published between two page fetches must
  // never render twice.
  const rows = useMemo(() => {
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
  }, [listings.data]);

  const bizRows = useMemo(() => {
    const seen = new Set<string>();
    const out: { business: MktBusiness; logo: string | null }[] = [];
    for (const page of businesses.data?.pages ?? []) {
      for (const row of page.rows) {
        if (seen.has(row.tenant_id)) continue;
        seen.add(row.tenant_id);
        out.push({ business: row, logo: row.logo_url ? (page.logos[row.logo_url] ?? null) : null });
      }
    }
    return out;
  }, [businesses.data]);

  const count = businessMode ? bizRows.length : rows.length;
  const empty = !active.isLoading && count === 0;

  /* ── batched loading near the end of the list ── */
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && active.hasNextPage && !active.isFetchingNextPage) {
          void active.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active.hasNextPage, active.isFetchingNextPage, active.fetchNextPage, count]);

  /* ── scroll restore: opening an ad and coming back lands on the same card ── */
  const scrollKey = `tahqaq.mkt.search.scroll:${JSON.stringify(listingKey)}`;
  const restored = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 0) window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  useEffect(() => {
    if (restored.current || count === 0) return;
    const saved = Number(window.sessionStorage.getItem(scrollKey) ?? "0");
    if (!saved) {
      restored.current = true;
      return;
    }
    // Keep pulling pages until the saved offset exists in the document again.
    if (document.documentElement.scrollHeight < saved + window.innerHeight) {
      if (active.hasNextPage && !active.isFetchingNextPage) void active.fetchNextPage();
      return;
    }
    restored.current = true;
    const timers = [0, 60, 200, 500].map((delay) =>
      window.setTimeout(() => window.scrollTo({ top: saved }), delay),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [count, scrollKey, active.hasNextPage, active.isFetchingNextPage, active.fetchNextPage]);

  /* ── filters sheet ── */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SearchParams>(params);
  useEffect(() => {
    if (sheetOpen) setDraft(params);
  }, [sheetOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftRootSlug =
    DOMAINS.find((d) => d.key === draft.domain)?.categorySlug ?? draft.category;
  const draftRoot = roots.find((r) => r.slug === draftRootSlug);
  const draftSubs = (categories.data ?? []).filter(
    (c) => c.parent_id && c.parent_id === draftRoot?.id,
  );
  const draftTypes = draftRoot
    ? (types.data ?? []).filter((tp) => purposesFor(draftRoot.slug).includes(tp.code))
    : (types.data ?? []);
  const draftIsBusiness = draft.domain === "business";

  function setDomain(key: string) {
    // A new field drops every value that cannot exist under it — nothing stale
    // stays hidden in the URL.
    const def = DOMAINS.find((d) => d.key === key);
    const next: SearchParams = { ...draft, domain: key || undefined };
    delete next.sub;
    if (!def?.categorySlug) delete next.category;
    else next.category = def.categorySlug;
    if (def?.typeCode) next.type = def.typeCode;
    else delete next.type;
    if (!def || def.key === "business") {
      delete next.min;
      delete next.max;
      delete next.img;
    }
    setDraft(next);
  }

  function applyFilters() {
    const next: SearchParams = { ...draft, q: params.q };
    for (const key of PARAM_KEYS) if (!next[key]) delete next[key];
    setSheetOpen(false);
    void navigate({ search: next, replace: true });
  }

  function clearFilters() {
    setSheetOpen(false);
    const next: SearchParams = {};
    if (params.q) next.q = params.q;
    if (params.sort) next.sort = params.sort;
    void navigate({ search: next, replace: true });
  }

  const filterBody = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="f-domain">{t("market.search.domain")}</Label>
        <select
          id="f-domain"
          value={draft.domain ?? ""}
          onChange={(e) => setDomain(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{t("market.filters.all")}</option>
          {DOMAINS.map((d) => (
            <option key={d.key} value={d.key}>
              {t(`market.quick.${d.key}`)}
            </option>
          ))}
        </select>
      </div>

      {!draftIsBusiness && (
        <div className="space-y-1.5">
          <Label htmlFor="f-cat">{t("market.filters.category")}</Label>
          <select
            id="f-cat"
            value={draft.category ?? ""}
            disabled={!!DOMAINS.find((d) => d.key === draft.domain)?.categorySlug}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value || undefined, sub: undefined })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
          >
            <option value="">{t("market.filters.all")}</option>
            {roots.map((c) => (
              <option key={c.id} value={c.slug}>
                {locale === "ar" ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
        </div>
      )}

      {!draftIsBusiness && draftSubs.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="f-sub">{t("market.filters.subcategory")}</Label>
          <select
            id="f-sub"
            value={draft.sub ?? ""}
            onChange={(e) => setDraft({ ...draft, sub: e.target.value || undefined })}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{t("market.filters.all")}</option>
            {draftSubs.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "ar" ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="f-city">{t("market.filters.city")}</Label>
        <select
          id="f-city"
          value={draft.cityId ?? ""}
          disabled={!country}
          onChange={(e) => setDraft({ ...draft, cityId: e.target.value || undefined })}
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
        >
          <option value="">{t("market.filters.allCities")}</option>
          {(cities.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {geoName(c, locale)}
            </option>
          ))}
        </select>
      </div>

      {!draftIsBusiness && (
        <div className="space-y-1.5">
          <Label htmlFor="f-type">{t("market.search.offerType")}</Label>
          <select
            id="f-type"
            value={draft.type ?? ""}
            onChange={(e) => setDraft({ ...draft, type: e.target.value || undefined })}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{t("market.filters.all")}</option>
            {draftTypes.map((tp) => (
              <option key={tp.code} value={tp.code}>
                {locale === "ar" ? tp.name_ar : tp.name_en}
              </option>
            ))}
          </select>
        </div>
      )}

      {!draftIsBusiness && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="f-min">{t("market.filters.minPrice")}</Label>
            <Input
              id="f-min"
              dir="ltr"
              inputMode="numeric"
              value={draft.min ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, min: e.target.value.replace(/\D/g, "") || undefined })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-max">{t("market.filters.maxPrice")}</Label>
            <Input
              id="f-max"
              dir="ltr"
              inputMode="numeric"
              value={draft.max ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, max: e.target.value.replace(/\D/g, "") || undefined })
              }
            />
          </div>
        </div>
      )}

      {!draftIsBusiness && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={draft.img === "1"}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, img: checked === true ? "1" : undefined })
            }
          />
          {t("market.search.withImages")}
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <Button className="flex-1" onClick={applyFilters}>
          {t("market.search.apply")}
        </Button>
        <Button variant="outline" className="flex-1" onClick={clearFilters}>
          {t("market.search.clearFilters")}
        </Button>
      </div>
    </div>
  );

  return (
    <MarketShell footer="none">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {t("market.search.title")}
        </h1>

        {/* The single search field on this page. */}
        <form
          className="relative mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            termRef.current = term;
            update({ q: term });
          }}
        >
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("market.search.placeholder")}
            aria-label={t("market.search.title")}
            className="h-11 pe-10"
          />
          {term !== "" && (
            <button
              type="button"
              aria-label={t("market.search.clear")}
              title={t("market.search.clear")}
              onClick={() => {
                setTerm("");
                termRef.current = "";
                update({ q: undefined });
              }}
              className="absolute inset-y-0 grid w-10 place-items-center text-muted-foreground end-0"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <SlidersHorizontal className="size-4" aria-hidden />
                {t("market.search.filtersBtn")}
                {activeFilterCount > 0 && (
                  <span className="ms-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isMobile ? "bottom" : "right"}
              className="max-h-[85dvh] overflow-y-auto sm:max-w-sm"
            >
              <SheetHeader className="text-start">
                <SheetTitle>{t("market.filters.title")}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{filterBody}</div>
            </SheetContent>
          </Sheet>

          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            aria-label={t("market.filters.sort")}
            className="h-9 min-w-0 shrink rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="newest">{t("market.sort.newest")}</option>
            <option value="oldest">{t("market.sort.oldest")}</option>
            {!businessMode && <option value="price_asc">{t("market.sort.priceAsc")}</option>}
            {!businessMode && <option value="price_desc">{t("market.sort.priceDesc")}</option>}
          </select>

          <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-input">
            <button
              type="button"
              aria-label={t("market.view.grid")}
              aria-pressed={view === "grid"}
              onClick={() => chooseView("grid")}
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
              aria-pressed={view === "list"}
              onClick={() => chooseView("list")}
              className={
                view === "list"
                  ? "bg-primary p-2 text-primary-foreground"
                  : "p-2 text-muted-foreground"
              }
            >
              <List className="size-4" aria-hidden />
            </button>
          </div>

          {!active.isLoading && (
            <p className="ms-auto text-xs text-muted-foreground">
              {count} {businessMode ? t("market.search.businessesCount") : t("market.resultsCount")}
            </p>
          )}
        </div>

        <div className="mt-4">
          {active.isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl sm:h-56" />
              ))}
            </div>
          ) : empty ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">{t("market.noResults")}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    {t("market.search.clearFilters")}
                  </Button>
                )}
                <Button asChild size="sm">
                  <Link to="/dashboard/ads/new">{t("market.addListing")}</Link>
                </Button>
              </div>
            </div>
          ) : businessMode ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bizRows.map((row) => (
                <BusinessCard key={row.business.tenant_id} business={row.business} logoUrl={row.logo} />
              ))}
            </div>
          ) : view === "grid" ? (
            <>
              {/* Phones show one clear card per row; two columns from tablet up. */}
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

          <div ref={sentinel} className="h-8" aria-hidden />
          {active.isFetchingNextPage && (
            <p className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("market.search.loadingMore")}
            </p>
          )}
          {!active.hasNextPage && count > 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              {t("market.endOfResults")}
            </p>
          )}
        </div>
      </div>
    </MarketShell>
  );
}
