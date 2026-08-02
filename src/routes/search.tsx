import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";

import { useI18n } from "@/i18n";
import { SA_CITIES } from "@/lib/mkt";
import { loadCategories, loadListingTypes, loadListings } from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard } from "@/components/marketplace/ListingCard";
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
  min?: string | undefined;
  max?: string | undefined;
  verified?: string | undefined;
  deal?: string | undefined;
  sort?: string | undefined;
  view?: string | undefined;
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
      "min",
      "max",
      "verified",
      "deal",
      "sort",
      "view",
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

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const types = useQuery({ queryKey: ["mkt", "types"], queryFn: loadListingTypes });

  const listings = useQuery({
    queryKey: ["mkt", "search", params, locale],
    queryFn: () =>
      loadListings(
        {
          q: params.q,
          categorySlug: params.category,
          subcategoryId: params.sub,
          type: params.type,
          city: params.city,
          minPrice: params.min ? Number(params.min) : undefined,
          maxPrice: params.max ? Number(params.max) : undefined,
          verifiedOnly: params.verified === "1",
          deal: params.deal === "sale" || params.deal === "rent" ? params.deal : undefined,
          sort:
            params.sort === "views" || params.sort === "price_asc" || params.sort === "price_desc"
              ? params.sort
              : "newest",
        },
        locale,
      ),
  });

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
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-xl border border-border bg-card p-4">
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
            <Label>{t("market.filters.city")}</Label>
            <select
              value={params.city ?? ""}
              onChange={(e) => update({ city: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t("market.filters.allCities")}</option>
              {SA_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={params.verified === "1"}
              onChange={(e) => update({ verified: e.target.checked ? "1" : undefined })}
              className="size-4 rounded border-input"
            />
            {t("market.filters.verifiedOnly")}
          </label>

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
              {t("market.resultsCount", { count: (listings.data ?? []).length })}
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
          ) : (listings.data ?? []).length === 0 ? (
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {(listings.data ?? []).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(listings.data ?? []).map((l) => (
                <ListingCard key={l.id} listing={l} view="list" />
              ))}
            </div>
          )}
        </section>
      </div>
    </MarketShell>
  );
}
