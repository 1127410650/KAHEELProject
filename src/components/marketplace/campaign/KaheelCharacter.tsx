/**
 * شخصيتا المنصة كرسوم كرتونية حقيقية — مصدر واحد ثابت لكل النوافذ.
 *
 * • «كَحيل» (kaheel): شاب أنيق ببدلة بنفسجية، مؤدّب وودود — وجه المنصة الرسمي.
 * • «الزعيم كَحيلان» (kaheelan): رجل بشماغ وشارب معقوف وملامح مشاكسة مرحة.
 *
 * كل الوضعيات رسوم كرتونية بنفس المدرسة الفنية (خطوط سميكة، تظليل ناعم، لوحة
 * بنفسجية موحّدة) بصيغة WebP شفافة ≤ 300KB لكل أصل.
 *
 * الحركة كلها CSS ومعطّلة تحت prefers-reduced-motion، والأبعاد ثابتة فلا هزّة تخطيط.
 */
import kaheelWave from "@/assets/characters/kaheel-wave.webp";
import kaheelWelcome from "@/assets/characters/kaheel-welcome.webp";
import kaheelThanks from "@/assets/characters/kaheel-thanks.webp";
import kaheelanBoss from "@/assets/characters/kaheelan-boss.webp";
import kaheelanMustache from "@/assets/characters/kaheelan-mustache.webp";
import kaheelanScarf from "@/assets/characters/kaheelan-scarf.webp";
import kaheelanPoint from "@/assets/characters/kaheelan-point.webp";
import kaheelanTray from "@/assets/characters/kaheelan-tray.webp";
import kaheelanOlives from "@/assets/characters/kaheelan-olives.webp";
import kaheelanFall from "@/assets/characters/kaheelan-fall.webp";
import kaheelanMoto from "@/assets/characters/kaheelan-moto.webp";
import duoMeet from "@/assets/characters/duo-meet.webp";

export type KaheelPersona = "kaheel" | "kaheelan" | "duo";

/** وضعيات «كَحيل» الرسمية. */
export type KaheelPose = "wave" | "welcome" | "thanks";
/** وضعيات «الزعيم كَحيلان» المشاكسة. */
export type KaheelanPose =
  | "boss"
  | "mustache"
  | "scarf"
  | "point"
  | "tray"
  | "olives"
  | "fall"
  | "moto";
/** مشهد الشخصيتين معًا. */
export type DuoPose = "meet";

export type CharacterPose = KaheelPose | KaheelanPose | DuoPose;

type Entry = { src: string; wide?: boolean; motion?: string; alt: { ar: string; en: string } };

const KAHEEL: Record<KaheelPose, Entry> = {
  wave: {
    src: kaheelWave,
    motion: "animate-[kaheel-char-wave_2.4s_ease-in-out_infinite]",
    alt: { ar: "كَحيل يلوّح مرحّبًا", en: "Kaheel waving hello" },
  },
  welcome: {
    src: kaheelWelcome,
    motion: "animate-[kaheel-char-breathe_3s_ease-in-out_infinite]",
    alt: { ar: "كَحيل يفتح ذراعيه ترحيبًا", en: "Kaheel welcoming with open arms" },
  },
  thanks: {
    src: kaheelThanks,
    motion: "animate-[kaheel-char-breathe_3.2s_ease-in-out_infinite]",
    alt: { ar: "كَحيل يشكرك بيده على صدره", en: "Kaheel with a hand on his heart" },
  },
};

const KAHEELAN: Record<KaheelanPose, Entry> = {
  boss: {
    src: kaheelanBoss,
    motion: "animate-[kaheel-char-swagger_3s_ease-in-out_infinite]",
    alt: { ar: "الزعيم كَحيلان واقف بثقة", en: "Boss Kaheelan standing proudly" },
  },
  mustache: {
    src: kaheelanMustache,
    motion: "animate-[kaheel-char-swagger_2.6s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يفتل شاربه", en: "Kaheelan twirling his mustache" },
  },
  scarf: {
    src: kaheelanScarf,
    motion: "animate-[kaheel-char-swagger_2.8s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يلف شماغه حول رقبته", en: "Kaheelan wrapping his keffiyeh" },
  },
  point: {
    src: kaheelanPoint,
    motion: "animate-[kaheel-char-nudge_2.4s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يشير بإصبعه مازحًا", en: "Kaheelan pointing playfully" },
  },
  tray: {
    src: kaheelanTray,
    motion: "animate-[kaheel-char-tray_3.2s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يحمل صينية حلاوة الجبن", en: "Kaheelan carrying a sweets tray" },
  },
  olives: {
    src: kaheelanOlives,
    motion: "animate-[kaheel-char-tray_3s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يقدّم سلطانية زيتون", en: "Kaheelan offering a bowl of olives" },
  },
  fall: {
    src: kaheelanFall,
    motion: "animate-[kaheel-char-wobble_1.6s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان يسقط بمرح", en: "Kaheelan tumbling down" },
  },
  moto: {
    src: kaheelanMoto,
    wide: true,
    motion: "animate-[kaheel-char-ride_1.5s_ease-in-out_infinite]",
    alt: { ar: "كَحيلان على دبّاب التوصيل", en: "Kaheelan on a delivery scooter" },
  },
};

const DUO: Record<DuoPose, Entry> = {
  meet: {
    src: duoMeet,
    wide: true,
    motion: "animate-[kaheel-char-breathe_3.4s_ease-in-out_infinite]",
    alt: {
      ar: "كَحيل والزعيم كَحيلان يتصافحان",
      en: "Kaheel and Boss Kaheelan shaking hands",
    },
  },
};

export const CHARACTER_POSES: Record<KaheelPersona, CharacterPose[]> = {
  kaheel: Object.keys(KAHEEL) as KaheelPose[],
  kaheelan: Object.keys(KAHEELAN) as KaheelanPose[],
  duo: Object.keys(DUO) as DuoPose[],
};

function entryFor(persona: KaheelPersona, pose: CharacterPose): Entry {
  if (persona === "kaheel") return KAHEEL[(pose as KaheelPose) in KAHEEL ? (pose as KaheelPose) : "wave"];
  if (persona === "duo") return DUO.meet;
  return KAHEELAN[(pose as KaheelanPose) in KAHEELAN ? (pose as KaheelanPose) : "boss"];
}

export function KaheelCharacter({
  persona,
  pose,
  lang = "ar",
  className,
  animated = true,
  priority = false,
}: {
  persona: KaheelPersona;
  pose?: CharacterPose;
  lang?: "ar" | "en";
  className?: string;
  animated?: boolean;
  priority?: boolean;
}) {
  const entry = entryFor(persona, pose ?? (persona === "kaheel" ? "wave" : persona === "duo" ? "meet" : "boss"));
  const w = entry.wide ? 640 : 640;
  const h = entry.wide ? 480 : 640;

  return (
    <img
      src={entry.src}
      alt={lang === "en" ? entry.alt.en : entry.alt.ar}
      width={w}
      height={h}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`select-none object-contain ${
        animated ? `${entry.motion ?? ""} motion-reduce:animate-none` : ""
      } ${className ?? "size-full"}`}
    />
  );
}
