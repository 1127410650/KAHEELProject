/**
 * «مسرح الشخصيات» — مصدر واحد يحكم *متى* تظهر شخصية و*أين* يُسمح لها بالظهور.
 *
 * قواعد صاحب المنصة (صارمة، لا استثناء):
 *  ١) **شخصية واحدة فقط على الشاشة في أي لحظة**: أي مشهد يحجز المسرح، ولا يُسمح
 *     لمشهد ثانٍ بالظهور قبل أن يُفرَج عنه (`acquireStage` / `stageBusy`).
 *  ٢) **تكرار قليل**: فاصل طويل بين الظهورات محسوب بـ«زمن التصفح النشط» فقط
 *     (التبويب المخفي لا يُحتسب)، وحد أقصى للظهورات في الجلسة، ولا تظهر الشخصية
 *     نفسها مرتين متتاليتين.
 *  ٣) **صمت بعد الإغلاق**: بعد أي إغلاق تمرّ فترة صمت إجبارية قبل أي ظهور جديد.
 *  ٤) **منطقة آمنة فقط**: الشخصية لا تُرسم إلا في مساحة فارغة فعليًا — نقيس كل
 *     العناصر المرئية (بطاقات، نصوص، أيقونات، أزرار) ونبحث عن شريط حر بهوامش
 *     كافية. إن لم توجد مساحة آمنة ⇒ **لا ظهور إطلاقًا**.
 *
 * كل الأرقام تأتي من لوحة الإدارة (`popup.pacing`) وتُمرّر هنا كـ`StageLimits`.
 */

export interface StageLimits {
  /** أدنى فاصل بين ظهورين، بزمن التصفح النشط. */
  minGapMs: number;
  /** حد أقصى لعدد الظهورات في الجلسة. */
  maxPerSession: number;
  /** صمت إجباري بعد إغلاق أي بطاقة. */
  quietAfterCloseMs: number;
}

// ── زمن التصفح النشط ────────────────────────────────────────────────────────
const ACTIVE_KEY = "kaheel.mascot.activeMs";
let activeMs = 0;
let clockStarted = false;

function startClock(): void {
  if (clockStarted || typeof window === "undefined") return;
  clockStarted = true;
  try {
    activeMs = Number(window.sessionStorage.getItem(ACTIVE_KEY)) || 0;
  } catch {
    activeMs = 0;
  }
  let last = Date.now();
  window.setInterval(() => {
    const now = Date.now();
    // سقف 2s للنبضة: النوم أو الخلفية لا يُحتسب تصفحًا نشطًا.
    if (document.visibilityState === "visible") activeMs += Math.min(2_000, now - last);
    last = now;
    try {
      window.sessionStorage.setItem(ACTIVE_KEY, String(Math.round(activeMs)));
    } catch {
      /* التخزين محجوب: العدّاد يبقى في الذاكرة لهذه الصفحة */
    }
  }, 1_000);
}

/** زمن التصفح النشط منذ بداية الجلسة. */
export function activeElapsed(): number {
  startClock();
  return activeMs;
}

// ── ذاكرة الجلسة ────────────────────────────────────────────────────────────
const STAGE_KEY = "kaheel.mascot.stage";

interface StageState {
  shown: number;
  lastKind: string;
  lastActiveAt: number;
  closedAt: number;
}

const EMPTY: StageState = { shown: 0, lastKind: "", lastActiveAt: 0, closedAt: 0 };

