import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock, Flag, Heart, MapPin, MoreHorizontal, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { trackMarketActivity } from "@/lib/mkt-activity";
import { currentPath, loginHref, priceLabel, relativeTime, type MktListing } from "@/lib/mkt";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Trust check mark. It belongs to an *identity* (person or business) and is
 * therefore only rendered inside account/profile areas — never on a listing
 * card, its image, title or price.
 */
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
          ? "inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary"
          : "inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
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
  categoryLabel?: string | undefined;
}

/** Ids of the signed-in visitor's favourites — one shared query for all cards. */
function useFavoriteIds() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["mkt", "favorite-ids", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("mkt_favorites").select("listing_id");
      return new Set((data ?? []).map((r) => r.listing_id as string));
    },
  });
}

function FavoriteButton({ listing }: { listing: ListingCardData }) {
  const { t } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const favorites = useFavoriteIds();
  const saved = favorites.data?.has(listing.id) ?? false;

  const toggle = useMutation({
    mutationFn: async () => {
      if (saved) {
        await supabase.from("mkt_favorites").delete().eq("listing_id", listing.id);
        return false;
      }
      const { error } = await supabase.from("mkt_favorites").insert({ listing_id: listing.id });
      if (error) throw error;
      return true;
    },
    onSuccess: (added) => {
      void qc.invalidateQueries({ queryKey: ["mkt", "favorite-ids"] });
      if (added) {
        trackMarketActivity({
          event: "favorite",
          adId: listing.id,
          categoryId: listing.category_id,
          cityId: listing.city_id,
        });
      }
      toast.success(
        t(added ? "market.actions.savedToFavorites" : "market.actions.removedFromFavorites"),
      );
    },
    onError: () => toast.error(t("market.actions.failed")),
  });


  return (
    <button
      type="button"
      aria-label={t(saved ? "market.actions.saved" : "market.actions.save")}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!session) {
          void navigate({ href: loginHref(currentPath().split("?")[0] ?? "/", "save") });
          return;
        }
        toggle.mutate();
      }}
      className="grid size-8 place-items-center rounded-full border border-border/60 bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
    >
      <Heart className={saved ? "size-4 fill-primary text-primary" : "size-4"} aria-hidden />
    </button>
  );
}

function CardMenu({ listing }: { listing: ListingCardData }) {
  const { t } = useI18n();
  const slug = listing.slug ?? listing.id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("market.card.options")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="grid size-8 place-items-center rounded-full border border-border/60 bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(`${window.location.origin}/ads/${slug}`);
            toast.success(t("market.ad.linkCopied"));
          }}
        >
          <Share2 className="size-4" aria-hidden />
          {t("market.ad.share")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/ads/$slug" params={{ slug }} search={{ action: "report" }}>
            <Flag className="size-4" aria-hidden />
            {t("market.actions.report")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fixed-ratio media box: reserves space before the image loads (no layout shift). */
function Media({ listing, horizontal }: { listing: ListingCardData; horizontal: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={
        horizontal
          ? "relative size-[88px] shrink-0 overflow-hidden rounded-lg bg-muted sm:size-28"
          : "relative aspect-[4/3] w-full overflow-hidden bg-muted"
      }
    >
      {listing.imageUrl ? (
        <img
          src={listing.imageUrl}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground">
          {t("market.noImage")}
        </div>
      )}
    </div>
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
  const tag = listing.categoryLabel ?? listing.typeLabel;

  const meta = (
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[11px] text-muted-foreground">
      {listing.city && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{listing.city}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3" aria-hidden />
        {relativeTime(listing.published_at ?? listing.created_at, locale)}
      </span>
    </div>
  );

  return (
    <Link
      to="/ads/$slug"
      params={{ slug: listing.slug ?? listing.id }}
      className={
        horizontal
          ? "group relative flex gap-3 rounded-xl border border-border bg-card p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-colors hover:border-primary/40"
          : "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-colors hover:border-primary/40"
      }
    >
      <Media listing={listing} horizontal={horizontal} />

      <div
        className={
          horizontal ? "flex min-w-0 flex-1 flex-col pe-9" : "flex flex-1 flex-col p-3"
        }
      >
        {tag && (
          <span className="w-fit max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {tag}
          </span>
        )}

        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {listing.title}
        </h3>

        <p className="mt-1 text-sm font-bold text-primary">{price}</p>

        {meta}
      </div>

      <div
        className={
          horizontal
            ? "absolute top-2 flex flex-col gap-1 end-2"
            : "absolute top-2 flex gap-1 end-2"
        }
      >
        <FavoriteButton listing={listing} />
        <CardMenu listing={listing} />

      </div>
    </Link>
  );
}
