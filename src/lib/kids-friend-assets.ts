/**
 * ═══════════════════════════════════════════════════════════════════════════
 * سجل أصول «أصدقاء كَحيل الصغار» — الشكل المعتمد لشخصيات قسم الأطفال.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ست شخصيات ثلاثية الأبعاد (3D render) بأسلوب واحد: إضاءة استوديو دافئة،
 * خطوط مستديرة ناعمة، عيون كبيرة لامعة، خدود وردية، ولمسة بنفسجية من هوية
 * كَحيل في تفصيلة صغيرة لكل شخصية (وشاح، فيونكة، حزام حقيبة، شارة).
 *
 * قانونيًا: كل الشخصيات **أصلية 100%** ومولّدة خصيصًا لهذا المشروع، ولا
 * تحاكي أي شخصية مملوكة لأي شركة.
 *
 * ملاحظة مهمة: كَحيل والزعيم كَحيلان يبقيان شخصيتَي المنصة الرئيسيتين بلا
 * أي تغيير (`src/lib/mascot-assets.ts`) — هذه شخصيات مساعدة لقسم الأطفال فقط.
 *
 * لكل شخصية نسختان من نفس الرسم:
 * • `full` — ارتفاع 640px للأماكن الكبيرة والحالات الفارغة.
 * • `sm`   — ارتفاع 220px للأيقونات والشارات (بايتات أقل بلا فرق بصري).
 */
import birdyFull from "@/assets/characters/kids-birdy.webp";
import birdySm from "@/assets/characters/kids-birdy-sm.webp";
import birdySadFull from "@/assets/characters/kids-birdy-sad.webp";
import birdySadSm from "@/assets/characters/kids-birdy-sad-sm.webp";
import nonoFull from "@/assets/characters/kids-nono.webp";
import nonoSm from "@/assets/characters/kids-nono-sm.webp";
import dabdoobFull from "@/assets/characters/kids-dabdoob.webp";
import dabdoobSm from "@/assets/characters/kids-dabdoob-sm.webp";
import natnootFull from "@/assets/characters/kids-natnoot.webp";
import natnootSm from "@/assets/characters/kids-natnoot-sm.webp";
import najoomaFull from "@/assets/characters/kids-najooma.webp";
import najoomaSm from "@/assets/characters/kids-najooma-sm.webp";

import type { KidsFriendId } from "@/lib/kids-friends";

export interface KidsFriendAsset {
  src: string;
  /** الأبعاد الحقيقية للملف — لازمة لصفر هزّة تخطيط. */
  width: number;
  height: number;
}

export interface KidsFriendArt {
  full: KidsFriendAsset;
  sm: KidsFriendAsset;
}

export const KIDS_FRIEND_ART: Record<KidsFriendId, KidsFriendArt> = {
  birdy: {
    full: { src: birdyFull, width: 370, height: 640 },
    sm: { src: birdySm, width: 127, height: 220 },
  },
  nono: {
    full: { src: nonoFull, width: 492, height: 640 },
    sm: { src: nonoSm, width: 169, height: 220 },
  },
  dabdoob: {
    full: { src: dabdoobFull, width: 522, height: 640 },
    sm: { src: dabdoobSm, width: 180, height: 220 },
  },
  natnoot: {
    full: { src: natnootFull, width: 324, height: 640 },
    sm: { src: natnootSm, width: 111, height: 220 },
  },
  najooma: {
    full: { src: najoomaFull, width: 682, height: 640 },
    sm: { src: najoomaSm, width: 234, height: 220 },
  },
};

/**
 * شخصية الحالة الفارغة: زقزق بتعبير حزين لطيف (حاجبان مائلان ودمعة صغيرة).
 * تُستخدم عند «لا توجد نتائج» لأي قسم داخل عالم الأطفال.
 */
export const KIDS_FRIEND_SAD: KidsFriendArt = {
  full: { src: birdySadFull, width: 355, height: 640 },
  sm: { src: birdySadSm, width: 122, height: 220 },
};

/** الأصل المناسب للقياس المطلوب: `sm` للأيقونات، `full` للأحجام الكبيرة. */
export function kidsFriendArt(
  id: KidsFriendId,
  opts: { mood?: "happy" | "sad"; size: number },
): KidsFriendAsset {
  const art = opts.mood === "sad" ? KIDS_FRIEND_SAD : KIDS_FRIEND_ART[id];
  return opts.size > 140 ? art.full : art.sm;
}
