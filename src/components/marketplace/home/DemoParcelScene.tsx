/**
 * مشهد الشخصية في بطاقة «البيئة التجريبية».
 *
 * لا أشكال قديمة ولا وجوه مجرّدة ولا Lottie: الظهور الوحيد هنا هو الشخصية
 * المعتمدة **الزعيم كَحيلان** عبر `<Mascot />`، بوضعية السقوط/الارتباك التي
 * تطابق النص «شوف شو صار فيني! كل هالطريق مشان أوصّلك هالعرض».
 *
 * الضوابط:
 *  - مربّع بحجم محجوز مسبقًا ⇒ صفر هزّة تخطيط قبل/بعد تحميل الصورة،
 *  - `loading="lazy"` داخل `Mascot` + حركة `transform` فقط،
 *  - كل الحركات تتوقف تحت `prefers-reduced-motion`.
 */
import { useEffect, useState } from "react";

import { Mascot, type KaheelanPose } from "@/components/marketplace/campaign/Mascot";

export interface DemoSceneCopy {
  titleAr: string;
  subtitleAr: string;
  titleEn: string;
  subtitleEn: string;
  /** وضعية كَحيلان المناسبة للنص: السقوط للوقعة، التلويح للتنبيه. */
  scene: KaheelanPose;
}

const COPY: DemoSceneCopy[] = [
  {
    titleAr: "أوف… وصلتك بخير! 📦",
    subtitleAr: "امسك العرض يا كابتن، في ناس رح تسرقه منك 😄",
    titleEn: "Phew… delivered in one piece! 📦",
    subtitleEn: "Grab the offer, captain — someone else is eyeing it 😄",
    scene: "squash",
  },
  {
    titleAr: "شوف شو صار فيني! 😅",
    subtitleAr: "كل هالطريق مشان أوصّلك هالعرض",
    titleEn: "Look what happened to me! 😅",
    subtitleEn: "All this way just to bring you this offer",
    scene: "fall",
  },
  {
    titleAr: "لك أنا وقعت وإنت واقف؟ 🙃",
    subtitleAr: "تعا امسك العرض قبل ما يفوت",
    titleEn: "I took the fall and you're just standing there? 🙃",
    subtitleEn: "Come grab the offer before it's gone",
    scene: "lying",
  },
  {
    titleAr: "انتبه! طرد جاي 📦",
    subtitleAr: "وفيه عرض ما بيتفوّت",
    titleEn: "Heads up! Parcel incoming 📦",
    subtitleEn: "And there's an offer inside you can't miss",
    scene: "wave",
  },
];

/** Picked on the client only, so SSR and hydration render the same first frame. */
export function useDemoSceneCopy(): DemoSceneCopy {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(Math.floor(Math.random() * COPY.length));
  }, []);
  return COPY[index] ?? COPY[0]!;
}

export function DemoParcelScene({ scene }: { scene: DemoSceneCopy["scene"] }) {
  return (
    <span
      // مربّع ثابت: المساحة محجوزة قبل تحميل الصورة وبعدها.
      className="relative grid size-16 shrink-0 place-items-end justify-items-center overflow-hidden rounded-[var(--r-card)] border border-white/15 bg-white/10 motion-safe:animate-[kaheel-demo-float_4.5s_ease-in-out_infinite] sm:size-20"
    >
      <span
        className="absolute inset-0 rounded-[var(--r-card)] bg-[radial-gradient(circle_at_50%_35%,color-mix(in_srgb,color-mix(in_srgb,var(--kt-primary)_45%,#ffffff)_35%,transparent),transparent_70%)]"
        aria-hidden
      />
      <Mascot
        name="kaheelan"
        pose={scene}
        size="sm"
        className="relative h-[90%] w-auto max-w-full drop-shadow-[0_6px_10px_rgb(0_0_0/0.35)]"
      />
    </span>
  );
}
