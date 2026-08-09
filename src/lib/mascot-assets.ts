/**
 * ملف الأصول البصرية لشخصيتَي المنصة — **هنا فقط** تُستبدل الصور.
 *
 * ## أين أستبدل الأصل النهائي؟ (خطوة واحدة)
 * ١) ضع الملف الجديد في `src/assets/characters/` (WebP شفاف مفضّل، أو SVG).
 * ٢) عدّل السطر المقابل في `MASCOT_ASSETS.final` تحت — المسار والأبعاد الحقيقية.
 * ٣) خلاص. لا تلمس أي كود حركة أو منطق: `Mascot` و`PopupMascot`
 *    و`PromoPopupHost` وكل الحركات في `src/styles.css` تقرأ من هنا.
 *
 * ## نسختان من الأصول
 * • `placeholder` — أشكال SVG مؤقتة (بنفس وصف الشخصيتين) لمراجعة كل الحالات
 *   والحركات قبل اعتماد الشكل النهائي.
 * • `final` — الأصول المعتمدة التي تظهر للزوار.
 *
 * النسخة الفعّالة تُختار من صفحة المعاينة `/admin/mascots` وتُحفظ في
 * `localStorage` لهذا الجهاز فقط (معاينة، لا تنشر شيئًا للزوار)، وإلا
 * فالافتراضي `DEFAULT_MASCOT_VARIANT`.
 */
import kaheelFinal from "@/assets/characters/kaheel.webp";
import kaheelanFinal from "@/assets/characters/kaheelan.webp";
import kaheelDraft from "@/assets/characters/kaheel-placeholder.svg";
import kaheelanDraft from "@/assets/characters/kaheelan-placeholder.svg";

export type MascotName = "kaheel" | "kaheelan";
export type MascotVariant = "placeholder" | "final";

export interface MascotAsset {
  src: string;
  /** الأبعاد الحقيقية للملف — لازمة لصفر هزّة تخطيط. */
  width: number;
  height: number;
  /** وصف قصير يظهر في صفحة المعاينة. */
  note: { ar: string; en: string };
}

/** ⬇️ مكان الاستبدال الوحيد في المنصة. */
export const MASCOT_ASSETS: Record<MascotVariant, Record<MascotName, MascotAsset>> = {
  placeholder: {
    kaheel: {
      src: kaheelDraft,
      width: 300,
      height: 600,
      note: { ar: "شكل مؤقت (SVG)", en: "Temporary SVG draft" },
    },
    kaheelan: {
      src: kaheelanDraft,
      width: 340,
      height: 600,
      note: { ar: "شكل مؤقت (SVG)", en: "Temporary SVG draft" },
    },
  },
  final: {
    kaheel: {
      src: kaheelFinal,
      width: 288,
      height: 900,
      note: { ar: "رسم ثلاثي الأبعاد", en: "3D render" },
    },
    kaheelan: {
      src: kaheelanFinal,
      width: 536,
      height: 900,
      note: { ar: "رسم ثلاثي الأبعاد", en: "3D render" },
    },
  },
};

export const MASCOT_VARIANTS: MascotVariant[] = ["final", "placeholder"];

/** النسخة التي يراها الزوار ما لم يبدّلها المسؤول على جهازه من صفحة المعاينة. */
export const DEFAULT_MASCOT_VARIANT: MascotVariant = "final";

const STORAGE_KEY = "kaheel.mascot.variant";
const EVENT = "kaheel:mascot-variant";

function isVariant(value: unknown): value is MascotVariant {
  return value === "placeholder" || value === "final";
}

/** النسخة الفعّالة الآن (تعمل أيضًا على الخادم: ترجع الافتراضي). */
export function activeMascotVariant(): MascotVariant {
  if (typeof window === "undefined") return DEFAULT_MASCOT_VARIANT;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isVariant(stored) ? stored : DEFAULT_MASCOT_VARIANT;
  } catch {
    return DEFAULT_MASCOT_VARIANT;
  }
}

/** تبديل النسخة على هذا الجهاز + إبلاغ كل المكوّنات المعروضة. */
export function setMascotVariant(variant: MascotVariant): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, variant);
  } catch {
    /* التخزين محجوب: التبديل يبقى لهذه الجلسة عبر الحدث. */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: variant }));
}

/** يستدعيه `Mascot` ليعيد الرسم عند التبديل بلا إعادة تحميل الصفحة. */
export function subscribeMascotVariant(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function mascotAsset(name: MascotName, variant: MascotVariant): MascotAsset {
  return MASCOT_ASSETS[variant][name];
}
