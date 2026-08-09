import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { LISTING_COLUMNS, type MktListing } from "@/lib/mkt";
import { decorateListings } from "@/lib/mkt-queries";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { ListingCard } from "@/components/marketplace/ListingCard";

export const Route = createFileRoute("/my/favorites")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المفضلة — گحيل" },
      {
        name: "description",
        content: "الإعلانات التي أضفتها إلى المفضلة في گحيل للخدمات والموردين.",
      },
      { property: "og:title", content: "المفضلة — گحيل" },
      { property: "og:description", content: "قائمة الإعلانات المحفوظة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { t, locale } = useI18n();
  const { session } = useSession();

  const favorites = useQuery({
    queryKey: ["mkt", "favorites", session?.user.id, locale],
    enabled: !!session,
    queryFn: async () => {
      const { data: rows } = await supabase.from("mkt_favorites").select("listing_id");
      const ids = (rows ?? []).map((r) => r.listing_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("mkt_listings")
        .select(LISTING_COLUMNS)
        .in("id", ids)
        .eq("status", "published")
        .is("deleted_at", null);
      return decorateListings((data ?? []) as unknown as MktListing[], locale);
    },
  });

  return (
    <DashboardShell title={t("market.dash.favorites")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(favorites.data ?? []).map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
      {!favorites.isLoading && (favorites.data ?? []).length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("market.dash.noFavorites")}
        </p>
      )}
    </DashboardShell>
  );
}
