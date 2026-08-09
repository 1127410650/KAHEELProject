/**
 * محوّل رقيق بين مشاهد النوافذ (MascotKind) وشخصيتَي المنصة الكرتونيتين.
 *
 * الرسوم نفسها تُدار في `KaheelCharacter` — هنا فقط إسناد كل مشهد إلى الشخصية
 * والوضعية الصحيحة، حتى يبقى مظهر «كَحيل» و«الزعيم كَحيلان» ثابتًا في كل نافذة.
 */
import {
  KaheelCharacter,
  type CharacterPose,
  type KaheelPersona,
} from "@/components/marketplace/campaign/KaheelCharacter";

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

/** أي شخصية يمثّلها كل مشهد — الإسناد ثابت ولا يتغيّر بين النوافذ. */
export type MascotPersona = KaheelPersona;

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
  // مشهد التعارف بالشخصيتين
  duo: "duo",
};

const POSE: Record<MascotKind, CharacterPose> = {
  wave: "wave",
  lounge: "welcome",
  peek: "thanks",
  moto: "moto",
  parcel: "moto",
  boss: "boss",
  olives: "olives",
  mustache: "mustache",
  tray: "tray",
  duo: "meet",
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
  const pose = POSE[kind] ?? "wave";

  if (kind === "duo") {
    return (
      <div className="h-[5.5rem] w-full sm:h-24">
        <KaheelCharacter persona="duo" pose="meet" lang={lang} animated={animated} />
      </div>
    );
  }

  return (
    <div className="size-[4.5rem] shrink-0 sm:size-24">
      <KaheelCharacter persona={persona} pose={pose} lang={lang} animated={animated} />
    </div>
  );
}
