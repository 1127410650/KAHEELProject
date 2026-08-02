import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, Eye, MapPin, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  BUSINESS_COLUMNS,
  LISTING_COLUMNS,
  priceLabel,
  resolveMedia,
  type MktBusiness,
  type MktListing,
} from "@/lib/mkt";
import { decorateListings, loadListingTypes } from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
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
    const description = "تفاصيل الإعلان والسعر والمواصفات وبيانات المنشأة المعلنة في سوق تحقّق للخدمات والمقاولات.";
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

  const [{ data: imageRows }, { data: bizRow }, types] = await Promise.all([
    supabase
      .from("mkt_listing_images")
      .select("id, url, alt_text, sort_order")
      .eq("listing_id", listing.id)
      .order("sort_order"),
    listing.tenant_id
      ? supabase.from("mkt_business_profiles").select(BUSINESS_COLUMNS).eq("tenant_id", listing.tenant_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadListingTypes(),
  ]);

  const paths = [listing.cover_image_url, ...(imageRows ?? []).map((r) => r.url)];
  const media = await resolveMedia(paths);
  const gallery = Array.from(
    new Set([listing.cover_image_url, ...(imageRows ?? []).map((r) => r.url)].filter((p): p is string => !!p)),
  )
    .map((p) => media[p])
    .filter((u): u is string => !!u);

  return {
    listing,
    gallery,
    business: (bizRow as MktBusiness | null) ?? null,
    type: types.find((tp) => tp.code === listing.type_code) ?? null,
  };
}

function AdPage() {
  const { slug } = Route.useParams();
  const { action } = Route.useSearch();
  const { t, locale } = useI18n();
  const { session } = useSession();
  const [active, setActive] = useState(0);

  const ad = useQuery({ queryKey: ["mkt", "ad", slug], queryFn: () => loadAd(slug) });

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
    if (ad.data?.listing.id) void supabase.rpc("mkt_increment_views", { _listing_id: ad.data.listing.id });
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

  const { listing, gallery, business, type } = ad.data;
  const specs = (listing.specs && typeof listing.specs === "object" ? listing.specs : {}) as Record<string, unknown>;

  return (
    <MarketShell>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <article className="min-w-0">
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            {gallery.length > 0 ? (
              <img src={gallery[active]} alt={listing.title} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="grid aspect-[16/10] w-full place-items-center text-sm text-muted-foreground">
                {t("market.noImage")}
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActive(i)}
                  className={
                    i === active
                      ? "size-16 shrink-0 overflow-hidden rounded-lg border-2 border-primary"
                      : "size-16 shrink-0 overflow-hidden rounded-lg border border-border"
                  }
                >
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
            <VerifiedBadge status={business?.verification_status} />
          </div>

          <h1 className="mt-2 text-xl font-bold leading-snug text-foreground sm:text-2xl">{listing.title}</h1>
          <p className="mt-2 text-lg font-bold text-primary">
            {priceLabel(listing, t("market.priceOnRequest"))}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {listing.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {listing.city}
                {listing.region ? ` — ${listing.region}` : ""}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {listing.published_at
                ? new Date(listing.published_at).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })
                : "—"}
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

          {listing.summary && <p className="mt-4 text-sm text-foreground">{listing.summary}</p>}
          {listing.description && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">{t("market.ad.details")}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {listing.description}
              </p>
            </div>
          )}

          {(Object.keys(specs).length > 0 || listing.quantity) && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">{t("market.ad.specs")}</h2>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {listing.quantity !== null && (
                  <div className="flex justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground">{t("market.quote.quantity")}</dt>
                    <dd className="font-medium text-foreground" dir="ltr">
                      {listing.quantity} {listing.unit ?? ""}
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

          <section className="mt-8">
            <h2 className="mb-3 text-base font-bold text-foreground">{t("market.ad.similar")}</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(similar.data ?? []).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {(similar.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{t("market.emptySection")}</p>
            )}
          </section>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4">
            <ListingActions listing={listing} pendingAction={action} />
            {!session && <p className="mt-3 text-xs text-muted-foreground">{t("market.ad.signInHint")}</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">{t("market.ad.advertiser")}</h2>
            {business ? (
              <>
                <Link
                  to="/businesses/$slug"
                  params={{ slug: business.slug }}
                  className="mt-2 block text-sm font-semibold text-primary"
                >
                  {locale === "ar" ? business.display_name_ar : business.display_name_en || business.display_name_ar}
                </Link>
                <div className="mt-1">
                  <VerifiedBadge status={business.verification_status} />
                </div>
                {business.city && <p className="mt-2 text-xs text-muted-foreground">{business.city}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("market.business.joined")}:{" "}
                  {new Date(business.joined_at).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
                </p>
                {session ? (
                  <div className="mt-2 space-y-1 text-xs text-foreground" dir="ltr">
                    {business.show_phone && business.public_phone && <p>{business.public_phone}</p>}
                    {business.show_whatsapp && business.public_whatsapp && <p>{business.public_whatsapp}</p>}
                    {business.show_email && business.public_email && <p>{business.public_email}</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t("market.ad.contactHidden")}</p>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("market.ad.individualAdvertiser")}</p>
            )}
            {!session && (
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/login">{t("market.signIn")}</Link>
              </Button>
            )}
          </div>
        </aside>
      </div>
    </MarketShell>
  );
}
