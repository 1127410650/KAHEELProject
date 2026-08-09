/**
 * ═══════════════════════════════════════════════════════════════════════════
 * الشكل المعتمد — لا يُغيَّر إلا بطلب صريح من صاحب المنصة.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * هذا هو **السجل الوحيد** لشخصيتَي المنصة، والصورتان أدناه هما الشكل الرسمي
 * المعتمد نهائيًا (اعتماد صاحب المنصة بتاريخ 09/08/2026):
 *
 * • **كَحيل** — `kaheel.webp`: شاب بعينين واسعتين بنيّتين «كَحيلتين»، لحية قصيرة
 *   مرتبة، طاقية سوداء، قميص أبيض بياقة مطرّزة، **صدرية عنابية مطرّزة بالذهبي**،
 *   حزام قماشي، سروال أسود فضفاض وجزمة، **ويده ممدودة بالترحيب**.
 * • **الزعيم كَحيلان** — `kaheelan.webp`: رجل ممتلئ بشارب كثيف **مفتول**، طاقية
 *   سوداء، **كوفية** على الكتفين، صدرية عنابية مطرّزة، سروال أسود فضفاض وجزمة،
 *   **يرفع عصايته** الخشبية ويده الأخرى على خصره.
 *
 * ## ممنوع (إلا بطلب صريح من صاحب المنصة)
 * • إعادة توليد الصورتين أو تبديلهما بصور أخرى.
 * • تعديل الملامح أو الملابس أو الألوان أو أسلوب الرسم.
 * • إضافة رسم ثانٍ للشخصية نفسها بشكل مختلف.
 *
 * ## أي وضعية جديدة تُشتق من هاتين الصورتين بالضبط
 * الوضعيات (سقوط، ارتطام، ارتداد، إطلالة من الحافة، تلويح…) تُنفَّذ بتحويلات CSS
 * فوق نفس الأصل في `src/components/marketplace/campaign/Mascot.tsx`، فيبقى الوجه
 * واللبس والألوان والأسلوب متطابقًا ١٠٠٪ في كل ظهور.
 *
 * ## نسختان من كل شخصية (نفس الرسم، حجمان)
 * • `full` — الأصل الكامل للأماكن الكبيرة والإطلالات.
 * • `sm`   — نسخة مصغّرة (ارتفاع 300px) للبطاقات والأماكن الصغيرة: بايتات أقل
 *            بلا أي فرق بصري في تلك المقاسات.
 */
import kaheelFull from "@/assets/characters/kaheel.webp";
import kaheelSmall from "@/assets/characters/kaheel-sm.webp";
import kaheelanFull from "@/assets/characters/kaheelan.webp";
import kaheelanSmall from "@/assets/characters/kaheelan-sm.webp";

export type MascotName = "kaheel" | "kaheelan";
/** حجم الأصل المطلوب — نفس الرسم المعتمد، لا شكل مختلف. */
export type MascotSize = "full" | "sm";

export interface MascotAsset {
  src: string;
  /** الأبعاد الحقيقية للملف — لازمة لصفر هزّة تخطيط. */
  width: number;
  height: number;
}

export interface MascotRecord {
  full: MascotAsset;
  sm: MascotAsset;
  /** وصف الشكل المعتمد — يظهر في صفحة المعاينة `/admin/mascots`. */
  note: { ar: string; en: string };
}

/** ⬇️ الشكل المعتمد — لا يُغيَّر إلا بطلب صريح من صاحب المنصة. */
export const MASCOT_ASSETS: Record<MascotName, MascotRecord> = {
  kaheel: {
    full: { src: kaheelFull, width: 325, height: 900 },
    sm: { src: kaheelSmall, width: 108, height: 300 },
    note: {
      ar: "الشكل المعتمد: طاقية سوداء، عيون كَحيلة واسعة، صدرية عنابية مطرّزة بالذهبي، يد ممدودة بالترحيب",
      en: "Approved look: black cap, wide kohl eyes, gold-embroidered maroon vest, welcoming hand",
    },
  },
  kaheelan: {
    full: { src: kaheelanFull, width: 536, height: 900 },
    sm: { src: kaheelanSmall, width: 179, height: 300 },
    note: {
      ar: "الشكل المعتمد: شارب مفتول، كوفية على الكتفين، صدرية عنابية، عصاية مرفوعة",
      en: "Approved look: twirled mustache, keffiyeh on shoulders, maroon vest, raised cane",
    },
  },
};

export const MASCOT_NAMES: MascotName[] = ["kaheel", "kaheelan"];

export function mascotAsset(name: MascotName, size: MascotSize = "full"): MascotAsset {
  return MASCOT_ASSETS[name][size];
}
