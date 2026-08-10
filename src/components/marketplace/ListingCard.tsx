import { useEffect, useRef, useState } from "react";
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
  Navigation,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";


import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { trackMarketActivity } from "@/lib/mkt-activity";
import { currentPath, loginHref, priceLabel, relativeTime, type MktListing } from "@/lib/mkt";
import { ShareSheet } from "@/components/marketplace/ShareSheet";
import { formatDistance } from "@/lib/mkt-nearby";
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
          ? "inline-flex items-center gap-0.5 text-desc font-semibold text-primary"
          : "inline-flex items-center gap-1 text-desc font-semibold text-primary"
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
  /** المسافة الفعلية بالأمتار من موقع المستخدم — تحسبها القاعدة عند ترتيب القرب. */
  distanceM?: number | null | undefined;
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
          <span className="relative grid size-10 place-items-center k-press rounded-[var(--r-card)] border border-border/70 bg-background/75 text-primary shadow-sm backdrop-blur">
            <ImageIcon className="size-5" aria-hidden />
          </span>
          <p className="relative mt-2 line-clamp-1 max-w-full text-desc font-bold text-foreground/70">
            {fallbackLabel}
          </p>
        </div>
      )}
    </div>
  );
}

/** إعلان مميز فعليًا: العلم مرفوع ولم تنتهِ مدة التمييز. */
function activeFeatured(listing: ListingCardData) {
  if (!listing.is_featured) return false;
  if (!listing.featured_until) return true;
  return new Date(listing.featured_until).getTime() > Date.now();
}

/**
 * شارة «مميز» بتدرّج ذهبي معدني ولمعة بطيئة جدًا. تراقب ظهورها بنفسها
 * فتتوقف اللمعة تمامًا خارج الشاشة، والحركة على transform/opacity فقط.
 */
export function FeaturedChip() {
  const { t } = useI18n();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "0px", threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={`k-gold-chip pointer-events-none inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-desc font-black leading-none sm:text-desc ${
        visible ? "is-in" : ""
      }`}
    >
      <Sparkles className="size-3 shrink-0" aria-hidden />
      <span>{t("market.realEstate.featuredBadge")}</span>
    </span>
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
  const featured = activeFeatured(listing);
  const distance = formatDistance(listing.distanceM, locale === "ar" ? "ar" : "en");


  const meta = (
    <div className="mt-auto flex h-[26px] min-w-0 items-center gap-x-[var(--sp-3)] overflow-hidden pt-[var(--sp-2)] text-desc text-muted-foreground sm:text-desc">

      {listing.city && (
        <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{listing.city}</span>
        </span>
      )}
      {distance && (
        <span className="num inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-[var(--sp-2)] py-[1px] font-bold text-primary">
          <Navigation className="size-[11px] shrink-0" aria-hidden />
          <bdi>{distance}</bdi>
        </span>
      )}
      {/* الوقت لا يتقلّص ولا يلتف: الالتفاف كان يكسر الكلمة العربية رأسيًا. */}
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
        <Clock className="size-3 shrink-0" aria-hidden />
        <bdi>{relativeTime(listing.published_at ?? listing.created_at, locale)}</bdi>
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
        className={[
          horizontal
            ? "group k-surface k-lift relative flex gap-3 p-[var(--sp-3)] outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            : "group k-surface k-lift relative flex flex-col overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
          featured ? "k-featured" : "",
        ].join(" ")}

      >
        <Media listing={listing} horizontal={horizontal} />

        <div
          className={
            horizontal ? "flex min-w-0 flex-1 flex-col pe-9" : "flex flex-1 flex-col p-[var(--sp-3)] sm:p-3"
          }
        >
          {/* The tag row always occupies its line, so a listing without a
              category never renders a shorter card than its neighbours. */}
          <span className="flex h-[18px] items-center">
            {tag ? (
              <span className="max-w-full truncate rounded-full bg-primary px-[var(--sp-3)] py-0.5 text-desc font-bold text-primary-foreground sm:text-desc">
                {tag}
              </span>
            ) : null}
          </span>

          {/* Two reserved lines: the height is identical for one- and
              two-line titles, which is what keeps the rails shift-free. */}
          <h3 className="mt-[var(--sp-2)] line-clamp-2 min-h-[2.6em] text-title font-semibold text-foreground sm:text-title">
            {listing.title}
          </h3>

          <p className="mt-1 flex h-[24px] items-center text-price font-bold text-primary sm:text-price">
            <bdi>{price}</bdi>
          </p>
          {meta}
        </div>
      </Link>

      {featured && (
        <div className="pointer-events-none absolute top-2 z-10 start-2">
          <FeaturedChip />
        </div>
      )}




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

/**
 * The loading placeholder for `ListingCard` in grid view. Its geometry mirrors
 * the real card box-for-box (5/4 media, one tag line, two title lines, price,
 * meta), so swapping data in never changes a rail's height.
 */
export function ListingCardSkeleton() {
  return (
    <div className="k-surface flex flex-col overflow-hidden" aria-hidden>
      <div className="k-skel aspect-[5/4] w-full rounded-none" />
      <div className="flex flex-1 flex-col p-[var(--sp-3)] sm:p-3">
        <span className="flex h-[18px] items-center">
          <span className="k-skel h-3.5 w-14 rounded-full" />
        </span>
        <div className="mt-[var(--sp-2)] min-h-[2.6em] space-y-1">
          <span className="k-skel block h-[0.95em] w-full rounded" />
          <span className="k-skel block h-[0.95em] w-3/5 rounded" />
        </div>
        <span className="mt-1 flex h-[20px] items-center">
          <span className="k-skel h-3.5 w-16 rounded" />
        </span>
        <span className="mt-auto flex h-[26px] items-center pt-[var(--sp-2)]">
          <span className="k-skel h-3 w-24 rounded" />
        </span>
      </div>
    </div>
  );
}

/**
 * The loading placeholder for `ListingCard` in row/list view. Same padding and
 * same 84px (112px from `sm`) media square as the real card, so the mobile
 * search results list holds its height from the first paint.
 */
export function ListingRowSkeleton() {
  return (
    <div className="k-surface flex gap-3 p-[var(--sp-3)]" aria-hidden>
      <div className="k-skel size-[84px] shrink-0 rounded-xl sm:size-28" />
      <div className="flex min-w-0 flex-1 flex-col pe-9">
        <span className="flex h-[18px] items-center">
          <span className="k-skel h-3.5 w-16 rounded-full" />
        </span>
        <div className="mt-[var(--sp-2)] min-h-[2.6em] space-y-1">
          <span className="k-skel block h-[0.95em] w-full rounded" />
          <span className="k-skel block h-[0.95em] w-2/3 rounded" />
        </div>
        <span className="mt-1 flex h-[20px] items-center">
          <span className="k-skel h-3.5 w-20 rounded" />
        </span>
        <span className="mt-auto flex h-[26px] items-center pt-[var(--sp-2)]">
          <span className="k-skel h-3 w-28 rounded" />
        </span>
      </div>
    </div>
  );
}
