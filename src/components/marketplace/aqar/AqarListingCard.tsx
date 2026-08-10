/**
 * بطاقة إعلان عقاري: كاروسيل صور بالسحب + قلب مفضلة + السعر بعملته.
 * عرض فقط — كل البيانات تأتي مُجهّزة من `src/lib/mkt-aqar.ts`.
 */

import { Link } from "@tanstack/react-router";
import { Heart, ImageOff, MapPin } from "lucide-react";
import { useState } from "react";

import { AQAR_TYPE_LABELS } from "@/lib/aqar-imagery";
import { aqarMetaLine, formatAqarPrice, type AqarListing } from "@/lib/mkt-aqar";

export function AqarListingCard({
  listing,
  usdRate,
  isFavorite,
  onToggleFavorite,
  className,
}: {
  listing: AqarListing;
  usdRate: number | null;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const price = formatAqarPrice(listing, usdRate);
  const photos = listing.photos;
  const shown = photos[Math.min(index, Math.max(photos.length - 1, 0))];

  return (
    <article
      className={`k-card-premium relative flex flex-col ${className ?? ""}`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-[10px] bg-muted">
        {shown ? (
          <img
            src={shown}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-6" aria-hidden />
          </div>
        )}

        {photos.length > 1 ? (
          <>
            {/* أزرار التنقل بين الصور — أهداف لمس 44px بلا حجب الصورة. */}
            <button
              type="button"
              aria-label="الصورة السابقة"
              onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
              className="absolute inset-y-0 right-0 w-11"
            />
            <button
              type="button"
              aria-label="الصورة التالية"
              onClick={() => setIndex((i) => (i + 1) % photos.length)}
              className="absolute inset-y-0 left-0 w-11"
            />
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
              {photos.map((photo, i) => (
                <span
                  key={photo}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-card" : "w-1.5 bg-card/60"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}

        <button
          type="button"
          aria-label={isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(listing.id)}
          className="absolute end-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm"
        >
          <Heart
            className={`size-4 ${isFavorite ? "fill-primary text-primary" : ""}`}
            aria-hidden
          />
        </button>

        <span className="k-pill absolute start-2 top-2 text-nav font-bold">
          {AQAR_TYPE_LABELS[listing.property_type] ?? "عقار"}
        </span>
        {listing.is_demo ? (
          <span className="absolute start-2 top-11 rounded-full bg-secondary px-2 py-0.5 text-nav font-bold text-secondary-foreground">
            إعلان تجريبي
          </span>
        ) : null}
      </div>

      <div className="mt-[var(--sp-2)] flex flex-1 flex-col">
        <Link
          to="/aqar/$id"
          params={{ id: listing.id }}
          className="line-clamp-2 text-[15px] font-bold leading-[1.3] text-foreground"
        >
          {listing.title}
        </Link>
        <p className="mt-[var(--sp-1)] flex items-center gap-[var(--sp-1)] text-[14px] font-medium leading-[1.6] text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {listing.city}
            {listing.district ? ` — ${listing.district}` : ""}
          </span>
        </p>
        <p className="text-[14px] font-medium leading-[1.6] text-muted-foreground">{aqarMetaLine(listing)}</p>
        <p className="mt-auto pt-[var(--sp-2)]">
          <strong className="text-[16px] font-extrabold leading-[1.3] text-foreground">{price.main}</strong>
          {price.period ? (
            <span className="text-[14px] font-medium text-muted-foreground"> {price.period}</span>
          ) : null}
          {price.secondary ? (
            <span className="block text-[14px] font-medium text-muted-foreground">≈ {price.secondary}</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
