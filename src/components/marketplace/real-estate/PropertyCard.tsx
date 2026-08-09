/**
 * بطاقة العقار — التصميم المعتمد لقسم العقار.
 *
 * • صورة كبيرة بمعرض داخلي (تقليب بالأسهم والنقاط وسحب الإصبع) بلا مغادرة الصفحة.
 * • شارات واضحة: بيع / إيجار / مطلوب، ومميز.
 * • شريط مواصفات سريع: الغرف · دورات المياه · المساحة.
 * • زر مفضلة عائم، سعر بارز، ثم الموقع والوقت.
 *
 * الأبعاد محفوظة (نسبة صورة ثابتة، وأسطر محجوزة للعنوان والمواصفات) فلا تهتز
 * الشبكة عند وصول البيانات.
 */
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bath, BedDouble, Building2, ChevronLeft, ChevronRight, MapPin, Ruler, Sparkles } from "lucide-react";

import { FavoriteButton, FeaturedChip, type ListingCardData } from "@/components/marketplace/ListingCard";
import { useI18n } from "@/i18n";
import { track } from "@/lib/analytics";
import { priceLabel, relativeTime } from "@/lib/mkt";
import { isWantedType } from "@/lib/mkt-taxonomy";
import { cn } from "@/lib/utils";

export function propertySpecs(listing: ListingCardData): {
  rooms?: number;
  baths?: number;
  area?: number;
} {
  const specs = (listing.specs && typeof listing.specs === "object" ? listing.specs : {}) as Record<
    string,
    unknown
  >;
  const num = (raw: unknown): number | undefined => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const out: { rooms?: number; baths?: number; area?: number } = {};
  const rooms = num(specs["rooms"]);
  const baths = num(specs["baths"]);
  const area = num(specs["area"]);
  if (rooms !== undefined) out.rooms = rooms;
  if (baths !== undefined) out.baths = baths;
  if (area !== undefined) out.area = area;
  return out;
}

function activePromotion(listing: ListingCardData): boolean {
  if (!listing.is_featured) return false;
  if (!listing.featured_until) return true;
  return new Date(listing.featured_until).getTime() > Date.now();
}

/** شريط المواصفات السريعة — يُستخدم في البطاقة وفي صفحة التفاصيل. */
export function PropertySpecsBar({
  listing,
  size = "sm",
}: {
  listing: ListingCardData;
  size?: "sm" | "lg";
}) {
  const { t } = useI18n();
  const { rooms, baths, area } = propertySpecs(listing);
  const items = [
    rooms !== undefined ? { icon: BedDouble, value: String(rooms), label: t("market.spec.rooms") } : null,
    baths !== undefined ? { icon: Bath, value: String(baths), label: t("market.spec.baths") } : null,
    area !== undefined
      ? { icon: Ruler, value: `${area} ${t("market.spec.sqm")}`, label: t("market.spec.area") }
      : null,
  ].filter((item): item is { icon: typeof Bath; value: string; label: string } => !!item);

  if (items.length === 0) return null;

  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground",
        size === "lg" ? "text-sm" : "text-[11px] sm:text-xs",
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.label} className="inline-flex items-center gap-1 font-semibold">
            <Icon className={size === "lg" ? "size-4 shrink-0" : "size-3.5 shrink-0"} aria-hidden />
            <span className="num" dir="ltr">
              {item.value}
            </span>
            <span className="sr-only">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function dealBadge(listing: ListingCardData, t: (key: string) => string): string | null {
  if (isWantedType(listing.type_code)) return t("market.realEstate.badgeWanted");
  if (listing.deal_kind === "sale") return t("market.filters.sale");
  if (listing.deal_kind === "rent") return t("market.filters.rent");
  return null;
}

