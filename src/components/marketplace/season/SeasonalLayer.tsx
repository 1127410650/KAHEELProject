/**
 * الطبقة الموسمية المزخرفة.
 *
 * ثلاث طبقات فوق بعضها داخل حاوية `absolute inset-0` لا تدخل مجرى التخطيط:
 * ١) صورة الموسم بأبعاد صريحة و`object-cover` — صفر هزّة تخطيط.
 * ٢) طبقة العناصر المنثورة (اختيارية) تطفو ببطء شديد بـ `transform` فقط.
 * ٣) حجاب تدرّج يضمن بقاء النص الأبيض فوق الطبقة مقروءًا مهما كانت الصورة.
 *
 * الحركة تتوقف حين تخرج الطبقة من الشاشة (`IntersectionObserver` يضيف/يزيل صفًا
 * واحدًا)، ولا تعمل إطلاقًا مع `prefers-reduced-motion`. الحاوية
 * `pointer-events-none` و`aria-hidden`، فلا تعترض ضغطة ولا تُنطق.
 */
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n";
import { mascotAsset } from "@/lib/mascot-assets";
import { SyrianFlag } from "@/components/marketplace/season/SyrianFlag";
import { useSeason, type ResolvedSeason, type SeasonPlacement } from "@/lib/mkt-seasons";


const SCRIM: Record<ResolvedSeason["overlay"], string> = {
  soft: "bg-[linear-gradient(180deg,rgb(36_0_70/0.35)_0%,rgb(36_0_70/0.28)_55%,rgb(36_0_70/0.52)_100%)]",
  medium:
    "bg-[linear-gradient(180deg,rgb(36_0_70/0.55)_0%,rgb(36_0_70/0.46)_55%,rgb(36_0_70/0.66)_100%)]",
  strong:
    "bg-[linear-gradient(180deg,rgb(36_0_70/0.72)_0%,rgb(36_0_70/0.62)_55%,rgb(36_0_70/0.80)_100%)]",
};

/** نقاط النمط: مواضع ثابتة (لا عشوائية) فالشكل نفسه لكل الزوار. */
const MOTIF_DOTS = [
  { left: "6%", top: "22%", size: 7, delay: "0s" },
  { left: "17%", top: "68%", size: 5, delay: "0.9s" },
  { left: "29%", top: "14%", size: 9, delay: "1.8s" },
  { left: "41%", top: "74%", size: 6, delay: "2.6s" },
  { left: "55%", top: "26%", size: 8, delay: "0.4s" },
  { left: "67%", top: "66%", size: 5, delay: "1.3s" },
  { left: "78%", top: "18%", size: 7, delay: "2.1s" },
  { left: "90%", top: "58%", size: 6, delay: "3s" },
];

export interface SeasonalLayerProps {
  placement: SeasonPlacement;
  sectionKey?: string;
  /** إطلالة الشخصية من الحافة العلوية — تُطلب فقط حيث يوجد متّسع. */
  showMascot?: boolean;
  className?: string;
}

export function SeasonalLayer({
  placement,
  sectionKey,
  showMascot = true,
  className,
}: SeasonalLayerProps) {
  const season = useSeason(placement, sectionKey);
  const { locale } = useI18n();
  const ar = locale === "ar";

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "120px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [season?.id]);

  useEffect(() => setLoaded(false), [season?.id]);

  if (!season) return null;

  const run = visible ? "k-season-run" : "";
  const mascotSrc =
    season.mascot === "custom"
      ? season.mascotUrl
      : season.mascot === "none"
        ? null
        : mascotAsset(season.mascot === "kaheel" ? "kaheel" : "kaheelan", "sm").src;
  const mascotDims =
    season.mascot === "kaheel" || season.mascot === "kaheelan"
      ? mascotAsset(season.mascot, "sm")
      : null;
  const headline = (ar ? season.headline_ar : season.headline_en).trim();
  const subheadline = (ar ? season.subheadline_ar : season.subheadline_en).trim();


  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${run} ${className ?? ""}`}
    >
      {season.imageUrl ? (
        <img
          src={season.imageUrl}
          alt=""
          width={season.image_width}
          height={season.image_height}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}

      {season.decorUrl ? (
        <img
          src={season.decorUrl}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="k-season-float absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-screen"
        />
      ) : null}

      {season.motif === "none" ? null : (
        <div className="absolute inset-0">
          {MOTIF_DOTS.map((dot) => (
            <span
              key={`${dot.left}-${dot.top}`}
              className="k-season-twinkle absolute rounded-full"
              style={{
                left: dot.left,
                top: dot.top,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                background: season.accent,
                boxShadow: `0 0 ${dot.size * 2}px ${season.accent}`,
                animationDelay: dot.delay,
              }}
            />
          ))}
          <span className="k-season-shimmer absolute inset-y-0 w-1/3" />
        </div>
      )}

      <div className={`absolute inset-0 ${SCRIM[season.overlay]}`} />

      {/* شريط الهوية: علم يرفرف + نص بارز — أسفل الطبقة حيث لا يزاحم محتوى الهيدر. */}
      {season.motif === "flag" || headline ? (
        <div className="absolute inset-x-3 bottom-1.5 flex items-center gap-2 sm:bottom-2 sm:gap-3">
          {season.motif === "flag" ? (
            <SyrianFlag className="h-5 w-[30px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/45 sm:h-6 sm:w-9" />
          ) : null}
          {headline ? (
            <div className="min-w-0">
              <p className="truncate text-[12px] font-extrabold leading-tight text-white drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)] sm:text-sm">
                {headline}
              </p>
              {subheadline ? (
                <p className="truncate text-[9px] leading-tight text-white/85 drop-shadow-[0_1px_4px_rgb(0_0_0/0.6)] sm:text-[11px]">
                  {subheadline}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}


      {showMascot && mascotSrc ? (
        <img
          src={mascotSrc}
          alt=""
          width={mascotDims?.width}
          height={mascotDims?.height}
          loading="lazy"
          decoding="async"
          /* شخصية كاملة **واقفة على الخط السفلي للهيدر**: `bottom-0` مع ارتفاع
             أصغر من ارتفاع الطبقة ⇒ لا قطع عند الساق ولا عند الكاحل. وتُخفى تحت
             lg لأن الهيدر الضيق لا يترك فراغًا بلا تغطية الشعار أو الجرس. */
          className="k-season-peek absolute bottom-[41px] hidden h-[58px] max-h-none w-auto object-contain opacity-95 ltr:left-[27%] rtl:right-[27%] lg:block"
        />
      ) : null}
    </div>
  );
}
