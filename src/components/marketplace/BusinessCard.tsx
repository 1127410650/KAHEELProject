import { Link } from "@tanstack/react-router";
import { MapPin, Store } from "lucide-react";

import { useI18n } from "@/i18n";
import type { MktBusiness } from "@/lib/mkt";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";

/**
 * Compact business card. The verification check mark lives inside the identity
 * block — directly under the name — and unverified businesses simply show their
 * name with no negative wording.
 */
export function BusinessCard({
  business,
  logoUrl,
}: {
  business: MktBusiness;
  logoUrl?: string | null | undefined;
}) {
  const { t, locale } = useI18n();
  const name =
    locale === "ar"
      ? business.display_name_ar
      : business.display_name_en || business.display_name_ar;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-3.5 shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-raised">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <Store className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <VerifiedBadge status={business.verification_status} size="xs" />
          {business.headline && (
            <p className="mt-0.5 line-clamp-1 text-desc text-muted-foreground">
              {business.headline}
            </p>
          )}
        </div>
      </div>

      {business.city && (
        <p className="mt-2 inline-flex items-center gap-1 text-desc text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          <span className="truncate">{business.city}</span>
        </p>
      )}

      <Link
        to="/businesses/$slug"
        params={{ slug: business.slug }}
        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-input bg-background text-desc font-bold text-foreground transition hover:border-primary/50 hover:bg-market-blue-soft hover:text-primary"
      >
        {t("market.business.visit")}
      </Link>
    </div>
  );
}
