import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { addListingHref } from "@/lib/add-listing";
import { useSession } from "@/lib/session";
import { useI18n } from "@/i18n";
import { useMarketPreference } from "@/lib/mkt-geo";
import { LISTING_COLUMNS, type MktCategory, type MktListing } from "@/lib/mkt";
import { decorateListings, loadCategories } from "@/lib/mkt-queries";
import { canonicalCategorySlug, isRetiredSubcategory } from "@/lib/mkt-category-alias";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { kidsFriendFor, isKidsWorld } from "@/lib/kids-friends";
import {
  KidsEmptyState,
  KidsFriendBadge,
  KidsFriendsStrip,
} from "@/components/marketplace/kids/KidsFriendsStrip";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/categories/$slug")({
  ssr: false,
  // Legacy alias slugs land on the canonical «عقارات» page with their
  // city / filters / sort / page / hash intact. `canonicalCategorySlug` is a
  // fixed point for canonical slugs, so this can never loop.
  beforeLoad: ({ params, location }) => {
    const canonical = canonicalCategorySlug(params.slug);
    if (canonical === params.slug) return;
    throw redirect({
      to: "/categories/$slug",
      params: { slug: canonical },
      search: location.search as never,
      ...(location.hash ? { hash: location.hash } : {}),
      replace: true,
    });
  },


  head: ({ params }) => {
    const title = `تصنيف ${params.slug} — كَحيل`;
    const description =
      "تصفّح إعلانات الخدمات والمنتجات والمعدات في هذا التصنيف داخل كَحيل للمقاولات والتوريد.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index, follow" },
        ...canonicalMeta(`/categories/${params.slug}`),
      ],
      links: canonicalLinks(`/categories/${params.slug}`),
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const { session } = useSession();

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const category = (categories.data ?? []).find((c) => c.slug === slug) ?? null;
  const children = (categories.data ?? []).filter(
    (c) => c.parent_id === category?.id && !isRetiredSubcategory(c.slug),
  );

  const { preference } = useMarketPreference();
  const listings = useQuery({
    queryKey: [
      "mkt",
      "category-listings",
      category?.id,
      locale,
      preference.countryIso2,
      preference.cityId,
    ],
    enabled: !!category,
    queryFn: async () => {
      const ids = [category!.id, ...children.map((c) => c.id)];
      // Category pages follow the market the visitor is browsing.
      const { data: country } = await supabase
        .from("mkt_countries")
        .select("id")
        .eq("iso2", preference.countryIso2)
        .maybeSingle();
      let query = supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .eq("status", "published")
        .is("deleted_at", null)
        .in("category_id", ids);
      if (country?.id) query = query.eq("country_id", country.id);
      if (preference.cityId) query = query.eq("city_id", preference.cityId);
      const { data } = await query.order("published_at", { ascending: false }).limit(48);
      return decorateListings((data ?? []) as unknown as MktListing[], locale);
    },
  });

  const parentSlug =
    (categories.data ?? []).find((c) => c.id === category?.parent_id)?.slug ?? null;
  const parentName =
    (categories.data ?? []).find((c) => c.id === category?.parent_id)?.name_ar ?? null;
  const kidsWorld = isKidsWorld([
    category?.slug,
    parentSlug,
    category?.name_ar,
    category?.name_en,
    parentName,
  ]);

  const name = (c: MktCategory) => (locale === "ar" ? c.name_ar : c.name_en || c.name_ar);

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        {categories.isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : !category ? (
          <div className="py-20 text-center">
            <h1 className="text-xl font-bold text-foreground">{t("market.category.notFound")}</h1>
            <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary">
              {t("market.nav.marketplace")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{name(category)}</h1>
            {kidsWorld && <KidsFriendsStrip className="mt-4" />}
            {children.length > 0 && (
              <>
                <h2 className="mt-5 text-sm font-bold text-foreground">
                  {t("market.category.subcategories")}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {children.map((c, i) => (
                    <Link
                      key={c.id}
                      to="/categories/$slug"
                      params={{ slug: c.slug }}
                      className={
                        kidsWorld
                          ? "k-press inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pe-3 ps-1 text-xs font-bold text-foreground hover:bg-accent"
                          : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      }
                    >
                      {kidsWorld && (
                        <KidsFriendBadge id={kidsFriendFor({ slug: c.slug, name: name(c) }, i)} />
                      )}
                      {name(c)}
                    </Link>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {listings.isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-56 rounded-xl" />
                  ))
                : (listings.data ?? []).map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
            {!listings.isLoading &&
              (listings.data ?? []).length === 0 &&
              (kidsWorld ? (
                <div className="mt-6">
                  <KidsEmptyState
                    id={kidsFriendFor({ slug: category.slug, name: name(category) })}
                    actionHref={addListingHref({
                      authenticated: !!session,
                      fieldSlug: category.parent_id ? null : category.slug,
                    })}
                    actionLabel={t("market.addListing")}
                  />
                </div>
              ) : (
                <div className="py-16 text-center">
                  <p className="text-sm text-muted-foreground">{t("market.noResults")}</p>
                  <a
                    href={addListingHref({
                      authenticated: !!session,
                      fieldSlug: category.parent_id ? null : category.slug,
                    })}
                    className="mt-3 inline-block text-sm font-medium text-primary"
                  >
                    {t("market.addListing")}
                  </a>
                </div>
              ))}
          </>
        )}
      </div>
    </MarketShell>
  );
}
