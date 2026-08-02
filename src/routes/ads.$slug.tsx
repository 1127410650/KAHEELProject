import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Building2, CalendarDays, Eye, MapPin, Share2, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { loadGeoLabel, loadPublicPhone } from "@/lib/mkt-geo";
import {
  BUSINESS_COLUMNS,
  LISTING_COLUMNS,
  USER_PROFILE_COLUMNS,
  priceLabel,
  relativeTime,
  resolveMedia,
  type MktBusiness,
  type MktListing,
  type MktUserProfile,
} from "@/lib/mkt";
import { decorateListings, loadListingTypes } from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ListingGallery } from "@/components/marketplace/ListingGallery";
import { ListingActions } from "@/components/marketplace/ListingActions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AdSearch {
  action?: string | undefined;
}

export const Route = createFileRoute("/ads/$slug")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AdSearch =>
    typeof search["action"] === "string" ? { action: search["action"] } : {},
  head: ({ params }) => {
    const title = `إعلان ${params.slug} — سوق تحقّق`;
    const description =
      "تفاصيل الإعلان والسعر والمواصفات وبيانات المعلن في سوق تحقّق للخدمات والمقاولات.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index, follow" },
      ],
    };
  },
  component: AdPage,
});

async function loadAd(slug: string) {
  const { data } = await supabase
    .from("mkt_listings")
    .select(LISTING_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const listing = data as unknown as MktListing;

  const [{ data: imageRows }, { data: bizRow }, { data: personRow }, types] = await Promise.all([
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

  return {
    listing,
    gallery,
    business: (bizRow as MktBusiness | null) ?? null,
    person: (personRow as MktUserProfile | null) ?? null,
    type: types.find((tp) => tp.code === listing.type_code) ?? null,
  };
}

/** Advertiser card: works for both an individual and a business identity. */
function AdvertiserCard({
  business,
  person,
}: {
  business: MktBusiness | null;
  person: MktUserProfile | null;
}) {
  const { t, locale } = useI18n();
  const { session } = useSession();

  const isBusiness = !!business;
  const name = business
    ? locale === "ar"
      ? business.display_name_ar
      : business.display_name_en || business.display_name_ar
    : (person?.display_name ?? t("market.advertiser.individual"));
  const status = business?.verification_status ?? person?.verification_status ?? null;
  const city = business?.city ?? person?.city ?? null;
  const joined = business?.joined_at ?? person?.joined_at ?? null;
  // An individual's number lives in their private contact record and is only
  // returned by the database when they chose to make it public.
  const personPhone = useQuery({
    queryKey: ["mkt", "public-phone", person?.user_id],
    enabled: !business && !!person?.user_id,
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
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">{t("market.ad.advertiser")}</h2>

      <div className="mt-2 flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
          {isBusiness ? (
            <Building2 className="size-4" aria-hidden />
          ) : (
            <User className="size-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          {business ? (
            <Link
              to="/businesses/$slug"
              params={{ slug: business.slug }}
              className="block truncate text-sm font-semibold text-primary"
            >
              {name}
            </Link>
          ) : person?.username ? (
            <Link
              to="/u/$username"
              params={{ username: person.username }}
              className="block truncate text-sm font-semibold text-primary"
            >
              {name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          )}
          {/* Check mark directly under the identity name; nothing negative when absent. */}
          <VerifiedBadge status={status} size="xs" />
          <p className="text-[11px] text-muted-foreground">
            {t(`market.advertiser.${isBusiness ? "business" : "individual"}`)}
          </p>
        </div>
      </div>


      {city && <p className="mt-2 text-xs text-muted-foreground">{city}</p>}
      {joined && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("market.business.joined")}:{" "}
          {new Date(joined).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
        </p>
      )}

      {session ? (
        contacts.length > 0 ? (
          <div className="mt-2 space-y-1 text-xs text-foreground" dir="ltr">
            {contacts.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t("market.ad.contactPrivate")}</p>
        )
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{t("market.ad.contactHidden")}</p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link to="/login">{t("market.signIn")}</Link>
          </Button>
        </>
      )}
    </div>
  );
}

function AdPage() {
  const { slug } = Route.useParams();
  const { action } = Route.useSearch();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const ad = useQuery({ queryKey: ["mkt", "ad", slug], queryFn: () => loadAd(slug) });

  const geoLabel = useQuery({
    queryKey: [
      "mkt",
      "geo-label",
      ad.data?.listing.country_id,
      ad.data?.listing.city_id,
      locale,
    ],
    enabled: !!ad.data,
    queryFn: () =>
      loadGeoLabel(ad.data!.listing.country_id, ad.data!.listing.city_id, locale),
  });


  const similar = useQuery({
    queryKey: ["mkt", "similar", ad.data?.listing.id, locale],
    enabled: !!ad.data,
    queryFn: async () => {
      const listing = ad.data!.listing;
      const { data } = await supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("status", "published")
        .is("deleted_at", null)
        .eq("category_id", listing.category_id)
        .neq("id", listing.id)
        .order("published_at", { ascending: false })
        .limit(4);
      return decorateListings((data ?? []) as unknown as MktListing[], locale);
    },
  });

  useEffect(() => {
    if (ad.data?.listing.id)
      void supabase.rpc("mkt_increment_views", { _listing_id: ad.data.listing.id });
  }, [ad.data?.listing.id]);

  if (ad.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </MarketShell>
    );
  }

  if (!ad.data) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground">{t("market.ad.notFound")}</h1>
          <Link to="/marketplace" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("market.nav.marketplace")}
          </Link>
        </div>
      </MarketShell>
    );
  }

  const { listing, gallery, business, person, type } = ad.data;
  const specs = (listing.specs && typeof listing.specs === "object" ? listing.specs : {}) as Record<
    string,
    unknown
  >;

  return (
    <MarketShell>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-3 py-5 sm:px-4 sm:py-6 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0">
          {/* Title first, then price, then gallery: the reading order buyers expect. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {type && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {locale === "ar" ? type.name_ar : type.name_en}
              </span>
            )}
            {listing.item_condition && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                {t(`market.condition.${listing.item_condition}`)}
              </span>
            )}
            {listing.deal_kind && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                {t(`market.filters.${listing.deal_kind}`)}
              </span>
            )}
            {/* No verification mark at the top of an ad: it belongs to the advertiser. */}

          </div>

          <h1 className="mt-2 text-lg font-bold leading-snug text-foreground sm:text-2xl">
            {listing.title}
          </h1>
          <p className="mt-1 text-lg font-bold text-primary sm:text-xl">
            {priceLabel(listing, t("market.priceOnRequest"))}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(geoLabel.data ?? listing.city) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {geoLabel.data ?? listing.city}
                {listing.region ? ` — ${listing.region}` : ""}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {relativeTime(listing.published_at ?? listing.created_at, locale)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              {listing.views_count}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.success(t("market.ad.linkCopied"));
              }}
            >
              <Share2 className="size-3.5" aria-hidden />
              {t("market.ad.share")}
            </button>
          </div>

          <div className="mt-3">
            <ListingGallery images={gallery} title={listing.title} />
          </div>

          {/* On phones the action panel sits right under the gallery. */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 lg:hidden">
            <ListingActions listing={listing} pendingAction={action} />
            {!session && (
              <p className="mt-3 text-xs text-muted-foreground">{t("market.ad.signInHint")}</p>
            )}
          </div>

          {listing.summary && <p className="mt-4 text-sm text-foreground">{listing.summary}</p>}

          {listing.description && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">{t("market.ad.details")}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {listing.description}
              </p>
            </div>
          )}

          {(Object.keys(specs).length > 0 || listing.quantity !== null) && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">{t("market.ad.specs")}</h2>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {listing.quantity !== null && (
                  <div className="flex justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground">{t("market.form.quantity")}</dt>
                    <dd className="font-medium text-foreground">
                      {listing.quantity}
                      {listing.unit ? ` ${listing.unit}` : ""}
                    </dd>
                  </div>
                )}
                {Object.entries(specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="font-medium text-foreground">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-4 lg:hidden">
            <AdvertiserCard business={business} person={person} />
          </div>

          {(similar.data ?? []).length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-base font-bold text-foreground">
                {t("market.ad.similar")}
              </h2>
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
          <div className="rounded-xl border border-border bg-card p-4">
            <ListingActions listing={listing} pendingAction={action} />
            {!session && (
              <p className="mt-3 text-xs text-muted-foreground">{t("market.ad.signInHint")}</p>
            )}
          </div>
          <AdvertiserCard business={business} person={person} />
        </aside>
      </div>
    </MarketShell>
  );
}
