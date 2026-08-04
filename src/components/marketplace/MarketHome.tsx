import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Home,
  Plus,
  Search,
  Sparkles,
  Tag,
  Truck,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { loadListings } from "@/lib/mkt-queries";
import { useSuggestedListings } from "@/lib/mkt-activity";

import { ListingCard } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";


type Items = React.ComponentProps<typeof ListingCard>["listing"][];

/** Section header shared by listing and business rows. */
function SectionHead({
  title,
  href,
  search,
}: {
  title: string;
  href: string;
  search?: Record<string, string>;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{title}</h2>
      <Link
        to={href}
        search={search ?? {}}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
      >
        {t("market.viewAll")}
        <ArrowLeft className="size-4 ltr:rotate-180 rtl:rotate-0" aria-hidden />
      </Link>
    </div>
  );
}

/** A section renders only when it has content, so the page never shows a wall
 *  of empty placeholders. Four items on desktop, two on phones. */
function ListingSection({
  title,
  href,
  search,
  items,
  loading,
}: {
  title: string;
  href: string;
  search?: Record<string, string>;
  items: Items;
  loading: boolean;
}) {
  if (!loading && items.length === 0) return null;
  const shown = items.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:py-7">
      <SectionHead title={title} href={href} {...(search ? { search } : {})} />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,340px))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={i > 1 ? "hidden h-56 rounded-xl sm:block" : "h-28 w-full rounded-xl sm:h-56"} />
          ))}
        </div>
      ) : (
        <>
          {/* Phones get two compact horizontal rows; larger screens get a grid of
              280–340px columns that stays start-aligned with one item only. */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {shown.slice(0, 2).map((listing) => (
              <ListingCard key={listing.id} listing={listing} view="row" />
            ))}
          </div>
          <div className="hidden justify-start gap-3 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(280px,340px))]">
            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** The only top strip: five broad fields. Sub-categories live in search,
 *  filters and the listing form — never here. */
const QUICK_FILTERS = [
  { key: "realestate", search: { category: "real-estate" }, icon: Home },
  { key: "service", search: { type: "service" }, icon: Sparkles },
  { key: "product", search: { type: "product" }, icon: Tag },
  { key: "equipment_rent", search: { type: "equipment_rent" }, icon: Truck },
  { key: "business", search: { domain: "business" }, icon: Building2 },
] as const;

/** Where the fields rail keeps its horizontal position between visits. */
const RAIL_KEY = "mkt:home:fields-scroll";

export function MarketHome() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const railRef = useRef<HTMLDivElement | null>(null);

  // Restore the rail position so returning from a search feels continuous.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const saved = Number(sessionStorage.getItem(RAIL_KEY) ?? "0");
    if (Number.isFinite(saved) && saved !== 0) rail.scrollLeft = saved;
  }, []);

  const { preference } = useMarketPreference();
  // The home page always reflects the market the visitor picked.
  const geo = { countryIso2: preference.countryIso2, cityId: preference.cityId ?? undefined };
  const geoKey = `${preference.countryIso2}:${preference.cityId ?? "all"}`;

  // Two grouped queries only — one for the suggestion row, one for the latest row.
  const latest = useQuery({
    queryKey: ["mkt", "home", "latest", locale, geoKey],
    queryFn: () => loadListings({ ...geo, limit: 8 }, locale),
  });
  const suggested = useSuggestedListings(locale, geo);

  const anyLoading = latest.isLoading || suggested.isLoading;
  const suggestedItems = (suggested.data ?? []).slice(0, 4);
  const suggestedIds = new Set(suggestedItems.map((l) => l.id));
  // Avoid showing the same ad twice on one page.
  const latestItems = (latest.data ?? []).filter((l) => !suggestedIds.has(l.id)).slice(0, 4);
  const isEmpty = !anyLoading && suggestedItems.length === 0 && latestItems.length === 0;






  return (
    <>
      {/* Entry strip — a calm light band holding one white search card and one
          primary action. No marketing copy lives inside the marketplace. */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-4 sm:pb-4 sm:pt-6">
          <form
            role="search"
            className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-panel"
            onSubmit={(event) => {
              event.preventDefault();
              const term = query.trim();
              void navigate({ to: "/search", search: term ? { q: term } : {} });
            }}
          >
            <label htmlFor="home-search" className="sr-only">
              {t("market.nav.search")}
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="home-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("market.searchPlaceholder")}
                className="h-11 border-0 bg-transparent ps-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" size="sm" className="h-11 shrink-0 rounded-xl px-4">
              {t("market.nav.search")}
            </Button>
          </form>
        </div>
      </section>

      {/* Fields strip — one horizontal, drag/wheel scrollable rail that keeps its
          position when the visitor comes back from a search. */}
      <div className="bg-background">
        <div
          ref={railRef}
          onWheel={(event) => {
            const rail = railRef.current;
            if (!rail) return;
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            rail.scrollLeft += event.deltaY;
          }}
          onScroll={() => {
            if (railRef.current) sessionStorage.setItem(RAIL_KEY, String(railRef.current.scrollLeft));
          }}
          className="mx-auto flex w-full max-w-7xl snap-x gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {QUICK_FILTERS.map((f) => (
            <Link
              key={f.key}
              to="/search"
              search={f.search}
              className="inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-primary"
            >
              <f.icon className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="whitespace-nowrap">{t(`market.quick.${f.key}`)}</span>
            </Link>
          ))}
        </div>
      </div>


      {isEmpty ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">{t("market.emptyHome")}</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/dashboard/ads/new">
              <Plus className="size-4" aria-hidden />
              {t("market.addListing")}
            </Link>
          </Button>
        </section>
      ) : (
        <>
          {/* Suggested for you — built from this visitor's own recent market activity. */}
          <ListingSection
            title={t("market.sections.suggested")}
            href="/search"
            items={suggestedItems}
            loading={suggested.isLoading}
          />
          <ListingSection
            title={t("market.sections.latest")}
            href="/search"
            items={latestItems}
            loading={latest.isLoading}
          />
        </>

      )}
    </>
  );

}
