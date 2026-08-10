/**
 * صف أفقي لبطاقات الإعلانات العقارية.
 * تمرير باللمس مع نقاط توقف (scroll-snap) وبطاقة ثابتة العرض على الجوال.
 */

import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { AqarListingCard } from "@/components/marketplace/aqar/AqarListingCard";
import type { AqarListing, AqarTrack } from "@/lib/mkt-aqar";

export function AqarListingRail({
  title,
  listings,
  usdRate,
  favorites,
  onToggleFavorite,
  moreTrack,
  emptyText = "لا توجد إعلانات في هذا القسم بعد.",
}: {
  title: string;
  listings: AqarListing[];
  usdRate: number | null;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  /** رابط «الكل» — يفتح صفحة البحث على نفس المسار. */
  moreTrack?: AqarTrack;
  emptyText?: string;
}) {
  return (
    <section className="py-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-4">
        <h2 className="text-section font-extrabold text-foreground">{title}</h2>
        {moreTrack && listings.length > 0 ? (
          <Link
            to="/aqar/browse"
            search={{ track: moreTrack }}
            className="inline-flex min-h-[44px] items-center gap-0.5 text-desc font-bold text-primary"
          >
            الكل
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      {listings.length === 0 ? (
        <p className="px-4 text-desc text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {listings.map((listing) => (
            <li key={listing.id} className="w-[15rem] shrink-0 snap-start sm:w-[17rem]">
              <AqarListingCard
                listing={listing}
                usdRate={usdRate}
                isFavorite={favorites.includes(listing.id)}
                onToggleFavorite={onToggleFavorite}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
