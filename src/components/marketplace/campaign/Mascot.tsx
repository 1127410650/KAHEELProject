/**
 * شخصيتا المنصة المعتمدتان رسميًا — مصدر واحد لكل ظهور بصري في كل المنصة.
 *
 * • **كَحيل** — شاب عربي أنيق، لحية قصيرة مرتبة، ابتسامة ودودة، قميص أبيض
 *   وصدرية مطرّزة ذهبية/حمراء، سروال أسود فضفاض وجزمة، يمدّ يده مرحّبًا.
 *   الوجه الرسمي المؤدب: الترحيب والشكر والرسائل الرسمية.
 * • **الزعيم كَحيلان** — ابن خالته: رجل أكبر بشارب كثيف مفتول، طاقية سوداء،
 *   صدرية مطرّزة حمراء، كوفية على الكتفين، سروال أسود فضفاض، يرفع عصاية
 *   خشبية ويده الأخرى على خصره. الشخصية المشاكسة: العروض والمزاح والتشويق.
 *
 * الأسلوب ثلاثي الأبعاد (3D render) متطابق للاثنين لأنهما ابنا خالة.
 *
 * ## الوضعيات
 * لكل شخصية أصل واحد معتمد بخلفية شفافة. الوضعيات الإضافية تُنفّذ الآن
 * بتحويلات CSS فوق الأصل الأساسي (انضغاط، استطالة، ميل، استلقاء، تلويح…)،
 * وهذا مقصود: حين تصل صور الوضعيات المنفصلة من صاحب المنصة يكفي إضافة
 * `src` للوضعية في `POSES` ولا يتغيّر أي موضع نداء في المنصة.
 *
 * ## الضوابط
 * • WebP شفاف مضغوط، أبعاد صريحة (`width`/`height`) ⇒ صفر هزّة تخطيط.
 * • `loading="lazy"` إلا إذا طُلب `priority`.
 * • كل الحركات CSS ومعطّلة تحت `prefers-reduced-motion` عبر `motion-reduce`.
 */
import kaheelBase from "@/assets/characters/kaheel.webp";
import kaheelanBase from "@/assets/characters/kaheelan.webp";

export type MascotName = "kaheel" | "kaheelan";

/** وضعيات «كَحيل» الرسمية. */
export type KaheelPose = "welcome" | "present" | "thanks" | "idle";
/** وضعيات «الزعيم كَحيلان» المشاكسة. */
export type KaheelanPose =
  | "idle"
  | "fall"
  | "squash"
  | "stretch"
  | "mustache"
  | "tray"
  | "lying"
  | "wave";

export type MascotPose = KaheelPose | KaheelanPose;

/** الأصل الأساسي لكل شخصية، وأبعاده الحقيقية (لحساب النسبة بلا هزّة). */
const BASE: Record<MascotName, { src: string; width: number; height: number }> = {
  kaheel: { src: kaheelBase, width: 288, height: 900 },
  kaheelan: { src: kaheelanBase, width: 536, height: 900 },
};

interface PoseSpec {
  /** تحويل ثابت يبني الوضعية من الأصل الأساسي. */
  transform?: string;
  /** حركة دائمة لطيفة (تنفّس/تلويح/تقديم…). */
  motion?: string;
  /** نقطة الارتكاز — القدمان لحركات الانضغاط والاستطالة. */
  origin?: string;
  alt: { ar: string; en: string };
}

const KAHEEL_POSES: Record<KaheelPose, PoseSpec> = {
  welcome: {
    motion: "animate-[mascot-breathe_3.2s_ease-in-out_infinite]",
    alt: { ar: "كَحيل يمدّ يده مرحّبًا", en: "Kaheel extending a welcoming hand" },
  },
  present: {
    transform: "rotate(2deg)",
    motion: "animate-[mascot-present_2.8s_ease-in-out_infinite]",
    alt: { ar: "كَحيل يقدّم لك العرض بلطف", en: "Kaheel politely presenting an offer" },
  },
  thanks: {
    transform: "scale(0.98)",
    motion: "animate-[mascot-bow_3.4s_ease-in-out_infinite]",
    alt: { ar: "كَحيل يشكرك", en: "Kaheel saying thank you" },
  },
  idle: {
    motion: "animate-[mascot-breathe_4s_ease-in-out_infinite]",
    alt: { ar: "كَحيل واقف بهدوء", en: "Kaheel standing calmly" },
  },
};

