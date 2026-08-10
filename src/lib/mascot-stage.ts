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
  "h1,h2,h3,h4,h5,h6,p,li,table,dl,form,header,nav,footer,aside," +
  "[role='button'],[role='link'],[role='tab'],[role='alert'],[role='status']," +
  "[role='dialog'],[role='navigation'],[role='banner'],[role='listbox']," +
  "[data-kaheel-card],[data-kaheel-stories],[data-kaheel-banner]," +
  "[data-kaheel-strip],[data-kaheel-nav],[data-slot='card']";


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
 * فحص نقطة فعلية بـ`elementsFromPoint`: هل تحت هذه النقطة محتوى؟
 *
 * القياس بالمستطيلات وحده لا يكفي: بانر بصورة خلفية أو دائرة ستوري أو شريط
 * تنبيه قد لا يطابق أي محدّد. هنا نسأل الصفحة نفسها: ما العناصر تحت النقطة؟
 * ونعدّ النقطة مشغولة إن كان أيٌّ منها نصًا أو صورة أو عنصرًا تفاعليًا أو
 * سطحًا بصورة خلفية (بانر) — والتدرّجات وحدها تُعدّ زخرفة خلفية.
 */
function pointBlocked(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
  const stack = document.elementsFromPoint(x, y).slice(0, 8);
  for (const el of stack) {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue;
    if (el.closest("[data-kaheel-stage]")) continue;
    if (el.tagName === "HTML" || el.tagName === "BODY") continue;
    if (el.matches(OBSTACLES)) {
      // زخرفة خالصة: بلا نص وتتجاهل النقر (أعلام، طبقات موسمية).
      const decorative =
        !(el.textContent ?? "").trim() &&
        window.getComputedStyle(el as Element).pointerEvents === "none" &&
        !(el instanceof HTMLImageElement);
      if (!decorative) return true;
    }
    const style = window.getComputedStyle(el as Element);
    const bg = style.backgroundImage;
    // صورة خلفية حقيقية (بانر «مساحتك الإعلانية»، صور الستوريات) = محتوى.
    if (bg && bg !== "none" && !/^(linear|radial|conic|repeating)-gradient/.test(bg.trim())) {
      return true;
    }
    // نص مباشر داخل هذا العنصر (عناوين أقسام، شرائح، تسميات).
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 && (node.textContent ?? "").trim().length > 0) return true;
    }
  }
  return false;
}

/** شبكة نقاط داخل الصندوق: أي نقطة مشغولة ⇒ الصندوق غير صالح. */
function boxIsClear(
  rect: { left: number; top: number; width: number; height: number },
  pad = 0,
): boolean {
  const left = rect.left - pad;
  const top = rect.top - pad;
  const right = rect.left + rect.width + pad;
  const bottom = rect.top + rect.height + pad;
  const xs = [0, 0.25, 0.5, 0.75, 1].map((f) => left + (right - left) * f);
  const ys = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => top + (bottom - top) * f);
  for (const x of xs) {
    for (const y of ys) {
      if (pointBlocked(Math.min(window.innerWidth - 1, Math.max(1, x)), Math.min(window.innerHeight - 1, Math.max(1, y)))) {
        return false;
      }
    }
  }
  return true;
}

/**
 * أوسع منطقة فارغة **فعلًا** تتّسع للمشهد كاملًا (الشخصية + الرفيق + الفقاعة).
 *
 * الخوارزمية: نقيس كل العناصر المرئية (`getBoundingClientRect`) ونستبعدها،
 * ثم نبحث من الحافة السفلية صعودًا عن شريط عرضه ≥ `width`، ثم **نتحقق حسّيًا**
 * بشبكة نقاط (`elementsFromPoint`) أنّ الصندوق خالٍ تمامًا. نجمع كل المرشّحين
 * الصالحين ونختار الأوسع. `null` تعني: **لا مساحة كافية ⇒ لا ظهور إطلاقًا**.
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

  let best: SafeBand | null = null;
  for (let bottom = maxBottom; bottom - height >= minTop; bottom -= 24) {
    const top = bottom - height;
    const blocked = boxes
      .filter((b) => b[3] > top && b[1] < bottom)
      .map((b) => [b[0], b[2]] as [number, number]);
    const candidates = freeSegments(blocked, pad, vw - pad)
      .filter(([a, b]) => b - a >= width)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    for (const [a, b] of candidates) {
      const band: SafeBand = { left: a, top, width: b - a };
      if (!boxIsClear({ left: a, top, width: b - a, height })) continue;
      if (!best || band.width > best.width) best = band;
      break;
    }
    // منطقة سفلية واسعة كفاية ⇒ نكتفي بها (المساحة الفارغة عادة أسفل الصفحة).
    if (best && best.width >= width * 1.6) break;
  }
  return best;
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
  const overlaps = boxes.some(
    (b) => b[0] < right && b[2] > rect.left && b[1] < bottom && b[3] > rect.top,
  );
  if (overlaps) return false;
  return boxIsClear(rect);
}


// ── الذكاء اللوني: لون النص يتكيّف مع خلفية المكان ──────────────────────────
/**
 * النص بلا خلفية إطلاقًا، فالقراءة تُضمن بلونين متكيّفين + ظل حروف خفيف
 * (كأسلوب الترجمة على الفيديو). هنا نفحص فعليًا خلفية المنطقة التي سينزل فيها
 * النص: نأخذ عيّنات نقاط داخل الصندوق، ولكل نقطة نصعد في شجرة العناصر حتى أول
 * خلفية غير شفافة، ثم نحسب السطوع النسبي (luminance) ونصوّت: فاتحة أم داكنة.
 */
export type AreaTone = "light" | "dark";

function parseColor(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] === undefined ? 1 : parts[3]!];
}

function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** سطوع الخلفية الفعلية عند نقطة، أو `null` إن تعذّر القياس. */
function toneAtPoint(x: number, y: number): number | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue;
    if (el.closest("[data-kaheel-stage]")) continue;
    const style = window.getComputedStyle(el as Element);
    // تدرّج لوني: نحكم عليه بلون النص المضاد الشائع (تدرّجات كَحيل داكنة).
    if (style.backgroundImage && style.backgroundImage !== "none") {
      if (/gradient/.test(style.backgroundImage)) return 0.12;
    }
    const color = parseColor(style.backgroundColor);
    if (color && color[3] > 0.55) return luminance(color[0], color[1], color[2]);
  }
  return null;
}

export function sampleAreaTone(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): AreaTone {
  if (typeof document === "undefined") return "light";
  const xs = [0.2, 0.5, 0.8].map((f) => rect.left + rect.width * f);
  const ys = [0.25, 0.6].map((f) => rect.top + rect.height * f);
  const samples: number[] = [];
  for (const x of xs) {
    for (const y of ys) {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
      const value = toneAtPoint(x, y);
      if (value !== null) samples.push(value);
    }
  }
  if (samples.length === 0) return "light";
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return avg < 0.45 ? "dark" : "light";
}

/** أنماط النص العائم بلا خلفية — لون + ظل حروف حسب سطوع المكان. */
export function floatingTextStyle(tone: AreaTone): {
  color: string;
  textShadow: string;
} {
  return tone === "dark"
    ? {
        color: "#FFFFFF",
        textShadow:
          "0 1px 2px rgba(16,0,43,0.85), 0 0 6px rgba(16,0,43,0.65), 0 0 1px rgba(16,0,43,0.9)",
      }
    : {
        color: "#3C096C",
        textShadow:
          "0 1px 2px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.85), 0 0 1px rgba(255,255,255,0.9)",
      };
}
