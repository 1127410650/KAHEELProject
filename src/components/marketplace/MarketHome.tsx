/**
 * الصفحة الرئيسية لكَحيل بنمط «نون».
 *
 * الترتيب ثابت من أعلى لأسفل: بلاطات سريعة (٣) ← حقل البحث العريض ← شريط
 * «سوريا 🇸🇾 فخرنا» ← إعلانات بإيقاع متفاوت من `/admin/campaigns` ← إعلان ممول
 * ← شبكة التصنيفات المربعة ← صفوف التصنيفات الأفقية ← عروض حصرية في الختام.
 *
 * الاستقرار البصري: كل قسم أسفل الشاشة الأولى يُركّب عبر `LazyMount` بارتفاع
 * محجوز مسبقًا، وكل صورة لها أبعاد أو نسبة أبعاد ⇒ صفر هزّة تخطيط.
 * الهيدر ينكمش مع التمرير ويُدار في `MarketShell`، وارتفاعه محجوز هناك.
 */

import { HomeJeebLi } from "@/components/marketplace/home/HomeJeebLi";
import { MarketCategoryStrip } from "@/components/marketplace/home/MarketCategoryStrip";
import { CampaignMosaic } from "@/components/marketplace/home/noon/CampaignMosaic";
import { CategoryRail, useHomeRails } from "@/components/marketplace/home/noon/CategoryRail";
import { CategoryTileGrid } from "@/components/marketplace/home/noon/CategoryTileGrid";
import { LazyMount } from "@/components/marketplace/home/noon/NoonKit";
import { QuickTiles } from "@/components/marketplace/home/noon/QuickTiles";
import { SponsoredBanner } from "@/components/marketplace/home/noon/SponsoredBanner";
import { SyriaPrideBanner } from "@/components/marketplace/home/noon/SyriaPrideBanner";
import { KaheelStories } from "@/components/marketplace/home/KaheelStories";
import { PageBlocks } from "@/components/marketplace/composer/PageBlocks";
import { usePageBlocks } from "@/lib/mkt-page-composer";
import { useActivePageVariant } from "@/lib/mkt-page-variants";
import { ExclusiveOffersRail } from "@/components/marketplace/season/ExclusiveOffersRail";
import { useI18n } from "@/i18n";

/** صفوف التصنيفات: العنوان، وجهة «عرض الكل»، ومرشّح المحتوى. */
const RAILS = [
  {
    id: "home-rail-realestate",
    ar: "إعلانات العقار",
    en: "Real-estate listings",
    href: "/search?category=real-estate",
    filters: { categorySlug: "real-estate" },
  },
  {
    id: "home-rail-cars",
    ar: "السيارات",
    en: "Cars",
    href: "/search?category=cars",
    filters: { categorySlug: "cars" },
  },
  {
    id: "home-rail-restaurants",
    ar: "المطاعم",
    en: "Restaurants",
    href: "/search?category=restaurants",
    filters: { categorySlug: "restaurants" },
  },
  {
    id: "home-rail-essentials",
    ar: "المستلزمات المنزلية",
    en: "Home essentials",
    href: "/search?domain=product",
    filters: { type: "product" },
  },
] as const;

export function MarketHome() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  // كل الصفوف في استعلام واحد: لا صف يُركّب قبل معرفة محتواه ⇒ لا ظهور ثم اختفاء.
  const rails = useHomeRails(RAILS);
  /* التصميم النشط يُدار من /admin/appearance/variants ويسري على كل الزوار فورًا. */
  const variant = useActivePageVariant("home", "home.noon");
  const bigCards = variant === "home.big_cards";
  /* التأليف من /admin/composer له الأولوية؛ وإن لم تُؤلَّف الصفحة بعد يظهر
     ترتيبها المكتوب أدناه كما هو ⇒ لا شاشة فارغة أبدًا. */
  const composed = usePageBlocks("market.home");
  /* رأس الصفحة ثابت الترتيب: البانر ← الستوريات ← شريط التصنيفات ← لوحة
     الإعلانات ← «جيب لي». فنستبعد نُسخ هذه الكتل من التأليف كي لا تتكرّر. */
  const blocks = (composed.data ?? []).filter(
    (block) => block.block_type !== "pride_strip" && block.block_type !== "campaign_mosaic",
  );

  return (
    /* k-page-surface: سطح أبيض يصبح شفافًا وحده عندما تكون خلفية اليوم مفعّلة. */
    <div className="k-page-surface bg-background pb-5 text-foreground">
      <div className="mx-auto w-full max-w-[1240px] space-y-[var(--section-gap)] overflow-x-clip px-[var(--page-x)] pb-[var(--sp-4)] pt-[var(--sp-4)]">
        {/* بانر «سوريا فخرنا» ثم الستوريات ثم شريط التصنيفات الماشي ثم لوحة
            الإعلانات و«جيب لي»: يظهر هذا الرأس في كل التصميمات (مؤلَّفة أو لا)
            وارتفاع كل قطعة محجوز فلا هزّة تخطيط. */}
        <SyriaPrideBanner />

        <KaheelStories />

        <div className="-mx-[var(--page-x)]">
          <MarketCategoryStrip />
        </div>

        <CampaignMosaic />

        <HomeJeebLi />

        {blocks.length > 0 ? (
          <PageBlocks blocks={blocks} />
        ) : (
          <>

        <QuickTiles />


        {/* حقل البحث العريض يعيش في الهيدر (MarketShell) كي يبقى وحده بعد الانكماش. */}

        {/* تصميم «البطاقات الكبيرة» يقدّم شبكة التصنيفات قبل الحملات. */}
        {bigCards ? (
          <>
            <LazyMount minHeight="380px">
              <CategoryTileGrid />
            </LazyMount>
            <LazyMount minHeight="150px">
              <SponsoredBanner />
            </LazyMount>
          </>
        ) : (
          <>
            <LazyMount minHeight="150px">
              <SponsoredBanner />
            </LazyMount>
            <LazyMount minHeight="380px">
              <CategoryTileGrid />
            </LazyMount>
          </>
        )}

        {/* ذيل الصفحة يُضاف مرة واحدة بعد جهوز الصفوف: إضافة أسفل المحتوى
            القائم لا تحرّك شيئًا ⇒ لا هزّة تخطيط. */}
        {!rails.isPending && (
          <>
            {RAILS.map((rail) => (
              <CategoryRail
                key={rail.id}
                id={rail.id}
                title={ar ? rail.ar : rail.en}
                href={rail.href}
                rows={rails.data?.[rail.id] ?? []}
                layout={bigCards ? "grid" : "rail"}
              />
            ))}

            <ExclusiveOffersRail />
          </>
        )}
          </>
        )}

      </div>
    </div>
  );
}

