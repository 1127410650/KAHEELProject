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
}: {
  kind: MascotKind;
  lang?: "ar" | "en";
  animated?: boolean;
}) {
  const persona = MASCOT_PERSONA[kind] ?? "kaheel";

  if (persona === "duo") {
    return (
      <div className="h-[5.5rem] w-full sm:h-24">
        <MascotDuo lang={lang} animated={animated} />
      </div>
    );
  }

  return (
    <div className="flex h-[5.5rem] shrink-0 items-end justify-center sm:h-24">
      <Mascot
        name={persona}
        pose={POSE[kind] ?? "idle"}
        lang={lang}
        animated={animated}
        size="sm"
        className="h-full w-auto"
      />
    </div>
  );
}
