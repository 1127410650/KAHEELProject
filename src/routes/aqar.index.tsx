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
import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { AqarTrackTabs } from "@/components/marketplace/aqar/AqarTrackTabs";
import { AqarTypeGrid } from "@/components/marketplace/aqar/AqarTypeGrid";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { useLabels } from "@/lib/mkt-ui-labels";
import { useActivePageVariant } from "@/lib/mkt-page-variants";
import { applyMediaSlotsToAqar, DEFAULT_AQAR_IMAGERY, loadAqarImagery } from "@/lib/aqar-imagery";
import { useMediaSlots } from "@/lib/mkt-media-slots";
import {
  fetchAqarListings,
  fetchAqarPromoted,
  fetchAqarTypeCounts,
  fetchAqarUsdRate,
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

  /* صور الفتحات المرفوعة من لوحة الإدارة تتقدّم على الافتراضي، والفارغة لا تغيّر شيئًا. */
  const slots = useMediaSlots();
  const visuals = applyMediaSlotsToAqar(imagery.data, slots.data);

  const hero = visuals.hero;
  const rate = usdRate.data ?? null;

  /* التأليف من /admin/composer له الأولوية؛ الكتل الخاصة بالعقار تُركَّب هنا
     بنفس بياناتها فلا يُنسخ خط بيانات في مكانين. */
  const composed = usePageBlocks("aqar.home");
  const blocks = composed.data ?? [];
  const overrides: BlockOverrides = {
    hero_image: () => (
      <section className="-mt-6 px-4">
        <div
          data-kslot="aqar.hero"
          className="relative aspect-[16/9] overflow-hidden rounded-3xl shadow-lg"
        >
          <img
            src={hero.image}
            alt={`${hero.name} — ${hero.city}`}
            width={1600}
            height={900}
            className="absolute inset-0 size-full object-cover"
            decoding="async"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <strong className="block text-page font-extrabold text-white drop-shadow-md">
              أهلًا بك في كَحيل عقار
            </strong>
            <span className="block text-desc font-semibold text-white/90">
              {hero.name} — {hero.city}
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
          className="flex h-12 items-center gap-2 rounded-full bg-card px-4 shadow-sm"
        >
          <Search className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-body font-semibold text-muted-foreground">
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
        {blocks.length > 0 ? (
          <PageBlocks blocks={blocks} overrides={overrides} className="pb-4" />
        ) : (
          <>

        {/* الهيرو: بطاقة صورة تطفو فوق الحدّ السفلي للهيدر بنسبة 16:9 ثابتة (لا إزاحة تخطيط). */}
        <section className="-mt-6 px-4">
          <div
            data-kslot="aqar.hero"
            className="relative aspect-[16/9] overflow-hidden rounded-3xl shadow-lg"
          >
            <img
              src={hero.image}
              alt={`${hero.name} — ${hero.city}`}
              width={1600}
              height={900}
              className="absolute inset-0 size-full object-cover"
              decoding="async"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <strong className="block text-page font-extrabold text-white drop-shadow-md">
                أهلًا بك في كَحيل عقار
              </strong>
              <span className="block text-desc font-semibold text-white/90">
                {hero.name} — {hero.city}
              </span>
            </div>
          </div>
        </section>

        {/* حقل البحث: كبسولة بيضاء بارتفاع 48px ثم تبويبات المسار بنفس الإيقاع. */}
        <div className="mt-4 px-4">
          <Link
            to="/aqar/browse"
            search={{ track }}
            className="flex h-12 items-center gap-2 rounded-full bg-card px-4 shadow-sm"
          >
            <Search className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="truncate text-body font-semibold text-muted-foreground">
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
            <AqarMoodCards track={track} />
            <AqarPriceRanges track={track} />
            <AqarCityCircles cities={visuals.cities} track={track} />
          </>
        )}


        <AqarListingRail
          title="مميزة"
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
