import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, Eye, MapPin, Store, User } from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { geoName, loadPublicPhone, type MktCity, type MktCountry } from "@/lib/mkt-geo";
import {
  BUSINESS_COLUMNS,
  LISTING_COLUMNS,
  USER_PROFILE_COLUMNS,
  priceLabel,
  relativeTime,
  resolveMedia,
  type MktBusiness,
  type MktCategory,
  type MktListing,
  type MktUserProfile,
} from "@/lib/mkt";
import { decorateListings, loadListingTypes } from "@/lib/mkt-queries";
import { trackMarketActivity } from "@/lib/mkt-activity";
import { locationLink } from "@/lib/mkt-location-link";
import { loadPublicLicense } from "@/lib/mkt-license";

import { track } from "@/lib/analytics";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { PropertySpecsBar } from "@/components/marketplace/real-estate/PropertyCard";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ListingGallery } from "@/components/marketplace/ListingGallery";
import { ListingActions } from "@/components/marketplace/ListingActions";
import { ListingSpecs } from "@/components/marketplace/ListingSpecs";
import { ListingLicenseSection } from "@/components/marketplace/ListingLicenseSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

interface AdSearch {
  action?: string | undefined;
}

export const Route = createFileRoute("/ads/$slug")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>): AdSearch =>
    typeof search["action"] === "string" ? { action: search["action"] } : {},
  head: ({ params }) => {
    const title = `إعلان ${params.slug} — كَحيل`;
    const description =
      "تفاصيل الإعلان والسعر والمواصفات وبيانات المعلن في كَحيل للخدمات والمقاولات.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index, follow" },
        ...canonicalMeta(`/ads/${params.slug}`),
      ],
      links: canonicalLinks(`/ads/${params.slug}`),
    };
  },
  component: AdPage,
});

/**
 * One ad with everything the page needs. Visibility is decided by the database
 * policies: a suspended, draft or soft-deleted ad simply returns no row for
 * anyone but its owner (or a platform admin).
 */
