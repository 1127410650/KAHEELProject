/**
 * شاشة دخول قسم «كَحيل عقار»: ترحيب + هيرو بصورة معلم سوري، تبويبات المسار،
 * بطاقات أنواع العقار، دوائر المدن، ثم صف «مميزة» وصف «الأحدث».
 * واجهة فقط: كل القراءة عبر `src/lib/mkt-aqar.ts` من جداول mkt_realestate_*.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";

import { AqarCityCircles } from "@/components/marketplace/aqar/AqarCityCircles";
import { AqarMoodCards } from "@/components/marketplace/aqar/AqarMoodCards";
import { AqarPriceRanges } from "@/components/marketplace/aqar/AqarPriceRanges";

import { AqarListingRail } from "@/components/marketplace/aqar/AqarListingRail";
import { AqarPickedRail } from "@/components/marketplace/aqar/AqarPickedRail";
import { AqarReviewPrompt } from "@/components/marketplace/aqar/AqarReviewPrompt";
import { AqarUpcomingSheet } from "@/components/marketplace/aqar/AqarUpcomingSheet";
import {
  fetchNextUpcomingAqarBooking,
  fetchRatableAqarBooking,
} from "@/lib/mkt-aqar-booking";
import { fetchMyReviewedBookingIds } from "@/lib/mkt-aqar-reviews";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { AqarTrackTabs } from "@/components/marketplace/aqar/AqarTrackTabs";
import { AqarTypeGrid } from "@/components/marketplace/aqar/AqarTypeGrid";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { useSession } from "@/lib/session";
import { useLabels } from "@/lib/mkt-ui-labels";
import { useActivePageVariant } from "@/lib/mkt-page-variants";
import {
  PageBlocks,
  type BlockOverrides,
} from "@/components/marketplace/composer/PageBlocks";
import { str, usePageBlocks } from "@/lib/mkt-page-composer";
import { applyMediaSlotsToAqar, DEFAULT_AQAR_IMAGERY, loadAqarImagery } from "@/lib/aqar-imagery";
import { useMediaSlots } from "@/lib/mkt-media-slots";
import {
  fetchAqarListings,
  fetchAqarPromoted,
  fetchAqarTypeCounts,
  fetchAqarUsdRate,
  type AqarListing,
  type AqarTrack,
} from "@/lib/mkt-aqar";

export const Route = createFileRoute("/aqar/")({
  head: () => ({
    meta: [
      { title: "كَحيل عقار — إيجار يومي وطويل وبيع في سوريا" },
      {
        name: "description",
        content:
          "استعرض شقق وفلل وأراضٍ ومحلات للإيجار اليومي والطويل والبيع في دمشق وحلب وحمص وحماة واللاذقية وطرطوس على كَحيل عقار.",
      },
      { property: "og:title", content: "كَحيل عقار — إيجار وبيع العقارات في سوريا" },
      {
        property: "og:description",
        content: "إيجار يومي وطويل وبيع: شقق، فلل، عمائر، أراضٍ، محلات، مزارع وشاليهات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AqarHomePage,
});

function AqarHomePage() {
  const [track, setTrack] = useState<AqarTrack>("daily_rent");
  const { ids, toggle } = useAqarFavorites();
  const label = useLabels();
  const variant = useActivePageVariant("aqar", "aqar.types_first");

  const imagery = useQuery({
    queryKey: ["aqar", "imagery"],
    queryFn: loadAqarImagery,
    initialData: DEFAULT_AQAR_IMAGERY,
    staleTime: 5 * 60 * 1000,
  });
  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });
  const counts = useQuery({
    queryKey: ["aqar", "type-counts", track],
    queryFn: () => fetchAqarTypeCounts(track),
  });
  const promoted = useQuery({
    queryKey: ["aqar", "promoted", track],
    queryFn: () => fetchAqarPromoted(track, 12),
  });
  const latest = useQuery({
    queryKey: ["aqar", "latest", track],
    queryFn: () => fetchAqarListings({ track, limit: 16 }),
  });

  /* لوحات المدخل الشخصية: حجز قادم + إقامة منتهية بلا تقييم. غير المسجَّل يحصل
     على null فورًا فلا تظهر أي لوحة ولا يُستهلك طلب. */
  const upcoming = useQuery({
    queryKey: ["aqar", "next-upcoming-booking"],
    queryFn: fetchNextUpcomingAqarBooking,
    staleTime: 60 * 1000,
  });
  const reviewed = useQuery({
    queryKey: ["aqar", "reviewed-bookings"],
    queryFn: fetchMyReviewedBookingIds,
    staleTime: 60 * 1000,
  });
  const ratable = useQuery({
    queryKey: ["aqar", "ratable-booking", reviewed.data ?? []],
    queryFn: () => fetchRatableAqarBooking(reviewed.data ?? []),
    enabled: reviewed.isSuccess,
    staleTime: 60 * 1000,
  });


  /* صور الفتحات المرفوعة من لوحة الإدارة تتقدّم على الافتراضي، والفارغة لا تغيّر شيئًا. */
  const slots = useMediaSlots();
  const visuals = applyMediaSlotsToAqar(imagery.data, slots.data);

  const hero = visuals.hero;
  const rate = usdRate.data ?? null;

  /* ترحيب شخصي بأسلوب التطبيقات الناضجة: الاسم الأول فقط، وبديل محايد للزائر. */
  const { profile } = useSession();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "";

  /* «اختيارات مخصصة لك»: مزيج المميزة ثم الأحدث بلا تكرار — عرض فقط. */
  const picked = (() => {
    const seen = new Set<string>();
    const out: AqarListing[] = [];
    for (const listing of [...(promoted.data ?? []), ...(latest.data ?? [])]) {
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);
      out.push(listing);
      if (out.length >= 8) break;
    }
    return out;
  })();

  /* التأليف من /admin/composer له الأولوية؛ الكتل الخاصة بالعقار تُركَّب هنا
     بنفس بياناتها فلا يُنسخ خط بيانات في مكانين. */
  const composed = usePageBlocks("aqar.home");
  const blocks = composed.data ?? [];
  const overrides: BlockOverrides = {
    hero_image: () => (
      <section className="-mt-3 px-4">
        <div
          data-kslot="aqar.hero"
          className="relative aspect-[16/7] overflow-hidden rounded-[var(--r-card)] shadow-md"
        >
          <img
            src={hero.image}
            alt={`${hero.name} — ${hero.city}`}
            width={1600}
            height={700}
            className="absolute inset-0 size-full object-cover"
            decoding="async"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <strong className="block text-lg font-bold text-white drop-shadow-md">
              {firstName ? `حيا الله ${firstName}` : "أهلًا بك"}
            </strong>
            <span className="block text-desc font-semibold text-white/90">
              إيجار يومي وطويل وبيع — {hero.city}
            </span>
          </div>
        </div>
      </section>
    ),
    search_field: () => (
      <div className="px-4">
        <Link
          to="/aqar/browse"
          search={{ track }}
          className="flex h-11 items-center gap-2 rounded-[var(--r-control)] border border-border bg-card px-3 shadow-sm"
        >
          <Search className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-desc font-semibold text-muted-foreground">
            إلى أين؟ مدينة، حي، أو نوع عقار
          </span>
        </Link>
        <div className="mt-3">
          <AqarTrackTabs track={track} onChange={setTrack} />
        </div>
      </div>
    ),

    type_cards: () => (
      <AqarTypeGrid types={visuals.types} track={track} counts={counts.data ?? {}} />
    ),
    city_circles: () => <AqarCityCircles cities={visuals.cities} track={track} />,
    listing_rail: (block) => (
      <AqarListingRail
        title={str(block.settings, "title_ar", "إعلانات")}
        listings={
          str(block.settings, "source", "newest") === "featured"
            ? (promoted.data ?? [])
            : (latest.data ?? [])
        }
        usdRate={rate}
        favorites={ids}
        onToggleFavorite={toggle}
        moreTrack={track}
      />
    ),
  };

  return (
    <AqarShell subtitle="إيجار يومي وطويل وبيع في سوريا">
      <div className="mx-auto w-full max-w-3xl">
        {/* مدخل القسم: لوحة الحجز القادم ثم تلميح التقييم — لأصحاب الحجوزات فقط. */}
        {upcoming.data ? <AqarUpcomingSheet row={upcoming.data} /> : null}
        {ratable.data ? <AqarReviewPrompt row={ratable.data} /> : null}
        {blocks.length > 0 ? (
          <PageBlocks blocks={blocks} overrides={overrides} className="pb-4" />

        ) : (
          <>

        {/* الهيرو: بطاقة صورة فوتوغرافية 16:7 تطفو فوق حدّ الهيدر (لا إزاحة تخطيط). */}
        <section className="-mt-3 px-4">
          <div
            data-kslot="aqar.hero"
            className="relative aspect-[16/7] overflow-hidden rounded-[var(--r-card)] shadow-md"
          >
            <img
              src={hero.image}
              alt={`${hero.name} — ${hero.city}`}
              width={1600}
              height={700}
              className="absolute inset-0 size-full object-cover"
              decoding="async"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <strong className="block text-lg font-bold text-white drop-shadow-md">
                {firstName ? `حيا الله ${firstName}` : "أهلًا بك"}
              </strong>
              <span className="block text-desc font-semibold text-white/90">
                إيجار يومي وطويل وبيع — {hero.city}
              </span>
            </div>
          </div>
        </section>

        {/* حقل البحث: ارتفاع 44px واستدارة 12px ثم تبويبات المسار المضغوطة. */}
        <div className="mt-4 px-4">
          <Link
            to="/aqar/browse"
            search={{ track }}
            className="flex h-11 items-center gap-2 rounded-[var(--r-control)] border border-border bg-card px-3 shadow-sm"
          >
            <Search className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate text-desc font-semibold text-muted-foreground">
              إلى أين؟ مدينة، حي، أو نوع عقار
            </span>
          </Link>
        </div>

        <div className="mt-3">
          <AqarTrackTabs track={track} onChange={setTrack} />
        </div>

        {/* ترتيب «الأنواع أولًا» أو «المدن أولًا» يُبدّله المدير من لوحة التصاميم. */}
        {variant === "aqar.cities_first" ? (
          <>
            <AqarCityCircles cities={visuals.cities} track={track} />
            <AqarTypeGrid types={visuals.types} track={track} counts={counts.data ?? {}} />
          </>
        ) : (
          <>
            <AqarTypeGrid types={visuals.types} track={track} counts={counts.data ?? {}} />
            {/* كثافة على غرار التطبيقات الناضجة: صف بطاقات كامل التشريح مباشرة بعد الأنواع. */}
            <AqarPickedRail
              title="اختيارات مخصصة لك"
              listings={picked}
              usdRate={rate}
              favorites={ids}
              onToggleFavorite={toggle}
              moreTrack={track}
            />
            <AqarCityCircles cities={visuals.cities} track={track} />
            <AqarMoodCards track={track} />
            <AqarPriceRanges track={track} />
          </>
        )}

        <AqarListingRail
          title="وحدات مميزة"
          listings={promoted.data ?? []}
          usdRate={rate}
          favorites={ids}
          onToggleFavorite={toggle}
          moreTrack={track}
          emptyText="لا توجد إعلانات مميزة حاليًا في هذا المسار."
        />
        <AqarListingRail
          title="الأحدث"
          listings={latest.data ?? []}
          usdRate={rate}
          favorites={ids}
          onToggleFavorite={toggle}
          moreTrack={track}
        />


            <p className="px-4 py-4 text-desc text-muted-foreground">
              {label("aqar.price_note", "الأسعار كما أدخلها المزوّد")}، والمعادل بالدولار تقديري وفق سعر صرف معتمد من الإدارة.
            </p>
          </>
        )}
      </div>
    </AqarShell>
  );
}
