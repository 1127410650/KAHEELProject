/**
 * جهات ظهور البطاقات وإطلالات كَحيلان — مصدر واحد للحقيقة.
 *
 * القاعدة المعتمدة من صاحب المنصة: البطاقة **لا تظهر من الأعلى دائمًا**. جهة
 * الظهور تتنوّع عشوائيًا في كل مرة بين خمس جهات، ولا تتكرّر الجهة نفسها مرتين
 * متتاليتين. لكل جهة حركة دخول تناسب اتجاهها (spring خفيف) وحركة خروج بنفس
 * الاتجاه عند الإغلاق — أسماء الحركات كلها معرّفة في `src/styles.css`.
 *
 * كل الحالة هنا على مستوى الوحدة (لا `useRef`)، لأن المضيف قد يُعاد تركيبه مع
 * تغيّر شجرة الملاحة؛ ولو حفظنا الجهة الأخيرة داخل المكوّن لصار كل تركيب جديد
 * يسمح بتكرار الجهة نفسها.
 */

/** جهات ظهور البطاقة الكاملة. */
export type EntrySide = "bottom" | "top" | "right" | "left" | "corner";

export const ENTRY_SIDES: EntrySide[] = ["bottom", "top", "right", "left", "corner"];

/** جهات إطلالة كَحيلان برأسه: من حافة يمين أو يسار أو أسفل الشاشة. */
export type PeekSide = "right" | "left" | "bottom";

export const PEEK_SIDES: PeekSide[] = ["right", "left", "bottom"];

let lastEntrySide: EntrySide | null = null;
let lastPeekSide: PeekSide | null = null;

/**
 * اختيار عشوائي بلا تكرار متتالٍ: نختار من بين الجهات الأخرى فقط، فالنتيجة
 * عشوائية فعلًا ومضمون ألا تساوي السابقة.
 */
function pickDifferent<T>(pool: T[], previous: T | null, seed: number): T {
  const others = previous === null ? pool : pool.filter((item) => item !== previous);
  const list = others.length ? others : pool;
  return list[Math.floor(seed * list.length) % list.length]!;
}

/** الجهة التالية لبطاقة كاملة — عشوائية بلا تكرار متتالٍ. */
export function nextEntrySide(seed = Math.random()): EntrySide {
  lastEntrySide = pickDifferent(ENTRY_SIDES, lastEntrySide, seed);
  return lastEntrySide;
}

/** جهة الإطلالة التالية — عشوائية بلا تكرار متتالٍ. */
export function nextPeekSide(seed = Math.random()): PeekSide {
  lastPeekSide = pickDifferent(PEEK_SIDES, lastPeekSide, seed);
  return lastPeekSide;
}

/** لاختبارات الوحدة فقط: تصفير ذاكرة الجهة الأخيرة. */
export function resetEntrySides(): void {
  lastEntrySide = null;
  lastPeekSide = null;
}

/** محاذاة غلاف البطاقة على الشاشة حسب جهة الدخول. */
/**
 * موضع البطاقة على الشاشة لكل جهة — بإحداثيات **فيزيائية** (`left`/`right`)
 * لا منطقية (`start`/`end`). المنصة عربية RTL، فلو استعملنا `justify-end`
 * لظهرت «جهة اليمين» على يسار الشاشة. التمركز يتم بـ `mx-auto` لا بـ
 * `-translate-x-1/2`، لأن `transform` محجوز لحركة الدخول والخروج.
 */
export const ENTRY_POSITION: Record<EntrySide, string> = {
  bottom: "bottom-24 left-0 right-0 mx-auto",
  top: "top-4 left-0 right-0 mx-auto",
  right: "right-3 inset-y-0 my-auto h-fit",
  left: "left-3 inset-y-0 my-auto h-fit",
  corner: "bottom-24 right-3",
};

/** حركة الدخول (spring خفيف) وحركة الخروج بنفس الاتجاه. */
export const ENTRY_ANIMATION: Record<EntrySide, { in: string; out: string }> = {
  bottom: { in: "mascot-in-bottom", out: "mascot-out-bottom" },
  top: { in: "mascot-in-top", out: "mascot-out-top" },
  right: { in: "mascot-in-right", out: "mascot-out-right" },
  left: { in: "mascot-in-left", out: "mascot-out-left" },
  corner: { in: "mascot-in-corner", out: "mascot-out-corner" },
};

/** نقطة الارتكاز المناسبة لكل جهة، فالانضغاط يحدث عند الحافة لا في الفراغ. */
export const ENTRY_ORIGIN: Record<EntrySide, string> = {
  bottom: "bottom center",
  top: "top center",
  right: "center right",
  left: "center left",
  corner: "bottom right",
};

/**
 * موضع الإطلالة وحركتها لكل حافة — أيضًا بإحداثيات فيزيائية. الإطلالة ترتفع
 * فوق الشريط السفلي (`bottom-*`) فلا تحجب أزرار الملاحة.
 */
export const PEEK_LAYOUT: Record<
  PeekSide,
  { position: string; row: string; animation: { in: string; out: string }; origin: string }
> = {
  right: {
    position: "bottom-24 right-0",
    // الصفّ يُرسم بـ dir=ltr دائمًا (انظر المضيف) فالترتيب فيزيائي: الشخصية يمينًا.
    row: "flex-row-reverse",
    animation: { in: "mascot-peek-right", out: "mascot-peek-out-right" },
    origin: "bottom right",
  },
  left: {
    position: "bottom-24 left-0",
    // الشخصية يسارًا عند الحافة، والفقاعة إلى يمينها.
    row: "flex-row",
    animation: { in: "mascot-peek-left", out: "mascot-peek-out-left" },
    origin: "bottom left",
  },
  bottom: {
    position: "bottom-16 left-0 right-0 mx-auto w-fit",
    row: "flex-row",
    animation: { in: "mascot-peek-bottom", out: "mascot-peek-out-bottom" },
    origin: "bottom center",
  },
};

