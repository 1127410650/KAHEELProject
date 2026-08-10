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
    <section className="k-section">
      <div className="k-gutter flex items-center justify-between gap-[var(--sp-2)] pb-[var(--sp-3)]">
        <h2 className="k-section-title mb-0">{title}</h2>
        {moreTrack && listings.length > 0 ? (
          <Link
            to="/aqar/browse"
            search={{ track: moreTrack }}
            className="inline-flex min-h-11 items-center gap-[var(--sp-1)] text-[14px] font-bold text-primary"
          >
            الكل
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      {listings.length === 0 ? (
        <p className="k-gutter text-[14px] font-medium text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="k-rail flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {listings.map((listing) => {
            const price = formatAqarPrice(listing, usdRate);
            const rating = aqarDisplayRating(listing.id);
            const favorite = favorites.includes(listing.id);
            const cover = listing.photos[0];
            return (
              <li key={listing.id} className="w-[62%] max-w-[240px] shrink-0 snap-start">
                <Link to="/aqar/$id" params={{ id: listing.id }} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-muted">
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
                  <p className="mt-[var(--sp-2)] flex items-center gap-[var(--sp-1)] text-[14px] font-medium leading-[1.6]">
                    <Star className="size-3.5 fill-current text-foreground" aria-hidden />
                    <b className="font-bold text-foreground">{rating.score}</b>
                    <span className="text-muted-foreground">({rating.count})</span>
                  </p>
                  <p className="mt-[var(--sp-1)] truncate text-[15px] font-bold leading-[1.3] text-foreground">{listing.title}</p>
                  <p className="mt-[var(--sp-1)] truncate text-[14px] font-medium leading-[1.6] text-muted-foreground">
                    {listing.city}
                    {listing.district ? ` - ${listing.district}` : ""}
                  </p>
                  <p className="mt-[var(--sp-2)] text-[16px] font-extrabold leading-[1.3] text-foreground">
                    {price.main}
                    {price.period ? (
                      <span className="text-[14px] font-medium text-muted-foreground">
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
