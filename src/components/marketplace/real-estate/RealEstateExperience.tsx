import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  Home,
  KeyRound,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import realEstateHero from "@/assets/market/cat-real-estate-hero.webp";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { type ListingCardData } from "@/components/marketplace/ListingCard";
import {
  PropertyCard,
  PropertyCardSkeleton,
} from "@/components/marketplace/real-estate/PropertyCard";
import { Mascot } from "@/components/marketplace/campaign/Mascot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/i18n";
import { addListingHref } from "@/lib/add-listing";
import { geoName, loadCities, loadCountries, useMarketPreference } from "@/lib/mkt-geo";
import { isRetiredSubcategory } from "@/lib/mkt-category-alias";
import { loadCategories, loadListingsPage } from "@/lib/mkt-queries";
import { loadListingGalleries } from "@/lib/mkt-listing-galleries";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export interface RealEstateSearchParams {
  q?: string | undefined;
  domain?: string | undefined;
  category?: string | undefined;
  sub?: string | undefined;
  type?: string | undefined;
  cityId?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  img?: string | undefined;
  sort?: string | undefined;
  /** الحدود الدنيا لتفاصيل العقار. */
  rooms?: string | undefined;
  baths?: string | undefined;
  area?: string | undefined;
}


interface RealEstateExperienceProps {
  params: RealEstateSearchParams;
  onUpdate: (patch: Partial<RealEstateSearchParams>) => void;
}

