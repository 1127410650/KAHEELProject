/**
 * ═══════════════════════════════════════════════════════════════════════════
 * إطارات المشي (sprite frames) — مشتقة من الشكل المعتمد نفسه، لا شكل جديد.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * لكل شخصية **٤ إطارات** بنفس الوجه واللبس والألوان والزاوية والحجم تمامًا،
 * ولا تختلف إلا في وضع الأرجل (والعصاية لكَحيلان):
 *  1. الرجل اليمنى للأمام واليسرى للخلف.
 *  2. منتصف الخطوة — الرجلان متقاربتان والجسم مرتفع قليلًا.
 *  3. الرجل اليسرى للأمام واليمنى للخلف.
 *  4. منتصف الخطوة المعاكس.
 *
 * الإطارات مُطبّعة آليًا: قُصّت على حدود البكسل غير الشفاف، ووُحّد ارتفاعها
 * (300px)، وحُوذيت أفقيًا على مركز كتلة الشخصية ⇒ لا رجفة ولا قفزة بين الإطارات.
 *
 * ملاحظة: الشكل المعتمد في `mascot-assets.ts` لا يُغيَّر؛ هذه الإطارات إضافة
 * للحركة فقط ويجري تحميلها كسولًا عند أول ظهور للمشهد.
 */
import kaheel1 from "@/assets/characters/kaheel-walk-1.webp";
import kaheel2 from "@/assets/characters/kaheel-walk-2.webp";
import kaheel3 from "@/assets/characters/kaheel-walk-3.webp";
import kaheel4 from "@/assets/characters/kaheel-walk-4.webp";
import kaheelan1 from "@/assets/characters/kaheelan-walk-1.webp";
import kaheelan2 from "@/assets/characters/kaheelan-walk-2.webp";
import kaheelan3 from "@/assets/characters/kaheelan-walk-3.webp";
import kaheelan4 from "@/assets/characters/kaheelan-walk-4.webp";

import type { MascotName } from "@/lib/mascot-assets";

export interface WalkCycle {
  /** الإطارات بالترتيب الصحيح للخطوة. */
  frames: string[];
  /** أبعاد كل إطار (متطابقة للأربعة) — لصفر هزّة تخطيط. */
  width: number;
  height: number;
  /** عدد الإطارات في الثانية — مشي مريح لا مُسرَّع. */
  fps: number;
  alt: { ar: string; en: string };
}

export const MASCOT_WALK: Record<MascotName, WalkCycle> = {
  kaheel: {
    frames: [kaheel1, kaheel2, kaheel3, kaheel4],
    width: 79,
    height: 300,
    fps: 9,
    alt: { ar: "كَحيل يتمشّى بخطوات هادئة", en: "Kaheel walking calmly" },
  },
  kaheelan: {
    frames: [kaheelan1, kaheelan2, kaheelan3, kaheelan4],
    width: 185,
    height: 300,
    fps: 8,
    alt: {
      ar: "الزعيم كَحيلان يمشي مشية زعيم وعصايته معه",
      en: "Boss Kaheelan strutting along with his cane",
    },
  },
};

export function walkCycle(name: MascotName): WalkCycle {
  return MASCOT_WALK[name];
}
