import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";
import type { ChatContext } from "@/lib/mkt-chat";

/** Every thread opens with the ad it belongs to, so nobody negotiates blind. */
export function ChatListingCard({ context }: { context: ChatContext }) {
  const { t, locale } = useI18n();
  if (!context.listing_id) return null;

  return (
    <Link
      to="/ads/$slug"
      params={{ slug: context.listing_slug ?? context.listing_id }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent"
    >
      {context.listing_cover ? (
        <img
          src={context.listing_cover}
          alt=""
          loading="lazy"
          className="size-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="size-14 shrink-0 rounded-lg bg-muted" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {context.listing_title ?? "—"}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-desc text-muted-foreground">
          {context.listing_price !== null && (
            <span className="font-medium text-primary">{formatMoney(context.listing_price, locale)}</span>
          )}
          {context.listing_city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {context.listing_city}
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-desc text-primary">{t("market.chat.viewAd")}</span>
    </Link>
  );
}