interface PurposeOption {
  code: string;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

const PAGE_SIZE = 12;
const REFERENCE_STALE_TIME = 5 * 60_000;

const PURPOSES: PurposeOption[] = [
  {
    code: "property_sale",
    labelKey: "market.realEstate.purposes.buy",
    descriptionKey: "market.realEstate.purposes.buyHint",
    icon: Home,
  },
  {
    code: "property_rent",
    labelKey: "market.realEstate.purposes.rent",
    descriptionKey: "market.realEstate.purposes.rentHint",
    icon: KeyRound,
  },
  {
    code: "property_wanted_buy",
    labelKey: "market.realEstate.purposes.wantedBuy",
    descriptionKey: "market.realEstate.purposes.wantedBuyHint",
    icon: Search,
  },
  {
    code: "property_wanted_rent",
    labelKey: "market.realEstate.purposes.wantedRent",
    descriptionKey: "market.realEstate.purposes.wantedRentHint",
    icon: Building2,
  },
];

function validPrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizedSort(value: string | undefined) {
  switch (value) {
    case "oldest":
    case "views":
    case "price_asc":
    case "price_desc":
      return value;
    default:
      return "newest" as const;
  }
}

function activeFeatured(listing: ListingCardData): boolean {
  if (!listing.is_featured) return false;
  if (!listing.featured_until) return true;
  return new Date(listing.featured_until).getTime() > Date.now();
}

export function RealEstateExperience({ params, onUpdate }: RealEstateExperienceProps) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const isMobile = useIsMobile();
  const { preference } = useMarketPreference();
  const [term, setTerm] = useState(params.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<RealEstateSearchParams>(params);

  useEffect(() => setTerm(params.q ?? ""), [params.q]);
  useEffect(() => {
    if (filtersOpen) setDraft(params);
  }, [filtersOpen, params]);

  const categories = useQuery({
    queryKey: ["mkt", "categories"],
    queryFn: loadCategories,
    staleTime: REFERENCE_STALE_TIME,
  });
  const countries = useQuery({
    queryKey: ["mkt", "countries"],
    queryFn: loadCountries,
    staleTime: REFERENCE_STALE_TIME,
  });
  const country = (countries.data ?? []).find((row) => row.iso2 === preference.countryIso2);
  const cities = useQuery({
    queryKey: ["mkt", "cities", country?.id],
    enabled: !!country?.id,
    queryFn: () => loadCities(country?.id),
    staleTime: REFERENCE_STALE_TIME,
  });

  const root = (categories.data ?? []).find(
    (category) => !category.parent_id && category.slug === "real-estate",
  );
  const subcategories = useMemo(
    () =>
      (categories.data ?? []).filter(
        (category) =>
          !!category.parent_id &&
          category.parent_id === root?.id &&
          // The retired duplicate label is no longer offered as a choice; the
          // row itself is untouched.
          !isRetiredSubcategory(category.slug),
      ),
    [categories.data, root?.id],
  );
  const subcategoryId = useMemo(() => {
    if (!params.sub) return undefined;
    const rows = categories.data ?? [];
    return rows.find((category) => category.id === params.sub || category.slug === params.sub)?.id;
  }, [categories.data, params.sub]);

  const listings = useInfiniteQuery({
    queryKey: [
      "mkt",
      "real-estate",
      "listings",
      {
        q: params.q,
        subcategoryId,
        type: params.type,
        cityId: params.cityId,
        min: params.min,
        max: params.max,
        img: params.img,
        rooms: params.rooms,
        baths: params.baths,
        area: params.area,
        sort: normalizedSort(params.sort),
        country: preference.countryIso2,
      },
      locale,
    ],
    enabled: categories.isSuccess,
    initialPageParam: 0,
    staleTime: 30_000,
    queryFn: ({ pageParam }) =>
      loadListingsPage(
        {
          q: params.q,
          categorySlug: "real-estate",
          subcategoryId,
          type: params.type,
          cityId: params.cityId,
          countryIso2: preference.countryIso2,
          minPrice: validPrice(params.min),
          maxPrice: validPrice(params.max),
          minRooms: validPrice(params.rooms),
          minBaths: validPrice(params.baths),
          minArea: validPrice(params.area),
          withImageOnly: params.img === "1" ? true : undefined,
          sort: normalizedSort(params.sort),
          limit: PAGE_SIZE,
        },
        locale,
        pageParam,
      ),
    getNextPageParam: (last, pages) => (last.fetched < PAGE_SIZE ? undefined : pages.length),
  });

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const result: ListingCardData[] = [];
    for (const page of listings.data?.pages ?? []) {
      for (const row of page.rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        result.push(row);
      }
    }
    return result;
  }, [listings.data]);

  // صور المعرض الداخلي لكل البطاقات الظاهرة في استعلام واحد مجمّع.
  const galleryIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const galleries = useQuery({
    queryKey: ["mkt", "real-estate", "galleries", galleryIds],
    enabled: galleryIds.length > 0,
    staleTime: 60_000,
    queryFn: () => loadListingGalleries(galleryIds),
  });
  const galleryFor = (id: string) => galleries.data?.[id] ?? [];

  const featuredRows = useMemo(() => rows.filter(activeFeatured).slice(0, 8), [rows]);
  const selectedCity = (cities.data ?? []).find((city) => city.id === params.cityId);
  const locationLabel =
    geoName(selectedCity, locale) ||
    geoName(country, locale) ||
    t("market.realEstate.locationFallback");
  const activeFilters = [
    params.q,
    params.sub,
    params.type,
    params.cityId,
    params.min,
    params.max,
    params.img,
    params.rooms,
    params.baths,
    params.area,
    params.sort && params.sort !== "newest" ? params.sort : undefined,
  ].filter(Boolean).length;
  const addHref = addListingHref({
    authenticated: !!session,
    fieldSlug: "real-estate",
  });

  const clearFilters = () =>
    onUpdate({
      q: undefined,
      sub: undefined,
      type: undefined,
      cityId: undefined,
      min: undefined,
      max: undefined,
      img: undefined,
      rooms: undefined,
      baths: undefined,
      area: undefined,
      sort: undefined,
    });


  return (
    <MarketShell footer="none">
      <div className="real-estate-experience bg-background">
        <section className="relative isolate min-h-[240px] overflow-hidden bg-market-navy sm:min-h-[280px]">
          <img
            src={realEstateHero}
            alt=""
            aria-hidden
            width={768}
            height={576}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-market-navy/25 via-market-navy/55 to-market-navy-dark" />

          <div className="market-hero-band relative mx-auto flex min-h-[240px] w-full max-w-[1240px] flex-col px-4 pb-10 sm:min-h-[280px] sm:px-6 sm:pb-14 lg:px-8">
            <div className="flex items-center justify-between gap-3 text-market-navy-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-market-navy-foreground/25 bg-market-navy/45 px-3 py-1.5 text-xs font-semibold shadow-sm">
                <Building2 className="size-4" aria-hidden />
                {t("market.realEstate.brand")}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-market-silver sm:text-sm">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{locationLabel}</span>
              </span>
            </div>

            <div className="my-auto max-w-2xl py-3 text-market-navy-foreground sm:py-4">
              <p className="text-xs font-semibold tracking-wide text-market-silver sm:text-sm">
                {t("market.realEstate.eyebrow")}
              </p>
              <h1 className="mt-1.5 font-bold leading-tight tracking-tight">
                {t("market.realEstate.heroTitle")}
              </h1>
              <p className="mt-1.5 max-w-xl text-market-silver">
                {t("market.realEstate.heroDescription")}
              </p>
            </div>

            <form
              role="search"
              className="relative w-full max-w-3xl"
              onSubmit={(event) => {
                event.preventDefault();
                onUpdate({ q: term.trim() || undefined });
              }}
            >
              <Search
                className="pointer-events-none absolute top-1/2 size-5 -translate-y-1/2 text-market-navy start-4"
                aria-hidden
              />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                aria-label={t("market.realEstate.searchLabel")}
                placeholder={t("market.realEstate.searchPlaceholder")}
                className="h-14 w-full rounded-2xl border border-market-navy-foreground/35 bg-market-navy-foreground px-12 text-base font-medium text-market-navy shadow-raised outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-market-silver sm:h-16 sm:rounded-3xl"
              />
              {term && (
                <button
                  type="button"
                  aria-label={t("market.search.clear")}
                  onClick={() => {
                    setTerm("");
                    onUpdate({ q: undefined });
                  }}
                  className="absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-market-silver end-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </form>
          </div>
        </section>

        <div className="relative z-10 -mt-9 rounded-t-[2rem] bg-background pb-8 pt-6 shadow-[0_-12px_40px_-28px_var(--color-market-navy)] sm:-mt-14 sm:rounded-t-[2.5rem] sm:pt-9">
          <div className="mx-auto w-full max-w-[1240px] px-3 sm:px-5 lg:px-8">
            <SectionHeading
              title={t("market.realEstate.intentTitle")}
              description={t("market.realEstate.intentDescription")}
            />

            <div className="market-rail -mx-3 mt-4 flex snap-x gap-2.5 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
              {PURPOSES.map((purpose) => {
                const Icon = purpose.icon;
                const active = params.type === purpose.code;
                return (
                  <button
                    key={purpose.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onUpdate({ type: active ? undefined : purpose.code, sub: undefined })
                    }
                    className={cn(
                      "group min-w-[148px] snap-start rounded-2xl border p-3 text-start shadow-panel transition duration-200 sm:min-w-0 sm:p-4",
                      active
                        ? "border-market-navy bg-market-navy text-market-navy-foreground"
                        : "border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-market-navy-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-xl",
                        active
                          ? "bg-market-navy-soft text-market-navy-foreground"
                          : "bg-market-silver text-market-navy",
                      )}
                    >
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <strong className="mt-3 block text-sm">{t(purpose.labelKey)}</strong>
                    <span
                      className={cn(
                        "mt-1 block text-[11px] leading-5",
                        active ? "text-market-silver" : "text-muted-foreground",
                      )}
                    >
                      {t(purpose.descriptionKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="real-estate-deferred mt-7">
              <SectionHeading
                title={t("market.realEstate.propertyTypesTitle")}
                description={t("market.realEstate.propertyTypesDescription")}
              />
              <div className="market-rail -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
                <FilterChip
                  active={!params.sub}
                  onClick={() => onUpdate({ sub: undefined })}
                  label={t("market.realEstate.allProperties")}
                />
                {subcategories.map((subcategory) => (
                  <FilterChip
                    key={subcategory.id}
                    active={subcategoryId === subcategory.id}
                    onClick={() =>
                      onUpdate({
                        sub: subcategoryId === subcategory.id ? undefined : subcategory.id,
                      })
                    }
                    label={
                      locale === "ar"
                        ? subcategory.name_ar
                        : subcategory.name_en || subcategory.name_ar
                    }
                  />
                ))}
                {categories.isLoading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-24 shrink-0 rounded-full" />
                  ))}
              </div>
              {/* The indexed, shareable page of the category. Without this link
                  `/categories/real-estate` was a canonical destination no
                  visitor could reach from the interface. */}
              <Link
                to="/categories/$slug"
                params={{ slug: "real-estate" }}
                className="mt-3 inline-block text-xs font-bold text-primary underline-offset-4 hover:underline"
              >
                {t("market.search.categoryPage")}
              </Link>
            </div>


            <div className="real-estate-deferred mt-7">
              <SectionHeading
                title={t("market.realEstate.citiesTitle")}
                description={t("market.realEstate.citiesDescription")}
              />
              <div className="market-rail -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
                <FilterChip
                  active={!params.cityId}
                  onClick={() => onUpdate({ cityId: undefined })}
                  label={t("market.filters.allCities")}
                  icon={MapPin}
                />
                {(cities.data ?? []).slice(0, 14).map((city) => (
                  <FilterChip
                    key={city.id}
                    active={params.cityId === city.id}
                    onClick={() =>
                      onUpdate({ cityId: params.cityId === city.id ? undefined : city.id })
                    }
                    label={geoName(city, locale)}
                  />
                ))}
              </div>
            </div>

            <div className="real-estate-deferred mt-8">
              <div className="flex items-end justify-between gap-3">
                <SectionHeading
                  title={
                    featuredRows.length > 0
                      ? t("market.realEstate.featuredTitle")
                      : t("market.realEstate.latestTitle")
                  }
                  description={t("market.realEstate.resultsDescription", {
                    location: locationLabel,
                  })}
                />
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-panel hover:border-market-navy-soft"
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                  {t("market.search.filtersBtn")}
                  {activeFilters > 0 && (
                    <span className="num grid min-w-5 place-items-center rounded-full bg-market-navy px-1 text-[10px] leading-5 text-market-navy-foreground">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </div>

              {featuredRows.length > 0 && (
                <div className="market-rail -mx-3 mt-4 flex snap-x gap-3 overflow-x-auto px-3 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                  {featuredRows.map((listing, index) => (
                    <div
                      key={listing.id}
                      className="w-[78vw] max-w-[340px] shrink-0 snap-center sm:w-auto sm:max-w-none"
                    >
                      <EstateCard listing={listing} priority={index < 2} featured />
                    </div>
                  ))}
                </div>
              )}

              {featuredRows.length > 0 && (
                <h2 className="mt-8 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {t("market.realEstate.latestTitle")}
                </h2>
              )}

              {listings.isLoading ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
                  ))}
                </div>
              ) : listings.isError ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">{t("market.loadError")}</p>
                  <Button className="mt-4" size="sm" onClick={() => void listings.refetch()}>
                    {t("market.retry")}
                  </Button>
                </div>
              ) : rows.length === 0 ? (
                <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card p-6 text-center shadow-panel sm:p-10">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-market-silver text-market-navy">
                    <Building2 className="size-6" aria-hidden />
                  </span>
                  <h2 className="mt-4 text-lg font-bold text-foreground">
                    {t("market.realEstate.emptyTitle")}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {t("market.realEstate.emptyDescription")}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {activeFilters > 0 && (
                      <Button type="button" variant="outline" onClick={clearFilters}>
                        {t("market.search.clearFilters")}
                      </Button>
                    )}
                    <Button asChild>
                      <a href={addHref}>{t("market.realEstate.addProperty")}</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {rows.map((listing, index) => (
                    <EstateCard key={listing.id} listing={listing} priority={index < 4} />
                  ))}
                </div>
              )}

              {listings.hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-40 rounded-full"
                    disabled={listings.isFetchingNextPage}
                    onClick={() => void listings.fetchNextPage()}
                  >
                    {listings.isFetchingNextPage ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <ChevronLeft className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                    )}
                    {t("market.realEstate.showMore")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          hideClose
          className="flex max-h-[88dvh] flex-col gap-0 p-0 sm:max-w-sm"
        >
          <SheetHeader className="flex shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-4 py-2 text-start">
            <SheetTitle className="min-w-0 flex-1 truncate text-base">
              {t("market.realEstate.filtersTitle")}
            </SheetTitle>
            <SheetClose
              aria-label={t("market.filters.close")}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" aria-hidden />
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="space-y-1.5">
              <Label htmlFor="real-estate-filter-city">{t("market.filters.city")}</Label>
              <select
                id="real-estate-filter-city"
                value={draft.cityId ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, cityId: event.target.value || undefined })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{t("market.filters.allCities")}</option>
                {(cities.data ?? []).map((city) => (
                  <option key={city.id} value={city.id}>
                    {geoName(city, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="real-estate-filter-type">{t("market.search.offerType")}</Label>
              <select
                id="real-estate-filter-type"
                value={draft.type ?? ""}
                onChange={(event) => setDraft({ ...draft, type: event.target.value || undefined })}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{t("market.filters.all")}</option>
                {PURPOSES.map((purpose) => (
                  <option key={purpose.code} value={purpose.code}>
                    {t(purpose.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="real-estate-filter-sub">{t("market.filters.subcategory")}</Label>
              <select
                id="real-estate-filter-sub"
                value={draft.sub ?? ""}
                onChange={(event) => setDraft({ ...draft, sub: event.target.value || undefined })}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{t("market.realEstate.allProperties")}</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {locale === "ar"
                      ? subcategory.name_ar
                      : subcategory.name_en || subcategory.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="real-estate-filter-min">{t("market.filters.minPrice")}</Label>
                <Input
                  id="real-estate-filter-min"
                  dir="ltr"
                  inputMode="numeric"
                  value={draft.min ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      min: event.target.value.replace(/\D/g, "") || undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="real-estate-filter-max">{t("market.filters.maxPrice")}</Label>
                <Input
                  id="real-estate-filter-max"
                  dir="ltr"
                  inputMode="numeric"
                  value={draft.max ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      max: event.target.value.replace(/\D/g, "") || undefined,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="real-estate-filter-sort">{t("market.filters.sort")}</Label>
              <select
                id="real-estate-filter-sort"
                value={draft.sort ?? "newest"}
                onChange={(event) => setDraft({ ...draft, sort: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="newest">{t("market.sort.newest")}</option>
                <option value="price_asc">{t("market.sort.priceAsc")}</option>
                <option value="price_desc">{t("market.sort.priceDesc")}</option>
                <option value="views">{t("market.sort.views")}</option>
              </select>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm text-foreground">
              <Checkbox
                checked={draft.img === "1"}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, img: checked === true ? "1" : undefined })
                }
              />
              {t("market.search.withImages")}
            </label>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  onUpdate(draft);
                  setFiltersOpen(false);
                }}
              >
                {t("market.search.apply")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setFiltersOpen(false);
                  clearFilters();
                }}
              >
                {t("market.search.clearFilters")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </MarketShell>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
        active
          ? "border-market-navy bg-market-navy text-market-navy-foreground"
          : "border-border bg-card text-foreground hover:border-market-navy-soft",
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {label}
    </button>
  );
}
