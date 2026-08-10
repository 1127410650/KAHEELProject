/**
 * Public offers strip on a store page.
 *
 * Only offers the public policy returns are shown, and `offerIsLive` hides
 * anything scheduled or expired so a visitor never sees a discount they
 * cannot use right now.
 */
import { Tag } from "lucide-react";

import { useI18n } from "@/i18n";
import { currencyLabel } from "@/lib/mkt";
import { offerIsLive, useStoreOffers } from "@/lib/mkt-store-offers";

export function StoreOffersStrip({
  storefrontId,
  currency,
}: {
  storefrontId: string;
  currency: string;
}) {
  const { locale } = useI18n();
  const offers = useStoreOffers(storefrontId);
  const live = (offers.data ?? []).filter((offer) => offerIsLive(offer));

  if (live.length === 0) return null;

  return (
    <section aria-label="عروض المتجر" className="space-y-2">
      <h2 className="text-section flex items-center gap-2 font-black">
        <Tag className="size-4 text-market-navy" aria-hidden />
        {locale === "ar" ? "عروض سارية" : "Live offers"}
      </h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {live.map((offer) => (
          <article
            key={offer.id}
            className="min-w-[15rem] shrink-0 rounded-2xl border border-market-navy/25 bg-market-navy/5 p-3"
          >
            <p className="text-desc font-black">{offer.title}</p>
            <p className="mt-1 text-desc font-bold text-market-navy">
              {offer.discount_type === "percent"
                ? locale === "ar"
                  ? `خصم ${offer.discount_value}%`
                  : `${offer.discount_value}% off`
                : `${offer.discount_value} ${currencyLabel(currency, locale)}`}
              {offer.applies_to_all
                ? locale === "ar"
                  ? " · على كل المتجر"
                  : " · store-wide"
                : locale === "ar"
                  ? " · على منتجات محددة"
                  : " · selected items"}
            </p>
            {offer.description ? (
              <p className="mt-1 line-clamp-2 text-desc text-muted-foreground">
                {offer.description}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
