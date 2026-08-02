import { Link } from "@tanstack/react-router";
import { BadgeCheck, Eye, MapPin } from "lucide-react";

import { useI18n } from "@/i18n";
import { priceLabel, type MktListing } from "@/lib/mkt";

export function VerifiedBadge({ status }: { status: string | null | undefined }) {
  const { t } = useI18n();
  if (status !== "verified") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <BadgeCheck className="size-3.5" aria-hidden />
      {t("market.verified")}
    </span>
  );
}

export interface ListingCardData extends MktListing {
  businessName?: string | null;
  businessSlug?: string | null;
  verificationStatus?: string | null;
  imageUrl?: string | null;
  typeLabel?: string;
}

export function ListingCard({ listing, view = "grid" }: { listing: ListingCardData; view?: "grid" | "list" }) {
  const { t } = useI18n();
  const price = priceLabel(listing, t("market.priceOnRequest"));

  return (
    <Link
      to="/ads/$slug"
      params={{ slug: listing.slug ?? listing.id }}
      className={
        view === "list"
          ? "flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
          : "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
      }
    >
      <div
        className={
          view === "list"
            ? "size-24 shrink-0 overflow-hidden rounded-lg bg-muted"
            : "aspect-[4/3] w-full overflow-hidden bg-muted"
        }
      >
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-muted-foreground">
            {t("market.noImage")}
          </div>
        )}
      </div>

      <div className={view === "list" ? "min-w-0 flex-1" : "flex flex-1 flex-col p-3"}>
        <div className="flex flex-wrap items-center gap-2">
          {listing.typeLabel && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {listing.typeLabel}
            </span>
          )}
          <VerifiedBadge status={listing.verificationStatus} />
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground">{listing.title}</h3>
        {listing.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{listing.summary}</p>
        )}
        <div className="mt-auto pt-2">
          <p className="text-sm font-bold text-primary">{price}</p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            {listing.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {listing.city}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" aria-hidden />
              {listing.views_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