async function loadAd(slug: string) {
  const { data } = await supabase
    .from("mkt_listings")
    .select(`${LISTING_COLUMNS}, deleted_at`)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const listing = data as unknown as MktListing & { deleted_at: string | null };

  const [{ data: imageRows }, { data: bizRow }, { data: personRow }, types, { data: catRows }] =
    await Promise.all([
      supabase
        .from("mkt_listing_images")
        .select("id, url, alt_text, sort_order")
        .eq("listing_id", listing.id)
        .order("sort_order"),
      listing.tenant_id
        ? supabase
            .from("mkt_business_profiles")
            .select(BUSINESS_COLUMNS)
            .eq("tenant_id", listing.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      listing.tenant_id
        ? Promise.resolve({ data: null })
        : supabase
            .from("mkt_user_profiles")
            .select(USER_PROFILE_COLUMNS)
            .eq("user_id", listing.owner_user_id)
            .maybeSingle(),
      loadListingTypes(),
      supabase
        .from("mkt_categories")
        .select("id, parent_id, slug, name_ar, name_en, icon, sort_order")
        .in(
          "id",
          [listing.category_id, listing.subcategory_id].filter((v): v is string => !!v),
        ),
    ]);

  const [{ data: countryRow }, { data: cityRow }, { count: activeAds }] = await Promise.all([
    listing.country_id
      ? supabase
          .from("mkt_countries")
          .select("id, iso2, name_ar, name_en, calling_code, currency_code, sort_order")
          .eq("id", listing.country_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    listing.city_id
      ? supabase
          .from("mkt_cities")
          .select("id, country_id, name_ar, name_en, sort_order")
          .eq("id", listing.city_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    listing.tenant_id
      ? supabase
          .from("mkt_listings")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", listing.tenant_id)
          .eq("status", "published")
          .is("deleted_at", null)
      : supabase
          .from("mkt_listings")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", listing.owner_user_id)
          .is("tenant_id", null)
          .eq("status", "published")
          .is("deleted_at", null),
  ]);

  const paths = Array.from(
    new Set(
      [listing.cover_image_url, ...(imageRows ?? []).map((r) => r.url)].filter(
        (p): p is string => !!p,
      ),
    ),
  );
  const media = await resolveMedia(paths);
  const gallery = paths.map((p) => media[p]).filter((u): u is string => !!u);

  const categories = (catRows ?? []) as MktCategory[];
  const rootSlug = categories.find((c) => !c.parent_id)?.slug ?? null;

  // Licence facts only exist for real estate ads; the row itself carries only
  // what the authority allows an ad to publish.
  const license = rootSlug === "real-estate" ? await loadPublicLicense(listing.id) : null;

  return {
    listing,
    gallery,
    license,
    business: (bizRow as MktBusiness | null) ?? null,
    person: (personRow as MktUserProfile | null) ?? null,
    type: types.find((tp) => tp.code === listing.type_code) ?? null,
    category: categories.find((c) => c.id === listing.category_id) ?? null,
    subcategory: categories.find((c) => c.id === listing.subcategory_id) ?? null,
    country: (countryRow as MktCountry | null) ?? null,
    city: (cityRow as MktCity | null) ?? null,
    activeAds: activeAds ?? null,
  };
}

type AdData = NonNullable<Awaited<ReturnType<typeof loadAd>>>;

/** The description, folded when it is genuinely long. */
function DescriptionBlock({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const long = text.length > 420;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-section font-bold text-foreground">{t("market.ad.description")}</h2>
      <p
        className={
          long && !open
            ? "mt-2 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
            : "mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
        }
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-desc font-medium text-primary"
        >
          {open ? t("market.ad.showLess") : t("market.ad.showMore")}
        </button>
      )}
    </section>
  );
}

/** "About the advertiser": identity, and the only place the check mark appears. */
function AdvertiserSection({ ad, cityLabel }: { ad: AdData; cityLabel: string | null }) {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const { business, person, activeAds } = ad;

  const isBusiness = !!business;
  const name = business
    ? locale === "ar"
      ? business.display_name_ar
      : business.display_name_en || business.display_name_ar
    : (person?.display_name ?? t("market.advertiser.individual"));
  const status = business?.verification_status ?? person?.verification_status ?? null;
  const city = business?.city ?? person?.city ?? cityLabel;
  const joined = business?.joined_at ?? person?.joined_at ?? null;
  const logo = business?.logo_url ?? null;

  // An individual's number lives in their private contact record and comes back
  // from the database only when they chose to publish it.
  const personPhone = useQuery({
    queryKey: ["mkt", "public-phone", person?.user_id],
    enabled: !!session && !business && !!person?.user_id,
    queryFn: () => loadPublicPhone(person!.user_id),
  });

  const contacts = [
    business ? (business.show_phone ? business.public_phone : null) : (personPhone.data ?? null),
    business
      ? business.show_whatsapp
        ? business.public_whatsapp
        : null
      : person?.show_whatsapp
        ? person.public_whatsapp
        : null,
    business
      ? business.show_email
        ? business.public_email
        : null
      : person?.show_email
        ? person.public_email
        : null,
  ].filter((v): v is string => !!v);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-section font-bold text-foreground">{t("market.ad.aboutAdvertiser")}</h2>

      <div className="mt-3 flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-muted-foreground">
          {logo ? (
            <img src={logo} alt="" loading="lazy" className="size-full object-cover" />
          ) : isBusiness ? (
            <Store className="size-5" aria-hidden />
          ) : (
            <User className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {/* Check mark sits under the identity name only; nothing when absent. */}
          <VerifiedBadge status={status} size="xs" />
          <p className="text-desc text-muted-foreground">
            {t(`market.advertiser.${isBusiness ? "business" : "individual"}`)}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-desc text-muted-foreground">
        {city && (
          <div className="flex gap-1.5">
            <dt>{t("market.filters.city")}:</dt>
            <dd className="min-w-0 text-foreground">{city}</dd>
          </div>
        )}
        {joined && (
          <div className="flex gap-1.5">
            <dt>{t("market.business.joined")}:</dt>
            <dd className="text-foreground" dir="ltr">
              {new Date(joined).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
            </dd>
          </div>
        )}
        {typeof activeAds === "number" && activeAds > 0 && (
          <div className="flex gap-1.5">
            <dt>{t("market.ad.activeAds")}:</dt>
            <dd className="text-foreground">{activeAds}</dd>
          </div>
        )}
      </dl>

      {(business?.slug || person?.username) && (
        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          {business ? (
            <Link to="/businesses/$slug" params={{ slug: business.slug }}>
              {t("market.ad.visitProfile")}
            </Link>
          ) : (
            <Link to="/profiles/$username" params={{ username: person!.username }}>
              {t("market.ad.visitProfile")}
            </Link>
          )}
        </Button>
      )}

      {session && contacts.length > 0 && (
        <div className="mt-3 space-y-1 text-desc text-foreground" dir="ltr">
          {contacts.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Owner-only tools. Every action goes through the database policies. */
function OwnerTools({ listing, onDone }: { listing: MktListing; onDone: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  type ListingPatch = { status?: string; deleted_at?: string };

  async function update(patch: ListingPatch, message: string) {
    setBusy(true);
    const { error } = await supabase.from("mkt_listings").update(patch).eq("id", listing.id);
    setBusy(false);
    if (error) {
      toast.error(t("market.actions.failed"));
      return;
    }
    toast.success(message);
    onDone();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-section font-bold text-foreground">{t("market.ad.ownerTools")}</h2>
      <p className="mt-1 text-desc text-muted-foreground">{t("market.ad.yourAd")}</p>
      <div className="mt-3 grid gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link to="/my/ads/$id/edit" params={{ id: listing.id }}>
            {t("market.ad.edit")}
          </Link>
        </Button>
        {listing.status === "published" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void update({ status: "draft" }, t("market.ad.unpublished"))}
          >
            {t("market.ad.unpublish")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void update(
              { deleted_at: new Date().toISOString(), status: "archived" },
              t("market.ad.deletedOk"),
            ).then(() => navigate({ to: "/my/ads" }))
          }
        >
          {t("market.ad.softDelete")}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/my/ads">{t("market.ad.statusPreview")}</Link>
        </Button>
      </div>
    </section>
  );
}

function AdPage() {
  const { slug } = Route.useParams();
  const { action } = Route.useSearch();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const ad = useQuery({ queryKey: ["mkt", "ad", slug], queryFn: () => loadAd(slug) });

  const similar = useQuery({
    queryKey: ["mkt", "similar", ad.data?.listing.id, locale],
    enabled: !!ad.data && ad.data.listing.status === "published",
    queryFn: async () => {
      const listing = ad.data!.listing;
      let query = supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("status", "published")
        .is("deleted_at", null)
        .eq("category_id", listing.category_id)
        .neq("id", listing.id);
      if (listing.subcategory_id) query = query.eq("subcategory_id", listing.subcategory_id);
      const { data } = await query.order("published_at", { ascending: false }).limit(4);
      let rows = (data ?? []) as unknown as MktListing[];
      if (rows.length === 0) {
        const { data: wider } = await supabase
          .from("mkt_listings")
          .select(LISTING_COLUMNS)
          .eq("status", "published")
          .is("deleted_at", null)
          .eq("category_id", listing.category_id)
          .neq("id", listing.id)
          .order("published_at", { ascending: false })
          .limit(4);
        rows = (wider ?? []) as unknown as MktListing[];
      }
      // Same city and same purpose first, then the most recent.
      rows.sort(
        (a, b) =>
          Number(b.city_id === listing.city_id) - Number(a.city_id === listing.city_id) ||
          Number(b.type_code === listing.type_code) - Number(a.type_code === listing.type_code),
      );
      return decorateListings(rows, locale);
    },
  });

  useEffect(() => {
    const row = ad.data?.listing;
    if (!row?.id || row.status !== "published") return;
    void supabase.rpc("mkt_increment_views", { _listing_id: row.id });
    // Central analytics: a real listing view, visitors included.
    track({
      event_type: "listing_view",
      path: "/ads",
      listing_id: row.id,
      category_id: row.category_id ?? undefined,
      city_id: row.city_id ?? undefined,
    });
    // Feeds "Suggested for you" — ad + category + city only.
    trackMarketActivity({
      event: "view_ad",
      adId: row.id,
      categoryId: row.category_id,
      cityId: row.city_id,
    });
  }, [ad.data?.listing]);

  if (ad.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-8">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
        </div>
      </MarketShell>
    );
  }

  if (!ad.data) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-page font-bold text-foreground">{t("market.ad.notFound")}</h1>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("market.nav.marketplace")}
          </Link>
        </div>
      </MarketShell>
    );
  }

  const { listing, gallery, type, category, subcategory, country, city } = ad.data;
  const isOwner = session?.user.id === listing.owner_user_id;
  const visible = listing.status === "published" && !listing.deleted_at;

  const cityLabel = city ? geoName(city, locale) : listing.city;
  const countryLabel = country ? geoName(country, locale) : null;
  // The short summary is only worth a block of its own when it is not already
  // repeated in the title or the description.
  const summaryText = listing.summary?.trim() ?? "";
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const leadSummary =
    summaryText &&
    normalize(summaryText) !== normalize(listing.title) &&
    !normalize(listing.description ?? "").includes(normalize(summaryText))
      ? summaryText
      : null;

  // The country is redundant for the home market; it only helps across borders.
  const showCountry = !!countryLabel && country?.iso2 !== "SA";
  // One map link for the whole page: it lives in the icon row next to share.
  // An approximate ad exports only a blurred point or a plain place search.
  const mapHref =
    locationLink({
      latitude: listing.latitude_public,
      longitude: listing.longitude_public,
      visibility: listing.location_visibility,
      city: cityLabel ?? listing.city,
      district: listing.district ?? listing.region,
      country: country ? geoName(country, "en") : null,
    })?.href ?? null;

  const categoryPath = [category, subcategory]
    .filter((c): c is MktCategory => !!c)
    .map((c) => (locale === "ar" ? c.name_ar : c.name_en || c.name_ar))
    .join(" › ");

  return (
    <MarketShell>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-3 pb-6 pt-5 sm:px-4 sm:py-6 lg:grid-cols-[1fr_340px] lg:pb-6">
        <article className="min-w-0">
          {!visible && (
            <div className="mb-3 rounded-xl border border-border bg-secondary p-3">
              <p className="text-sm font-semibold text-secondary-foreground">
                {t(`market.dash.status.${listing.deleted_at ? "deleted" : listing.status}`)}
              </p>
              <p className="mt-1 text-desc text-muted-foreground">{t("market.ad.statusNotice")}</p>
              {listing.rejection_reason && (
                <p className="mt-1 text-desc text-destructive">{listing.rejection_reason}</p>
              )}
            </div>
          )}

          {/* Key facts first, gallery after: the order buyers read in. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {type && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-desc font-medium text-secondary-foreground">
                {locale === "ar" ? type.name_ar : type.name_en}
              </span>
            )}
            {listing.deal_kind && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-desc text-secondary-foreground">
                {t(`market.filters.${listing.deal_kind}`)}
              </span>
            )}
          </div>

          <h1 className="text-page mt-2 font-bold leading-snug text-foreground">
            {listing.title}
          </h1>
          <p className="mt-1 text-lg font-bold text-primary sm:text-xl">
            <bdi>{priceLabel(listing, "—", locale)}</bdi>
          </p>

          {/* شريط المواصفات السريعة (غرف · حمامات · مساحة) — يظهر فقط عند وجود قيم. */}
          <div className="mt-2">
            <PropertySpecsBar listing={listing as never} size="lg" />
          </div>

          {categoryPath && (
            <p className="mt-2 text-desc text-muted-foreground">{categoryPath}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-desc text-muted-foreground">
            {(cityLabel || listing.district) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {[showCountry ? countryLabel : null, cityLabel, listing.district]
                  .filter(Boolean)
                  .join(" — ")}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              <bdi>{relativeTime(listing.published_at ?? listing.created_at, locale)}</bdi>
            </span>
            {visible && (
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3.5" aria-hidden />
                {listing.views_count}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              {t("market.ad.refNo")}:<bdi dir="ltr">{listing.id.slice(0, 8).toUpperCase()}</bdi>
            </span>
          </div>

          <div className="mt-3">
            <ListingActions
              listing={listing}
              pendingAction={action}
              variant="quick"
              locationHref={mapHref}
            />
          </div>

          <div className="mt-3">
            <ListingGallery images={gallery} title={listing.title} />
          </div>

          {/* On phones the contact panel sits right under the gallery.
           * Owner tools and the contact panel are mutually exclusive. */}
          <div className="mt-4 lg:hidden">
            {isOwner ? (
              <OwnerTools listing={listing} onDone={() => void ad.refetch()} />
            ) : (
              <div className="rounded-xl border border-border bg-card p-4">
                <ListingActions listing={listing} pendingAction={action} />
              </div>
            )}
          </div>

          {leadSummary && (
            <section className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-section font-bold text-foreground">{t("market.ad.summary")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {leadSummary}
              </p>
            </section>
          )}

          {listing.description && <DescriptionBlock text={listing.description} />}

          <ListingSpecs listing={listing} />

          {/* Real estate licence facts: never for other categories, and never a
           * trust badge — account verification is a separate matter. */}
          {ad.data.license && <ListingLicenseSection license={ad.data.license} />}

          <div className="mt-4 lg:hidden">
            <AdvertiserSection ad={ad.data} cityLabel={cityLabel} />
          </div>

          {(similar.data ?? []).length > 0 && (
            <section className="mt-8">
              <h2 className="text-section mb-3 font-bold text-foreground">{t("market.ad.similar")}</h2>
              <div className="flex flex-col gap-2.5 sm:hidden">
                {(similar.data ?? []).map((l) => (
                  <ListingCard key={l.id} listing={l} view="row" />
                ))}
              </div>
              <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
                {(similar.data ?? []).map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block lg:self-start">
          {isOwner ? (
            <OwnerTools listing={listing} onDone={() => void ad.refetch()} />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <ListingActions listing={listing} pendingAction={action} />
            </div>
          )}
          <AdvertiserSection ad={ad.data} cityLabel={cityLabel} />
        </aside>
      </div>
    </MarketShell>
  );
}
