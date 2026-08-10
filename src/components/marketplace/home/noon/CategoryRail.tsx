/**
 * صفوف التصنيفات الأفقية بنمط «نون»: عنوان + «عرض الكل»، وبطاقات بعرض 80% من
 * الشاشة مع ظهور حافة البطاقة التالية.
 *
 * التركيب: عشرة عناصر لكل صف، ثلاثة منها ممولة (إعلانات ذات ترويج ساري) في
 * المواضع ١ و٤ و٨، والباقي الأحدث — ومع توفر موقع المستخدم تُرتَّب بالأقرب.
 * الصف الذي يقل محتواه عن أربعة عناصر لا يظهر إطلاقًا.
 *
 * صفر هزّة تخطيط: كل الصفوف تُجلب في استعلام واحد متوازٍ (`useHomeRails`) ولا
 * يُركّب أي صف قبل معرفة محتواه، فلا صف يظهر ثم يختفي ويحرّك ما تحته.
 */
import { useQuery } from "@tanstack/react-query";

import {
  ListingCard,
  type ListingCardData,
} from "@/components/marketplace/ListingCard";
import { RAIL_ITEM, RAIL_SCROLLER, SectionHead } from "@/components/marketplace/home/noon/NoonKit";
import { useI18n } from "@/i18n";
import { useNearbyOrigin } from "@/lib/mkt-nearby";
import { loadListings, type ListingFilters } from "@/lib/mkt-queries";

const ROW_SIZE = 10;
/** مواضع الإعلانات الممولة داخل الصف (١-based). */
const SPONSORED_SLOTS = [1, 4, 8];
/** الحد الأدنى لظهور الصف. */
const MIN_ROW = 4;

export interface HomeRailSpec {
  id: string;
  href: string;
  filters: ListingFilters;
}

/** يجلب كل الصفوف معًا ويعيد المحتوى الجاهز لكل صف بمعرّفه. */
export function useHomeRails(specs: readonly HomeRailSpec[]) {
  const { locale } = useI18n();
  const lang = locale === "ar" ? "ar" : "en";
  const { origin } = useNearbyOrigin();

  return useQuery({
    queryKey: [
      "mkt",
      "home-rails",
      specs.map((spec) => spec.id).join("|"),
      lang,
      origin ? `${origin.lat},${origin.lng}` : "no-origin",
    ],
    staleTime: 120_000,
    queryFn: async () => {
      const near = origin
        ? ({ sort: "nearest", originLat: origin.lat, originLng: origin.lng } as const)
        : ({ sort: "newest" } as const);

      const results = await Promise.all(
        specs.map(async (spec) => {
          const [sponsored, fresh] = await Promise.all([
            loadListings(
              { ...spec.filters, featuredOnly: true, sort: "newest", limit: SPONSORED_SLOTS.length },
              lang,
            ),
            loadListings({ ...spec.filters, ...near, limit: ROW_SIZE }, lang),
          ]);
          return [spec.id, mergeRow(sponsored, fresh)] as const;
        }),
      );
      return Object.fromEntries(results) as Record<string, ListingCardData[]>;
    },
  });
}

export function CategoryRail({
  id,
  title,
  href,
  rows,
}: {
  id: string;
  title: string;
  href: string;
  rows: ListingCardData[];
}) {
  if (rows.length < MIN_ROW) return null;
  return (
    <section aria-labelledby={id}>
      <SectionHead id={id} title={title} href={href} />
      <div className={RAIL_SCROLLER}>
        {rows.map((listing) => (
          <div key={listing.id} className={RAIL_ITEM}>
            <ListingCard listing={listing} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** يوزّع الممولة على المواضع ١ و٤ و٨ ويملأ ما بينها بالأحدث/الأقرب بلا تكرار. */
function mergeRow(sponsored: ListingCardData[], fresh: ListingCardData[]): ListingCardData[] {
  const promoted = sponsored.slice(0, SPONSORED_SLOTS.length);
  const promotedIds = new Set(promoted.map((row) => row.id));
  const rest = fresh.filter((row) => !promotedIds.has(row.id));

  const out: ListingCardData[] = [];
  let promoIndex = 0;
  let restIndex = 0;
  for (let slot = 1; slot <= ROW_SIZE; slot += 1) {
    if (SPONSORED_SLOTS.includes(slot) && promoIndex < promoted.length) {
      out.push(promoted[promoIndex]!);
      promoIndex += 1;
      continue;
    }
    if (restIndex < rest.length) {
      out.push(rest[restIndex]!);
      restIndex += 1;
    }
  }
  // ما تبقّى من الممولة (إن لم تُستهلك مواضعها) يُلحق في النهاية لا يُهمل.
  while (promoIndex < promoted.length) {
    out.push(promoted[promoIndex]!);
    promoIndex += 1;
  }
  return out.slice(0, ROW_SIZE);
}
