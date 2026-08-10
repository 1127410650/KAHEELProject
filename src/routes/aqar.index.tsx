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

  return (
    <AqarShell subtitle="إيجار يومي وطويل وبيع في سوريا">
      <div className="mx-auto w-full max-w-3xl">
        {/* الهيرو: صورة معلم سوري بارتفاع ثابت + حقل بحث أبيض عائم فوق حدّها السفلي. */}
        <section className="relative px-4 pt-4">
          <div data-kslot="aqar.hero" className="relative overflow-hidden rounded-2xl border border-border">
            <img
              src={hero.image}
              alt={`${hero.name} — ${hero.city}`}
              width={1280}
              height={720}
              className="h-48 w-full object-cover sm:h-60"
              decoding="async"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-4 top-4">
              <strong className="block text-page font-extrabold text-white drop-shadow-md">
                أهلًا بك في كَحيل عقار
              </strong>
              <span className="block text-desc font-semibold text-white/90">
                {hero.name} — {hero.city}
              </span>
            </div>
          </div>
          {/* الحقل العائم: بطاقة بيضاء نصفها خارج الصورة، كما في مرجع التصميم. */}
          <div className="absolute inset-x-7 -bottom-7">
            <Link
              to="/aqar/browse"
              search={{ track }}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-lg"
              style={{ minHeight: 60 }}
            >
              <Search className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <strong className="block truncate text-desc font-bold text-foreground">
                  إلى أين؟
                </strong>
                <span className="block truncate text-nav text-muted-foreground">
                  مدينة، حي، أو نوع عقار
                </span>
              </span>
            </Link>
          </div>
        </section>


        <div className="pt-12">
          <AqarTrackTabs track={track} onChange={setTrack} />
        </div>

        <AqarMoodCards track={track} />
        <AqarPriceRanges track={track} />


        {/* ترتيب «الأنواع أولًا» أو «المدن أولًا» يُبدّله المدير من لوحة التصاميم. */}
        {variant === "aqar.cities_first" ? (
          <>
            <AqarCityCircles cities={visuals.cities} track={track} />
            <AqarTypeGrid types={visuals.types} track={track} counts={counts.data ?? {}} />
          </>
        ) : (
          <>
            <AqarTypeGrid types={visuals.types} track={track} counts={counts.data ?? {}} />
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
      </div>
    </AqarShell>
  );
}
