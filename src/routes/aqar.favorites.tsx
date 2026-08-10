/** مفضلة كَحيل عقار — محفوظة على هذا الجهاز، تُقرأ من نفس مخزن القلب في البطاقات. */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";

import { AqarListingCard } from "@/components/marketplace/aqar/AqarListingCard";
import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { fetchAqarListing, fetchAqarUsdRate } from "@/lib/mkt-aqar";

export const Route = createFileRoute("/aqar/favorites")({
  head: () => ({
    meta: [
      { title: "المفضلة — كَحيل عقار" },
      { name: "description", content: "العقارات التي حفظتها على هذا الجهاز في كَحيل عقار." },
      { property: "og:title", content: "المفضلة — كَحيل عقار" },
      { property: "og:description", content: "قائمة العقارات المحفوظة في كَحيل عقار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AqarFavoritesPage,
});

function AqarFavoritesPage() {
  const { ids, toggle } = useAqarFavorites();

  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });
  const listings = useQuery({
    queryKey: ["aqar", "favorites", ids],
    queryFn: async () => {
      const rows = await Promise.all(ids.map((id) => fetchAqarListing(id)));
      return rows.filter((row): row is NonNullable<typeof row> => row !== null);
    },
    enabled: ids.length > 0,
  });

  const rows = listings.data ?? [];

  return (
    <AqarShell title="المفضلة" subtitle="محفوظة على هذا الجهاز" back="/aqar" backLabel="عقار">
      <div className="mx-auto w-full max-w-3xl p-4">
        {ids.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Heart className="size-8 text-primary" aria-hidden />
            <p className="text-body text-foreground">لم تحفظ أي عقار بعد.</p>
            <Link to="/aqar" className="text-desc font-bold text-primary">
              تصفّح العقارات
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((listing) => (
              <li key={listing.id}>
                <AqarListingCard
                  listing={listing}
                  usdRate={usdRate.data ?? null}
                  isFavorite
                  onToggleFavorite={toggle}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AqarShell>
  );
}