export function PropertyCard({
  listing,
  images = [],
  priority = false,
  featured = false,
}: {
  listing: ListingCardData;
  /** صور المعرض المُحمّلة مجمّعة للشبكة؛ الغلاف يُستخدم دائمًا كأول صورة. */
  images?: string[];
  priority?: boolean;
  featured?: boolean;
}) {
  const { t, locale } = useI18n();
  const gallery = Array.from(
    new Set([listing.imageUrl, ...images].filter((url): url is string => !!url)),
  );
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const current = gallery[Math.min(index, Math.max(gallery.length - 1, 0))] ?? null;

  const price = priceLabel(listing, "—", locale === "ar" ? "ar" : "en");
  const deal = dealBadge(listing, t);
  const location = [listing.city, listing.district].filter(Boolean).join(" — ");
  const category = listing.subcategoryLabel ?? listing.categoryLabel ?? listing.typeLabel;

  const step = (delta: number) => {
    if (gallery.length < 2) return;
    setIndex((prev) => (prev + delta + gallery.length) % gallery.length);
  };

  return (
    <article className="group k-surface relative flex flex-col overflow-hidden rounded-3xl transition duration-200 hover:-translate-y-0.5 hover:shadow-raised">
      <div
        className="relative aspect-[4/3] w-full overflow-hidden bg-muted"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(delta) < 40) return;
          // في العربية اتجاه القراءة معكوس، والسحب يتبع الاتجاه البصري.
          step(locale === "ar" ? (delta > 0 ? 1 : -1) : delta > 0 ? -1 : 1);
        }}
      >
        <Link
          to="/ads/$slug"
          params={{ slug: listing.slug ?? listing.id }}
          onClick={() =>
            track({ event_type: "search_click", path: "/search", listing_id: listing.id })
          }
          className="block size-full outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          aria-label={listing.title}
        >
          {current ? (
            <img
              src={current}
              alt={listing.title}
              width={720}
              height={540}
              loading={priority && index === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority && index === 0 ? "high" : "auto"}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-secondary/70 to-primary/10 text-primary">
              <Building2 className="size-9" aria-hidden />
            </div>
          )}
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-foreground/55 to-transparent"
            aria-hidden
          />
        </Link>

        <div className="pointer-events-none absolute top-2.5 flex max-w-[70%] flex-wrap gap-1.5 start-2.5">
          {deal && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm">
              {deal}
            </span>
          )}
          {(featured || activePromotion(listing)) && <FeaturedChip />}

        </div>

        <div className="absolute top-2.5 z-10 end-2.5">
          <FavoriteButton listing={listing} />
        </div>

        {category && (
          <span className="pointer-events-none absolute bottom-2.5 max-w-[65%] truncate rounded-full bg-background/85 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm backdrop-blur start-2.5">
            {category}
          </span>
        )}

        {gallery.length > 1 && (
          <>
            <button
              type="button"
              aria-label={t("market.realEstate.prevImage")}
              onClick={() => step(-1)}
              className="absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/85 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 start-2"
            >
              <ChevronRight className="size-4 ltr:rotate-180" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("market.realEstate.nextImage")}
              onClick={() => step(1)}
              className="absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/85 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 end-2"
            >
              <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1">
              {gallery.map((url, dot) => (
                <span
                  key={url}
                  className={cn(
                    "h-1.5 rounded-full bg-background/70 transition-all",
                    dot === index ? "w-4 bg-background" : "w-1.5",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Link
        to="/ads/$slug"
        params={{ slug: listing.slug ?? listing.id }}
        className="flex flex-1 flex-col p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:p-4"
      >
        <p className="num text-base font-black text-primary sm:text-lg" dir="ltr">
          {price}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.6em] text-sm font-bold leading-[1.3] text-foreground sm:text-base">
          {listing.title}
        </h3>
        <div className="mt-2 flex min-h-[18px] items-center">
          <PropertySpecsBar listing={listing} />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground sm:text-xs">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{location || t("market.realEstate.locationFallback")}</span>
          </span>
          <span className="shrink-0">
            {relativeTime(listing.published_at ?? listing.created_at, locale)}
          </span>
        </div>
      </Link>
    </article>
  );
}

/** هيكل تحميل بنفس هندسة البطاقة، فلا تتغيّر أطوال الشبكة عند وصول البيانات. */
export function PropertyCardSkeleton() {
  return (
    <div className="k-surface overflow-hidden rounded-3xl" aria-hidden>
      <div className="k-skel aspect-[4/3] w-full rounded-none" />
      <div className="p-3 sm:p-4">
        <span className="k-skel block h-4 w-24 rounded" />
        <div className="mt-2 min-h-[2.6em] space-y-1">
          <span className="k-skel block h-[0.95em] w-full rounded" />
          <span className="k-skel block h-[0.95em] w-2/3 rounded" />
        </div>
        <span className="k-skel mt-3 block h-3 w-32 rounded" />
        <span className="k-skel mt-3 block h-3 w-full rounded" />
      </div>
    </div>
  );
}