function readState(): StageState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(STAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<StageState>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeState(state: StageState): void {
  try {
    window.sessionStorage.setItem(STAGE_KEY, JSON.stringify(state));
  } catch {
    /* التخزين محجوب: الحدود تُطبّق لهذه الصفحة فقط */
  }
}

/** حاجز الحصر: من يملك المسرح الآن (اسم المشهد) أو `null`. */
let holder: string | null = null;

/** هل يوجد مشهد شخصية على الشاشة الآن؟ (الحاجز أو أي حاوية مسرح في الصفحة) */
export function stageBusy(): boolean {
  if (holder) return true;
  if (typeof document === "undefined") return false;
  return !!document.querySelector("[data-kaheel-stage]");
}

/**
 * هل يُسمح بظهور مشهد من نوع `kind` الآن؟ — كل قواعد التكرار في مكان واحد.
 */
export function canShowMascot(kind: string, limits: StageLimits): boolean {
  if (typeof window === "undefined") return false;
  if (stageBusy()) return false;
  const state = readState();
  if (limits.maxPerSession <= 0) return false;
  if (state.shown >= limits.maxPerSession) return false;
  if (state.shown > 0 && state.lastKind === kind) return false;
  if (state.shown > 0 && activeElapsed() - state.lastActiveAt < limits.minGapMs) return false;
  if (state.closedAt && Date.now() - state.closedAt < limits.quietAfterCloseMs) return false;
  return true;
}

/**
 * حجز المسرح لمشهد واحد. يُرجع دالة الإفراج — نادِها عند اختفاء المشهد، ومرّر
 * `true` عند الإغلاق ليبدأ عدّ فترة الصمت.
 */
export function acquireStage(kind: string): (closed?: boolean) => void {
  holder = kind;
  const state = readState();
  writeState({
    shown: state.shown + 1,
    lastKind: kind,
    lastActiveAt: activeElapsed(),
    closedAt: state.closedAt,
  });
  let released = false;
  return (closed?: boolean) => {
    if (released) return;
    released = true;
    if (holder === kind) holder = null;
    const now = readState();
    writeState({ ...now, closedAt: closed ? Date.now() : now.closedAt });
  };
}

/** لاختبارات المعاينة فقط: تصفير ذاكرة المسرح. */
export function resetStage(): void {
  holder = null;
  activeMs = 0;
  try {
    window.sessionStorage.removeItem(STAGE_KEY);
    window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* لا شيء */
  }
}

// ── المنطقة الآمنة ──────────────────────────────────────────────────────────
/**
 * كل ما يُعدّ محتوى: نصوص، صور، أيقونات، بطاقات وعناصر تفاعلية. الشخصية يجب أن
 * تبتعد عنها كلها بهامش، فلا تغطي بطاقة ولا سطرًا ولا زرًا.
 */
const OBSTACLES =
  "a,button,input,textarea,select,summary,label,img,svg,video,canvas," +
  "h1,h2,h3,h4,h5,p,li,table,[role='button'],[role='link'],[role='tab'],[data-kaheel-card]";

export interface SafeBand {
  /** يسار الشريط الحر بالبكسل (إحداثيات الشاشة). */
  left: number;
  /** أعلى الشريط الحر بالبكسل. */
  top: number;
  /** عرض الشريط الحر. */
  width: number;
}

function viewportObstacles(pad: number): [number, number, number, number][] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out: [number, number, number, number][] = [];
  document.querySelectorAll<HTMLElement>(OBSTACLES).forEach((el) => {
    if (el.closest("[data-kaheel-stage]")) return;
    // الزخرفة الخالصة (خلفيات، أعلام، طبقات موسمية) ليست محتوى يُحمى منه:
    // تتجاهل النقر ولا تحمل نصًا، ولولا استثناؤها لغطّت الشاشة كلها ومنعت
    // أي ظهور للشخصية.
    const decorative =
      !(el.textContent ?? "").trim() &&
      window.getComputedStyle(el).pointerEvents === "none";
    if (decorative) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;

    out.push([r.left - pad, r.top - pad, r.right + pad, r.bottom + pad]);
  });
  return out;
}

/** الفراغات الأفقية المتبقية بعد استبعاد العوائق. */
function freeSegments(blocked: [number, number][], from: number, to: number): [number, number][] {
  const sorted = [...blocked].sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let cursor = from;
  for (const [start, end] of sorted) {
    if (end <= cursor) continue;
    if (start > cursor) gaps.push([cursor, Math.min(start, to)]);
    cursor = Math.max(cursor, end);
    if (cursor >= to) break;
  }
  if (cursor < to) gaps.push([cursor, to]);
  return gaps.filter(([a, b]) => b > a);
}

/**
 * أوسع شريط حر يتّسع لصندوق `width × height` داخل النطاق المسموح — يُبحث من
 * الحافة السفلية صعودًا (المساحة الفارغة عادة أسفل الصفحة). `null` تعني: لا
 * مساحة آمنة ⇒ لا تُظهر الشخصية.
 */
export function findSafeBand(
  width: number,
  height: number,
  opts: { topInset: number; bottomInset: number; pad?: number },
): SafeBand | null {
  if (typeof document === "undefined") return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = opts.pad ?? 12;
  const boxes = viewportObstacles(pad);
  const minTop = opts.topInset;
  const maxBottom = vh - opts.bottomInset;
  if (maxBottom - minTop < height) return null;

  for (let bottom = maxBottom; bottom - height >= minTop; bottom -= 40) {
    const top = bottom - height;
    const blocked = boxes
      .filter((b) => b[3] > top && b[1] < bottom)
      .map((b) => [b[0], b[2]] as [number, number]);
    const best = freeSegments(blocked, pad, vw - pad)
      .filter(([a, b]) => b - a >= width)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (best) return { left: best[0], top, width: best[1] - best[0] };
  }
  return null;
}

/** هل الصندوق المعطى ما زال خاليًا من المحتوى؟ (يُستخدم لإعادة التحقق بعد التمرير) */
export function areaStillFree(
  rect: { left: number; top: number; width: number; height: number },
  pad = 8,
): boolean {
  if (typeof document === "undefined") return false;
  const boxes = viewportObstacles(pad);
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  return !boxes.some((b) => b[0] < right && b[2] > rect.left && b[1] < bottom && b[3] > rect.top);
}
