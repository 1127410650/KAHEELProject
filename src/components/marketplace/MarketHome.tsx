import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Home,
  Plus,
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={i > 1 ? "hidden h-56 rounded-xl sm:block" : "h-28 w-full rounded-xl sm:h-56"} />
          ))}
        </div>
      ) : (
        <>
          {/* Phones get two compact horizontal rows; larger screens get a grid. */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {shown.slice(0, 2).map((listing) => (
              <ListingCard key={listing.id} listing={listing} view="row" />
            ))}
          </div>
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
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

export function MarketHome() {
  const { t, locale } = useI18n();
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
      {/* Hero — title and one primary action; search lives in the header. */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/70 via-background to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,var(--color-primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-primary)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
        />
        <div className="relative mx-auto w-full max-w-4xl px-4 py-6 text-center sm:py-9">
          <h1 className="mx-auto max-w-3xl text-balance text-xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
            {t("market.hero.title")}
          </h1>

          <Button asChild size="sm" className="mt-4">
            <Link to="/dashboard/ads/new">
              <Plus className="size-4" aria-hidden />
              {t("market.addListing")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Fields strip — wraps into a compact grid on phones so nothing is clipped. */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-2 px-4 py-3 sm:flex sm:flex-wrap sm:justify-center">
          {QUICK_FILTERS.map((f, i) => (
            <Link
              key={f.key}
              to="/search"
              search={f.search}
              className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/60 hover:text-primary sm:w-auto sm:px-3.5 ${
                i === QUICK_FILTERS.length - 1 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <f.icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t(`market.quick.${f.key}`)}</span>
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