const KAHEELAN_POSES: Record<KaheelanPose, PoseSpec> = {
  idle: {
    motion: "animate-[mascot-swagger_3s_ease-in-out_infinite]",
    alt: { ar: "الزعيم كَحيلان واقف بثقة", en: "Boss Kaheelan standing confidently" },
  },
  fall: {
    transform: "rotate(-14deg)",
    alt: { ar: "كَحيلان يهوي من الأعلى", en: "Kaheelan falling from above" },
  },
  squash: {
    transform: "scaleX(1.16) scaleY(0.78)",
    origin: "bottom center",
    alt: { ar: "كَحيلان ارتطم بالأرض", en: "Kaheelan hitting the ground" },
  },
  stretch: {
    transform: "scaleX(0.94) scaleY(1.08)",
    origin: "bottom center",
    alt: { ar: "كَحيلان يرتد للأعلى", en: "Kaheelan bouncing back up" },
  },
  mustache: {
    motion: "animate-[mascot-twirl_2.4s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يفتل شاربه", en: "Kaheelan twirling his mustache" },
  },
  tray: {
    transform: "rotate(-2deg)",
    motion: "animate-[mascot-lift_3s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يحمل صينية الضيافة", en: "Kaheelan carrying a serving tray" },
  },
  lying: {
    transform: "rotate(-76deg)",
    origin: "60% 70%",
    motion: "animate-[mascot-breathe_4.2s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان مستلقٍ مرتاح", en: "Kaheelan lying back, relaxed" },
  },
  wave: {
    motion: "animate-[mascot-sway_2.2s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يلوّح بعصايته", en: "Kaheelan waving his cane" },
  },
};

/** الوضعيات المتاحة لكل شخصية — تستخدمها لوحة الإدارة للمعاينة. */
export const MASCOT_POSES: { kaheel: KaheelPose[]; kaheelan: KaheelanPose[] } = {
  kaheel: Object.keys(KAHEEL_POSES) as KaheelPose[],
  kaheelan: Object.keys(KAHEELAN_POSES) as KaheelanPose[],
};

export const DEFAULT_POSE: Record<MascotName, MascotPose> = {
  kaheel: "welcome",
  kaheelan: "idle",
};

function specFor(name: MascotName, pose: MascotPose): PoseSpec {
  if (name === "kaheel") {
    return KAHEEL_POSES[(pose as KaheelPose) in KAHEEL_POSES ? (pose as KaheelPose) : "welcome"];
  }
  return KAHEELAN_POSES[(pose as KaheelanPose) in KAHEELAN_POSES ? (pose as KaheelanPose) : "idle"];
}

/**
 * الشخصية بوضعية محددة. الارتفاع يُحدَّد من الحاوية (`className`) والعرض يتبع
 * النسبة الأصلية، فلا تتشوّه الشخصية ولا يتغيّر التخطيط بعد تحميل الصورة.
 */
export function Mascot({
  name,
  pose,
  lang = "ar",
  className,
  animated = true,
  priority = false,
}: {
  name: MascotName;
  pose?: MascotPose;
  lang?: "ar" | "en";
  className?: string;
  animated?: boolean;
  priority?: boolean;
}) {
  const base = BASE[name];
  const spec = specFor(name, pose ?? DEFAULT_POSE[name]);

  return (
    <img
      src={base.src}
      alt={lang === "en" ? spec.alt.en : spec.alt.ar}
      width={base.width}
      height={base.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      style={{
        ...(spec.transform ? { transform: spec.transform } : {}),
        ...(spec.origin ? { transformOrigin: spec.origin } : {}),
      }}
      className={`select-none object-contain ${
        animated && spec.motion ? `${spec.motion} motion-reduce:animate-none` : ""
      } ${className ?? "h-full w-auto"}`}
    />
  );
}

/** مشهد الشخصيتين معًا — يُركّب من الأصلين نفسهما، فلا هوية بصرية ثانية. */
export function MascotDuo({
  lang = "ar",
  animated = true,
  className,
}: {
  lang?: "ar" | "en";
  animated?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-center gap-1 ${className ?? "h-full"}`}>
      <Mascot name="kaheel" pose="welcome" lang={lang} animated={animated} className="h-full w-auto" />
      <Mascot name="kaheelan" pose="wave" lang={lang} animated={animated} className="h-full w-auto" />
    </div>
  );
}
