import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Clock,
  Flag,
  Heart,
  ImageIcon,
  MapPin,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { trackMarketActivity } from "@/lib/mkt-activity";
import { currentPath, loginHref, priceLabel, relativeTime, type MktListing } from "@/lib/mkt";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { canonicalUrl } from "@/lib/share-links";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  subcategoryLabel?: string | undefined;
}

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

export function FavoriteButton({ listing }: { listing: ListingCardData }) {
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
      className="grid size-8 place-items-center rounded-full border border-border/60 bg-background/88 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-primary"
    >
      <Heart className={saved ? "size-4 fill-primary text-primary" : "size-4"} aria-hidden />
    </button>
  );
}

function CardMenu({
  listing,
  onInteract,
}: {
  listing: ListingCardData;
  onInteract: (active: boolean) => void;
}) {
  const { t } = useI18n();
  const [shareOpen, setShareOpen] = useState(false);
  const slug = listing.slug ?? listing.id;

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          onInteract(true);
          if (!open) window.setTimeout(() => onInteract(false), 350);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("market.card.options")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="grid size-8 place-items-center rounded-full border border-border/60 bg-background/88 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-primary"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
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

      <ShareSheet
        title={listing.title}
        url={canonicalUrl(`/ads/${slug}`)}
        listingId={listing.id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}

function Media({ listing, horizontal }: { listing: ListingCardData; horizontal: boolean }) {
  const { t } = useI18n();
  const fallbackLabel =
    listing.subcategoryLabel ?? listing.categoryLabel ?? listing.typeLabel ?? t("market.noImage");

  return (
    <div
      className={
        horizontal
          ? "relative size-[84px] shrink-0 overflow-hidden rounded-xl bg-muted sm:size-28"
          : "relative aspect-[5/4] w-full overflow-hidden bg-muted"
      }
    >
      {listing.imageUrl ? (
        <img
          src={listing.imageUrl}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
      ) : (
        <div className="relative flex size-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-market-navy/[0.04] via-secondary/70 to-primary/10 px-3 text-center">
          <div
            className="absolute -end-8 -top-8 size-24 rounded-full bg-primary/10 blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-8 -start-8 size-24 rounded-full bg-market-navy/10 blur-2xl"
            aria-hidden
          />
          <span className="relative grid size-10 place-items-center rounded-2xl border border-border/70 bg-background/75 text-primary shadow-sm backdrop-blur">
            <ImageIcon className="size-5" aria-hidden />
          </span>
          <p className="relative mt-2 line-clamp-1 max-w-full text-[10px] font-bold text-foreground/70">
            {fallbackLabel}
          </p>
        </div>
      )}
    </div>
  );
}

export function ListingCard({
  listing,
  view = "grid",
  origin,
}: {
  listing: ListingCardData;
  view?: "grid" | "list" | "row";
  origin?: "search";
}) {
  const { locale } = useI18n();
  const price = priceLabel(listing, "—", locale === "ar" ? "ar" : "en");
  const horizontal = view === "list" || view === "row";
  const tag = listing.subcategoryLabel ?? listing.categoryLabel ?? listing.typeLabel;
  const navBlocked = useRef(false);

  const meta = (
    <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1.5 text-[10px] text-muted-foreground sm:text-[11px]">
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
    <div className="relative">
      <Link
        to="/ads/$slug"
        params={{ slug: listing.slug ?? listing.id }}
        onClick={(e) => {
          if (navBlocked.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (origin === "search") {
            track({ event_type: "search_click", path: "/search", listing_id: listing.id });
          }
        }}
        className={
          horizontal
            ? "group relative flex gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-raised"
            : "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-raised"
        }
      >
        <Media listing={listing} horizontal={horizontal} />

        <div
          className={
            horizontal ? "flex min-w-0 flex-1 flex-col pe-9" : "flex flex-1 flex-col p-2.5 sm:p-3"
          }
        >
          {tag && (
            <span className="w-fit max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[9px] font-medium text-secondary-foreground sm:text-[10px]">
              {tag}
            </span>
          )}

          <h3 className="mt-1.5 line-clamp-2 text-[13px] font-bold leading-snug text-foreground sm:text-sm">
            {listing.title}
          </h3>

          <p className="mt-1 text-[13px] font-black text-primary sm:text-sm">{price}</p>
          {meta}
        </div>
      </Link>

      <div
        className={
          horizontal
            ? "absolute top-2 z-10 flex flex-col gap-1 end-2"
            : "absolute top-2 z-10 flex gap-1 end-2"
        }
      >
        <FavoriteButton listing={listing} />
        <CardMenu
          listing={listing}
          onInteract={(active) => {
            navBlocked.current = active;
          }}
        />
      </div>
    </div>
  );
}
