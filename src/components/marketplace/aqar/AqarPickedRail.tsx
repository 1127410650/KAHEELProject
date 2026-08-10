/**
 * صف «اختيارات مخصصة لك»: بطاقات إعلان بتشريح كامل (صورة 4:3، قلب، تقييم،
 * عنوان، موقع، سعر) بعرض 62% فتُطلّ البطاقة التالية. عرض فقط.
 */

import { Link } from "@tanstack/react-router";
import { ChevronLeft, Heart, ImageOff, Star } from "lucide-react";

import { aqarDisplayRating } from "@/lib/aqar-display-rating";
import { formatAqarPrice, type AqarListing, type AqarTrack } from "@/lib/mkt-aqar";

export function AqarPickedRail({
  title,
  listings,
  usdRate,
  favorites,
  onToggleFavorite,
  moreTrack,
  emptyText = "لا توجد اختيارات في هذا المسار بعد.",
}: {
  title: string;
  listings: AqarListing[];
  usdRate: number | null;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  moreTrack?: AqarTrack;
  emptyText?: string;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2.5 flex items-center justify-between gap-2 px-4">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
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
          {listings.map((listing) => {
            const price = formatAqarPrice(listing, usdRate);
            const rating = aqarDisplayRating(listing.id);
            const favorite = favorites.includes(listing.id);
            const cover = listing.photos[0];
            return (
              <li key={listing.id} className="w-[62%] max-w-[240px] shrink-0 snap-start">
                <Link to="/aqar/$id" params={{ id: listing.id }} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--r-img)] bg-muted">
                    {cover ? (
                      <img
                        src={cover}
                        alt={listing.title}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-6" aria-hidden />
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                      aria-pressed={favorite}
                      onClick={(event) => {
                        event.preventDefault();
                        onToggleFavorite(listing.id);
                      }}
                      className="absolute start-2 top-2 grid size-8 place-items-center rounded-full bg-card/95 text-foreground shadow-sm"
                    >
                      <Heart
                        className={`size-4 ${favorite ? "fill-primary text-primary" : ""}`}
                        aria-hidden
                      />
                    </button>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-sm">
                    <Star className="size-3.5 fill-current text-foreground" aria-hidden />
                    <b className="font-bold text-foreground">{rating.score}</b>
                    <span className="text-muted-foreground">({rating.count})</span>
                  </p>
                  <p className="truncate text-[15px] font-bold text-foreground">{listing.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {listing.city}
                    {listing.district ? ` - ${listing.district}` : ""}
                  </p>
                  <p className="text-[15px] font-extrabold text-foreground">
                    {price.main}
                    {price.period ? (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {" "}
                        {price.period}
                      </span>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
