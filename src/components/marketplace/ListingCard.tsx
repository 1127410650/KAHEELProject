import { Link } from "@tanstack/react-router";
import { BadgeCheck, Building2, Clock, Eye, MapPin, User } from "lucide-react";

import { useI18n } from "@/i18n";
import { priceLabel, relativeTime, type MktListing } from "@/lib/mkt";

export function VerifiedBadge({
  status,
  size = "sm",
}: {
  status: string | null | undefined;
  size?: "sm" | "xs";
}) {
  const { t } = useI18n();
  if (status !== "verified") return null;
  return (
    <span
      className={
        size === "xs"
          ? "inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
          : "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
      }
    >
      <BadgeCheck className={size === "xs" ? "size-3" : "size-3.5"} aria-hidden />
      {t("market.verified")}
    </span>
  );
}

export interface ListingCardData extends MktListing {
  advertiserKind?: "individual" | "business" | undefined;
  advertiserName?: string | null | undefined;
  advertiserUsername?: string | null | undefined;
  businessName?: string | null | undefined;
  businessSlug?: string | null | undefined;
  verificationStatus?: string | null | undefined;
  imageUrl?: string | null | undefined;
  typeLabel?: string | undefined;
}

/** Advertiser line: name, identity kind and the trust badge of that identity. */
function Advertiser({ listing }: { listing: ListingCardData }) {
  const { t } = useI18n();
  const kind = listing.advertiserKind ?? (listing.tenant_id ? "business" : "individual");
  const Icon = kind === "business" ? Building2 : User;
  const name =
    listing.advertiserName ?? listing.businessName ?? t(`market.advertiser.${kind}`);
  return (
    <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
      <VerifiedBadge status={listing.verificationStatus} size="xs" />
    </span>
  );
}

export function ListingCard({
  listing,
  view = "grid",
}: {
  listing: ListingCardData;
  view?: "grid" | "list" | "row";
}) {
  const { t, locale } = useI18n();
  const price = priceLabel(listing, t("market.priceOnRequest"));
  const horizontal = view === "list" || view === "row";

  return (
    <Link
      to="/ads/$slug"
      params={{ slug: listing.slug ?? listing.id }}
      className={
        horizontal
          ? "flex gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/40"
          : "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
      }
    >
      <div
        className={
          horizontal
            ? "size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-28"
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
          <div className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground">
            {t("market.noImage")}
          </div>
        )}
      </div>

      <div className={horizontal ? "flex min-w-0 flex-1 flex-col" : "flex flex-1 flex-col p-3"}>
        <div className="flex flex-wrap items-center gap-1.5">
          {listing.typeLabel && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {listing.typeLabel}
            </span>
          )}
          {listing.item_condition && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
              {t(`market.condition.${listing.item_condition}`)}
            </span>
          )}
        </div>

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {listing.title}
        </h3>

        <p className="mt-1 text-sm font-bold text-primary">{price}</p>

        <div className="mt-1 min-w-0">
          <Advertiser listing={listing} />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[11px] text-muted-foreground">
          {listing.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {listing.city}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {relativeTime(listing.published_at ?? listing.created_at, locale)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" aria-hidden />
            {listing.views_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
