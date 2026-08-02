import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { BUSINESS_COLUMNS, LISTING_COLUMNS, type MktBusiness, type MktListing } from "@/lib/mkt";
import { decorateListings } from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/businesses/$slug")({
  ssr: false,
  head: ({ params }) => {
    const title = `منشأة ${params.slug} — سوق تحقّق`;
    const description = "صفحة المنشأة في سوق تحقّق: نبذة، مجالات العمل، حالة التوثيق، والإعلانات المنشورة.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: BusinessPage,
});

function BusinessPage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const business = useQuery({
    queryKey: ["mkt", "business", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_business_profiles")
        .select(BUSINESS_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      return (data as MktBusiness | null) ?? null;
    },
  });

  const listings = useQuery({
    queryKey: ["mkt", "business-listings", business.data?.tenant_id, locale],
    enabled: !!business.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("tenant_id", business.data!.tenant_id)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(48);
      return decorateListings((data ?? []) as unknown as MktListing[], locale);
    },
  });

  if (business.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </MarketShell>
    );
  }

  const biz = business.data;
  if (!biz) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground">{t("market.business.notFound")}</h1>
          <Link to="/marketplace" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("market.nav.marketplace")}
          </Link>
        </div>
      </MarketShell>
    );
  }

  const name = locale === "ar" ? biz.display_name_ar : biz.display_name_en || biz.display_name_ar;
  const about = locale === "ar" ? biz.about_ar : biz.about_en || biz.about_ar;

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <header className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <VerifiedBadge status={biz.verification_status} />
                {biz.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {biz.city}
                  </span>
                )}
                <span>
                  {t("market.business.joined")}:{" "}
                  {new Date(biz.joined_at).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
                </span>
              </div>
            </div>
          </div>

          {about && (
            <>
              <h2 className="mt-4 text-sm font-bold text-foreground">{t("market.business.about")}</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{about}</p>
            </>
          )}

          <h2 className="mt-4 text-sm font-bold text-foreground">{t("market.business.contact")}</h2>
          {session ? (
            <div className="mt-1 space-y-1 text-sm text-foreground" dir="ltr">
              {biz.show_phone && biz.public_phone && <p>{biz.public_phone}</p>}
              {biz.show_whatsapp && biz.public_whatsapp && <p>{biz.public_whatsapp}</p>}
              {biz.show_email && biz.public_email && <p>{biz.public_email}</p>}
              {biz.website && (
                <a href={biz.website} target="_blank" rel="noreferrer noopener" className="text-primary">
                  {biz.website}
                </a>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("market.ad.contactHidden")}</p>
          )}
        </header>

        <h2 className="mt-6 text-base font-bold text-foreground">{t("market.business.listings")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {listings.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)
            : (listings.data ?? []).map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
        {!listings.isLoading && (listings.data ?? []).length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("market.business.noListings")}</p>
        )}
      </div>
    </MarketShell>
  );
}
