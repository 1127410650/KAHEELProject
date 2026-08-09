/**
 * محوّل رقيق بين مشاهد النوافذ (`MascotKind`) وشخصيتَي المنصة المعتمدتين.
 *
 * الرسوم والوضعيات كلها في `Mascot` — هنا فقط إسناد كل مشهد إلى الشخصية
 * والوضعية الصحيحة، فيبقى شكل «كَحيل» و«الزعيم كَحيلان» واحدًا في كل المنصة.
 *
 * توزيع الأدوار ثابت ولا يتغيّر: كَحيل للترحيب والشكر والرسائل الرسمية،
 * وكَحيلان للعروض والمزاح والتشويق.
 */
import {
  Mascot,
  MascotDuo,
  type MascotName,
  type MascotPose,
} from "@/components/marketplace/campaign/Mascot";

export type MascotKind =
  | "moto"
  | "lounge"
  | "wave"
  | "peek"
  | "parcel"
  | "boss"
  | "duo"
  | "olives"
  | "mustache"
  | "tray";

export const MASCOT_KINDS: MascotKind[] = [
  "moto",
  "lounge",
  "wave",
  "peek",
  "parcel",
  "boss",
  "duo",
  "olives",
  "mustache",
  "tray",
];

export type MascotPersona = MascotName | "duo";

export const MASCOT_PERSONA: Record<MascotKind, MascotPersona> = {
  // كَحيل: الترحيب والطمأنة والشكر والتوجيه
  wave: "kaheel",
  lounge: "kaheel",
  peek: "kaheel",
  // كَحيلان: العروض والتشويق والمزاح
  moto: "kaheelan",
  parcel: "kaheelan",
  boss: "kaheelan",
  olives: "kaheelan",
  mustache: "kaheelan",
  tray: "kaheelan",
  // الشخصيتان معًا
  duo: "duo",
};

const POSE: Record<MascotKind, MascotPose> = {
  wave: "wave",
  lounge: "idle",
  peek: "thanks",
  moto: "wave",
  parcel: "tray",
  boss: "idle",
  olives: "tray",
  mustache: "mustache",
  tray: "tray",
  duo: "idle",
};

export function PopupMascot({
  kind,
  lang = "ar",
  animated = true,
  /**
   * ارتفاع الرسم. الافتراضي مقاس البطاقات الصغيرة، و`hero` للبطاقة المنبثقة
   * حيث الشخصية هي البطل البصري (١٦٠px على الجوال، ١٧٦px من `sm:`).
   */
  scale = "card",
}: {
  kind: MascotKind;
  lang?: "ar" | "en";
  animated?: boolean;
  scale?: "card" | "hero";
}) {
  const persona = MASCOT_PERSONA[kind] ?? "kaheel";
  // الاحتواء أولوية على الحجم: على الشاشات الضيقة (320px) تصغر الصورة، والنص لا يصغر.
  const height = scale === "hero" ? "h-24 min-[360px]:h-28 sm:h-32" : "h-[5.5rem] sm:h-24";

  if (persona === "duo") {
    return (
      <div className={`${height} w-full`}>
        <MascotDuo lang={lang} animated={animated} />
      </div>
    );
  }

  return (
    <div className={`flex ${height} shrink-0 items-end justify-center`}>
      <Mascot
        name={persona}
        pose={POSE[kind] ?? "idle"}
        lang={lang}
        animated={animated}
        size={scale === "hero" ? "full" : "sm"}
        className="h-full w-auto"
      />
    </div>
  );
}

