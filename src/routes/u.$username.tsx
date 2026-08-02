import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { loadGeoLabel } from "@/lib/mkt-geo";
import { useSession } from "@/lib/session";
import { LISTING_COLUMNS, resolveMedia, type MktListing } from "@/lib/mkt";
import { decorateListings, loadUserProfileBySlug } from "@/lib/mkt-queries";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard, VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/u/$username")({
  ssr: false,
  head: ({ params }) => {
    const title = `${params.username} — معلن في سوق تحقّق`;
    const description =
      "الملف العام للمعلن الفرد في سوق تحقّق: النبذة، المدينة، حالة التوثيق، وجميع إعلاناته المنشورة.";
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
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const profile = useQuery({
    queryKey: ["mkt", "user-profile", username],
    queryFn: () => loadUserProfileBySlug(username),
  });

  const avatar = useQuery({
    queryKey: ["mkt", "user-avatar", profile.data?.avatar_url],
    enabled: !!profile.data?.avatar_url,
    queryFn: async () => {
      const media = await resolveMedia([profile.data!.avatar_url]);
      return media[profile.data!.avatar_url!] ?? null;
    },
  });

  const listings = useQuery({
    queryKey: ["mkt", "user-listings", profile.data?.user_id, locale],
    enabled: !!profile.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("owner_user_id", profile.data!.user_id)
        .is("tenant_id", null)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(48);
      return decorateListings((data ?? []) as unknown as MktListing[], locale);
    },
  });

  if (profile.isLoading) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </MarketShell>
    );
  }

  const me = profile.data;
  if (!me) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground">{t("market.person.notFound")}</h1>
          <Link to="/marketplace" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("market.nav.marketplace")}
          </Link>
        </div>
      </MarketShell>
    );
  }

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
        <header className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-muted-foreground">
              {avatar.data ? (
                <img src={avatar.data} alt={me.display_name} className="size-full object-cover" />
              ) : (
                <User className="size-6" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground sm:text-2xl">
                {me.display_name}
              </h1>
              <p className="text-xs text-muted-foreground">@{me.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                  {t("market.advertiser.individual")}
                </span>
                <VerifiedBadge status={me.verification_status} size="xs" />
                {(geoLabel.data ?? me.city) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {geoLabel.data ?? me.city}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {t("market.business.joined")}:{" "}
                  {new Date(me.joined_at).toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}
                </span>
              </div>
            </div>
          </div>

          {me.headline && <p className="mt-3 text-sm text-foreground">{me.headline}</p>}
          {me.about && (
            <>
              <h2 className="mt-4 text-sm font-bold text-foreground">
                {t("market.business.about")}
              </h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {me.about}
              </p>
            </>
          )}

          <h2 className="mt-4 text-sm font-bold text-foreground">{t("market.business.contact")}</h2>
          {session ? (
            <div className="mt-1 space-y-1 text-sm text-foreground" dir="ltr">
              {me.show_phone && me.public_phone && <p>{me.public_phone}</p>}
              {me.show_whatsapp && me.public_whatsapp && <p>{me.public_whatsapp}</p>}
              {me.show_email && me.public_email && <p>{me.public_email}</p>}
              {!(
                (me.show_phone && me.public_phone) ||
                (me.show_whatsapp && me.public_whatsapp) ||
                (me.show_email && me.public_email)
              ) && <p className="text-xs text-muted-foreground">{t("market.ad.contactPrivate")}</p>}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("market.ad.contactHidden")}</p>
          )}
        </header>

        <h2 className="mt-6 text-base font-bold text-foreground">{t("market.person.listings")}</h2>
        <div className="mt-3 flex flex-col gap-2.5 sm:hidden">
          {(listings.data ?? []).map((l) => (
            <ListingCard key={l.id} listing={l} view="row" />
          ))}
        </div>
        <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {listings.isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))
            : (listings.data ?? []).map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
        {!listings.isLoading && (listings.data ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("market.business.noListings")}
          </p>
        )}
      </div>
    </MarketShell>
  );
}
