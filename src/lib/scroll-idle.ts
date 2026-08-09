/**
 * «سكون التمرير» — مصدر واحد يقول: هل توقّف الزائر عن التمرير وثبت على منطقة
 * معيّنة؟ الشخصيات تظهر عند هذه اللحظة فقط (الزائر يقرأ أو يتأمل)، ولا تظهر
 * أثناء التمرير (الزائر يبحث ⇒ لا تُقاطعه).
 *
 * الأداء أولًا — القاعدة: لا حساب ثقيل داخل مستمع التمرير إطلاقًا.
 *  • مستمع واحد مشترك لكل الصفحة (`passive: true`) لا يُنشئ مستمعًا لكل مكوّن.
 *  • داخل المستمع: قراءة `scrollY` وكتابة مؤقّت فقط — لا قياسات تخطيط
 *    (getBoundingClientRect) ولا حسابات مساحة آمنة ولا setState.
 *  • كبح (throttle) بـ80ms للإشعار بـ«بدأ التمرير»، وتهدئة (debounce) لإشعار
 *    «سكن التمرير». قياس المساحة الآمنة يحدث بعد السكون فقط.
 */

type IdleListener = {
  idleMs: number;
  onIdle: () => void;
  onScroll?: (deltaPx: number) => void;
};

const listeners = new Set<IdleListener>();

let attached = false;
let lastY = 0;
let lastNotify = 0;
let idleTimer = 0;
/** أقصر مهلة سكون مطلوبة بين المشتركين — لتقليل عدد المؤقّتات إلى واحد. */
let minIdle = 2_500;

function fireIdle(): void {
  idleTimer = 0;
  for (const l of listeners) l.onIdle();
}

/** المستمع الفعلي: أرخص ما يمكن — قراءة واحدة وكتابة مؤقّت. */
function handleScroll(): void {
  const y = window.scrollY;
  const delta = Math.abs(y - lastY);
  lastY = y;
  const now = Date.now();
  // كبح إشعار «يتمرّر الآن»: 12 إشعارًا/ث كحد أقصى بدل مئات.
  if (now - lastNotify >= 80) {
    lastNotify = now;
    for (const l of listeners) l.onScroll?.(delta);
  }
  if (idleTimer) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(fireIdle, minIdle);
}

function sync(): void {
  minIdle = Math.min(...[...listeners].map((l) => l.idleMs), 10_000);
  if (listeners.size > 0 && !attached) {
    attached = true;
    lastY = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
  } else if (listeners.size === 0 && attached) {
    attached = false;
    window.removeEventListener("scroll", handleScroll);
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = 0;
  }
}

/**
 * يشترك في لحظات سكون التمرير. `onIdle` تُنادى بعد `idleMs` من آخر تمرير،
 * و`onScroll` تُنادى مكبوحة أثناء التمرير مع مقدار الحركة (لإخفاء المشهد عند
 * استئناف التمرير بسرعة). تُرجع دالة إلغاء الاشتراك.
 */
export function watchScrollIdle(listener: IdleListener): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  sync();
  return () => {
    listeners.delete(listener);
    sync();
  };
}

/** هل الصفحة ساكنة الآن (لا تمرير جارٍ)؟ */
export function scrollIdleNow(): boolean {
  return idleTimer === 0;
}
