/**
 * محرك التتبع الموحّد — نقطة واحدة لكل حدث في المنصة.
 *
 * قواعد الخصوصية (§24): لا IP مخزَّن، لا بصمة جهاز، لا معرّف دائم في المتصفح.
 * مفتاح الجلسة عمره عمر تبويب المتصفح فقط (`sessionStorage`)، والمُحيل يُختصر
 * إلى اسم النطاق دون مسار. لا يُرسل أي محتوى نصي كتبه المستخدم.
 *
 * الأحداث تتجمّع وتُرسل دفعات (١٠ أحداث أو ٣ ثوانٍ) وتُفرَّغ عند إخفاء الصفحة
 * عبر `sendBeacon`، فلا تُفقد أحداث المغادرة ولا تُبطّئ التنقّل.
 */

const ENDPOINT = "/api/public/track";
const SESSION_KEY_STORAGE = "kaheel.track.session";
const TEST_FLAG_STORAGE = "kaheel.track.test";
const BATCH_SIZE = 10;
const FLUSH_MS = 3000;
const MAX_QUEUE = 40;

export interface TrackEvent {
  name: string;
  surface?: string;
  entity_kind?: string;
  entity_id?: string;
  props?: Record<string, string | number | boolean>;
}

interface QueuedEvent extends TrackEvent {
  event_id: string;
  occurred_at: string;
  route_path?: string;
  session_key: string;
  device: string;
  referrer_host?: string;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersReady = false;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

/** مفتاح جلسة عشوائي عمره التبويب — ليس معرّفًا لشخص ولا يعبر الجلسات. */
function sessionKey(): string {
  if (!isBrowser()) return "ssr";
  try {
    const existing = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (existing) return existing;
    const next = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    sessionStorage.setItem(SESSION_KEY_STORAGE, next);
    return next;
  } catch {
    return "nostore";
  }
}

/** وضع الاختبار: أحداثه تُعلَّم `is_test` وتُحذف عند إغلاق الاختبارات. */
export function isTestMode(): boolean {
  if (!isBrowser()) return false;
  try {
    return localStorage.getItem(TEST_FLAG_STORAGE) === "1";
  } catch {
    return false;
  }
}

export function setTestMode(on: boolean): void {
  if (!isBrowser()) return;
  try {
    if (on) localStorage.setItem(TEST_FLAG_STORAGE, "1");
    else localStorage.removeItem(TEST_FLAG_STORAGE);
  } catch {
    /* لا شيء — التتبع لا يُعطّل التطبيق أبدًا */
  }
}

function deviceClass(): string {
  if (!isBrowser()) return "server";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1200) return "tablet";
  return "desktop";
}

function referrerHost(): string | undefined {
  if (!isBrowser() || !document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? undefined : host;
  } catch {
    return undefined;
  }
}

/** أسماء الأحداث محصورة بنمط ثابت: حروف صغيرة ونقاط وشرطة سفلية. */
function validName(name: string): boolean {
  return /^[a-z][a-z0-9_.]{1,58}$/.test(name);
}

function send(batch: QueuedEvent[]): void {
  if (batch.length === 0) return;
  const body = JSON.stringify({ events: batch, is_test: isTestMode() });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* فقدان حدث لا يُعطّل تجربة المستخدم */
  }
}

export function flushTracking(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue;
  queue = [];
  send(batch);
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flushTracking();
  }, FLUSH_MS);
}

function ensureListeners(): void {
  if (listenersReady || !isBrowser()) return;
  listenersReady = true;
  window.addEventListener("pagehide", flushTracking);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTracking();
  });
}

/** تسجيل حدث. آمن للاستدعاء في أي مكان — لا يرمي استثناء ولا ينتظر الشبكة. */
export function track(event: TrackEvent): void {
  if (!isBrowser() || !validName(event.name)) return;
  ensureListeners();
  if (queue.length >= MAX_QUEUE) return;

  const host = referrerHost();
  queue.push({
    ...event,
    event_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    route_path: window.location.pathname.slice(0, 200),
    session_key: sessionKey(),
    device: deviceClass(),
    ...(host ? { referrer_host: host } : {}),
  });

  if (queue.length >= BATCH_SIZE) flushTracking();
  else schedule();
}

/** مشاهدة صفحة — تُستدعى مرة لكل تغيّر مسار. */
export function trackPageView(surface?: string): void {
  track({ name: "page.view", ...(surface ? { surface } : {}) });
}

