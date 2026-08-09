/**
 * منطق «سقوط الشخصية عند اللمس» — بديل الظهور التلقائي المقتحم.
 *
 * القاعدة التي طلبها صاحب المنصة: البطاقة لا تظهر من تلقاء نفسها. المستخدم
 * يلمس عنصرًا (رابط/زر/وجهة)، فتسقط الشخصية إلى منتصف الشاشة بحركة مرحة ثم
 * تختفي بهدوء — والوجهة تُفتح كما هي بلا أي تأخير أو اعتراض.
 *
 * لذلك كل ما هنا قراءة فقط: لا `preventDefault`، ولا `stopPropagation`، ولا
 * انتظار. المضيف يستمع في مرحلة الالتقاط (capture) ويكتفي بجدولة رسم فوق
 * الصفحة، والمتصفح يكمل الملاحة في نفس اللحظة.
 */

/** فاصل مريح بين سقوطين، فالمزحة تبقى لطيفة ولا تصير ضجيجًا. */
export const DROP_COOLDOWN_MS = 18_000;
/** مدة بقاء الشخصية على الشاشة (سقوط + ارتداد + اختفاء). */
export const DROP_VISIBLE_MS = 1_200;

/** نافذة رصد الكبس السريع. */
export const RAPID_WINDOW_MS = 4_000;
/** عدد الضغطات المتتالية داخل النافذة الذي يستدعي مزحة الزعيم كَحيلان. */
export const RAPID_TAPS = 5;
/** فاصل بين مزحتَي كبس، حتى لا تتحول هي نفسها لإزعاج. */
export const RAPID_COOLDOWN_MS = 15_000;

/** عناصر يُعتدّ بلمسها: روابط وأزرار ووجهات صريحة. */
const TARGET_SELECTOR =
  'a[href], button, [role="button"], [role="link"], [role="tab"], [data-kaheel-drop]';

/** حقول الكتابة والتحكم الدقيق: لا مزح فوقها. */
const IGNORE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [data-kaheel-no-drop], [role="slider"], [role="textbox"]';

/**
 * هل هذا اللمس يستحق سقوط الشخصية؟ يرجع العنصر المستهدف أو `null`.
 * لا يغيّر شيئًا في الحدث — الوجهة تفتح دائمًا.
 */
export function tapTarget(event: Event): HTMLElement | null {
  const node = event.target as Element | null;
  if (!node || typeof node.closest !== "function") return null;
  if (node.closest(IGNORE_SELECTOR)) return null;
  // لا نتفاعل مع اللمس داخل بطاقة الشخصية نفسها.
  if (node.closest("[data-kaheel-drop-card]")) return null;
  const target = node.closest<HTMLElement>(TARGET_SELECTOR);
  if (!target) return null;
  if (target.getAttribute("aria-disabled") === "true") return null;
  if (target instanceof HTMLButtonElement && target.disabled) return null;
  return target;
}

/** حالة عدّاد الكبس السريع — يعيشها المضيف في `useRef`. */
export interface TapBurst {
  /** أوقات الضغطات داخل النافذة الحالية. */
  times: number[];
  /** آخر مرة ظهرت فيها مزحة الكبس. */
  lastJokeAt: number;
}

export const emptyBurst = (): TapBurst => ({ times: [], lastJokeAt: 0 });

/**
 * يسجّل ضغطة ويقول إن كانت الضغطات الأخيرة كثيرة بما يكفي لمزحة الكبس.
 * النافذة متدحرجة: نُبقي الضغطات داخل `RAPID_WINDOW_MS` فقط.
 */
export function registerTap(burst: TapBurst, now = Date.now()): boolean {
  burst.times = burst.times.filter((time) => now - time <= RAPID_WINDOW_MS);
  burst.times.push(now);
  if (burst.times.length < RAPID_TAPS) return false;
  if (now - burst.lastJokeAt < RAPID_COOLDOWN_MS) return false;
  burst.lastJokeAt = now;
  burst.times = [];
  return true;
}

/** هل المستخدم يفضّل تقليل الحركة؟ عندها نكتفي بظهور واختفاء ناعمين. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * حالة مشتركة على مستوى الوحدة: المضيف قد يُعاد تركيبه مع تغيّر الشجرة، ولو
 * حفظنا العدّاد في `useRef` لصار كل تركيب جديد يصفّر الفاصل وعدّاد الكبس.
 * لذلك نُبقي الحالة هنا: فاصل السقوط وعدّاد الكبس يعيشان مع الصفحة نفسها.
 */
const sharedBurst = emptyBurst();
let lastDropAt = 0;

/** يسجّل ضغطة ويرجع القرار: هل نُسقط الشخصية؟ وهل هي مزحة كبس؟ */
export function decideDrop(now = Date.now()): { drop: boolean; rapid: boolean } {
  const rapid = registerTap(sharedBurst, now);
  if (rapid) {
    lastDropAt = now;
    return { drop: true, rapid: true };
  }
  if (now - lastDropAt < DROP_COOLDOWN_MS) return { drop: false, rapid: false };
  lastDropAt = now;
  return { drop: true, rapid: false };
}
