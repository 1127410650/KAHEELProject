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
import { AqarListingRail } from "@/components/marketplace/aqar/AqarListingRail";
import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { AqarTrackTabs } from "@/components/marketplace/aqar/AqarTrackTabs";
import { AqarTypeGrid } from "@/components/marketplace/aqar/AqarTypeGrid";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { DEFAULT_AQAR_IMAGERY, loadAqarImagery } from "@/lib/aqar-imagery";
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

  const hero = imagery.data.hero;
  const rate = usdRate.data ?? null;

  return (
    <AqarShell subtitle="إيجار يومي وطويل وبيع في سوريا">
      <div className="mx-auto w-full max-w-3xl">
        {/* الهيرو: صورة معلم سوري بارتفاع ثابت، فلا إزاحة تخطيط عند التحميل. */}
        <section className="px-4 pt-4">
          <div className="relative overflow-hidden rounded-2xl border border-border">
            <img
              src={hero.image}
              alt={`${hero.name} — ${hero.city}`}
              width={1280}
              height={720}
              className="h-44 w-full object-cover sm:h-56"
              decoding="async"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <strong className="block text-page font-extrabold text-white drop-shadow-md">
                أهلًا بك في كَحيل عقار
              </strong>
              <span className="block text-desc font-semibold text-white/90">
                {hero.name} — {hero.city}
              </span>
            </div>
          </div>
        </section>

        <section className="px-4 pt-3">
          <Link
            to="/aqar/browse"
            search={{ track }}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 text-body text-muted-foreground"
            style={{ minHeight: 48 }}
          >
            <Search className="size-5 text-primary" aria-hidden />
            ابحث عن مدينة، حي، أو نوع عقار
          </Link>
        </section>

        <div className="pt-3">
          <AqarTrackTabs track={track} onChange={setTrack} />
        </div>

        {/* ترتيب «الأنواع أولًا» أو «المدن أولًا» يُبدّله المدير من لوحة التصاميم. */}
        {variant === "aqar.cities_first" ? (
          <>
            <AqarCityCircles cities={imagery.data.cities} track={track} />
            <AqarTypeGrid types={imagery.data.types} track={track} counts={counts.data ?? {}} />
          </>
        ) : (
          <>
            <AqarTypeGrid types={imagery.data.types} track={track} counts={counts.data ?? {}} />
            <AqarCityCircles cities={imagery.data.cities} track={track} />
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
          الأسعار كما أدخلها المزوّد، والمعادل بالدولار تقديري وفق سعر صرف معتمد من الإدارة.
        </p>
      </div>
    </AqarShell>
  );
}
