/**
 * «عروض حصرية» — مساحة مختارة يديرها مدير النظام.
 *
 * البطاقات تجلس فوق طبقة موسمية مخصّصة (موضع `exclusive`) فتُحسّ بارزة عن بقية
 * الصفحة، والنص فوق حجاب تدرّج يضمن التباين.
 *
 * صفر هزّة تخطيط: ارتفاع المساحة ثابت (`RAIL_HEIGHT`) ولا يتغيّر بعدد البطاقات،
 * والمساحة **محجوزة من أول رسم** أثناء الجلب، فوصول البيانات لا يدفع ما تحتها.
 * لا تُرسم المساحة إلا إذا كان هناك عرض نشط فعلًا، فلا فراغ بلا سبب.
 */
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { useI18n } from "@/i18n";
import { useExclusiveOffers } from "@/lib/mkt-seasons";
import { SeasonalLayer } from "@/components/marketplace/season/SeasonalLayer";

const RAIL_HEIGHT = "13.25rem";

export function ExclusiveOffersRail() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data, isPending } = useExclusiveOffers();
  const offers = data ?? [];

  // الحجز أثناء الجلب: نفس الارتفاع على الخادم وفي المتصفح، فلا اختلاف ترطيب.
  if (isPending) return <div aria-hidden style={{ height: RAIL_HEIGHT }} />;
  if (offers.length === 0) return null;


  return (
    <section
      aria-labelledby="exclusive-offers-title"
      style={{ height: RAIL_HEIGHT }}
      /* بطاقة موحّدة كبقية الأقسام؛ التنوّع اللوني يأتي من صور العروض نفسها. */
      className="k-surface relative isolate overflow-hidden p-4 text-[#240046]"
    >
      <SeasonalLayer placement="exclusive" showMascot={false} />

      <div className="relative z-10">
        <header className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-[radial-gradient(circle_at_32%_25%,#f3e3ff,#e0aaff_78%)] text-[#3c096c]">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="exclusive-offers-title" className="k-h2">
              {ar ? "عروض حصرية" : "Exclusive offers"}
            </h2>
            <p className="text-[11px] text-[#5a189a]">
              {ar ? "مختارة بعناية من كَحيل" : "Hand-picked by Kaheel"}
            </p>
          </div>
        </header>


        <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {offers.map((offer) => {
            const title = (ar ? offer.title_ar : offer.title_en) || offer.slug;
            const subtitle = ar ? offer.subtitle_ar : offer.subtitle_en;
            const badge = ar ? offer.badge_ar : offer.badge_en;
            const cta = (ar ? offer.cta_ar : offer.cta_en) || (ar ? "اكتشف" : "Discover");
            return (
              <Link
                key={offer.id}
                to={offer.click_url}
                className="k-press relative flex min-h-[7.5rem] w-[15.5rem] shrink-0 flex-col justify-end overflow-hidden rounded-2xl border border-[#c77dff]/30 bg-[#3c096c] p-3 text-start text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7b2cbf]"
              >
                {offer.imageUrl ? (
                  <img
                    src={offer.imageUrl}
                    alt=""
                    width={640}
                    height={360}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover opacity-70"
                  />
                ) : null}
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(36_0_70/0.25),rgb(36_0_70/0.82))]" />
                <span className="relative z-10 space-y-1">
                  {badge ? (
                    <span className="inline-block rounded-full bg-market-gold/90 px-2 py-0.5 text-[10px] font-black text-[#240046]">
                      {badge}
                    </span>
                  ) : null}
                  <span className="block truncate text-sm font-black">{title}</span>
                  {subtitle ? (
                    <span className="block line-clamp-2 text-[11px] text-white/80">{subtitle}</span>
                  ) : null}
                  <span className="block pt-0.5 text-[11px] font-bold text-market-gold">{cta} ›</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
