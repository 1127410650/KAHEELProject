/**
 * قياس الأداء الحقيقي من متصفحات الزوار (RUM) — يمرّ عبر محرك التتبع الموحّد
 * `src/lib/track.ts` فلا نظام قياس موازٍ ولا نقطة استقبال ثانية.
 *
 * القياسات مأخوذة من واجهات المتصفح نفسها بلا أي مكتبة خارجية:
 *  - LCP من `largest-contentful-paint`.
 *  - CLS من مجموع أكبر نافذة `layout-shift` بلا تدخل المستخدم.
 *  - INP تقديريًا من أطول `event` (Event Timing) — أعلى تأخير تفاعل مُقاس.
 *  - وزن الأصول من `resource` عند تجاوز الحدّ، لتُقاس الأصول الثقيلة فعليًا.
 *
 * قواعد الخصوصية نفسها: لا IP، لا بصمة، لا نص كتبه المستخدم — المسار والقيمة فقط.
 */
import { track } from "@/lib/track";

/** أصل أثقل من هذا الحدّ يُبلَّغ عنه ليُقارن بميزانية الصفحة في الإدارة. */
const HEAVY_ASSET_KB = 200;
const MAX_ASSET_REPORTS = 8;

let started = false;

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

function emit(metric: "LCP" | "INP" | "CLS", value: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  track({
    name: "perf.web_vital",
    surface: window.location.pathname.startsWith("/admin") ? "admin" : "market",
    props: {
      metric,
      // CLS كسر عشري، وBaقي المقاييس مللي ثانية صحيحة.
      value: metric === "CLS" ? Number(value.toFixed(4)) : Math.round(value),
    },
  });
}

function observe(type: string, cb: (entries: PerformanceEntry[]) => void, buffered = true): void {
  try {
    const observer = new PerformanceObserver((list) => cb(list.getEntries()));
    observer.observe({ type, buffered } as PerformanceObserverInit);
  } catch {
    /* المتصفح لا يدعم النوع — القياس يسقط بهدوء ولا يعطّل الصفحة */
  }
}

/**
 * تُستدعى مرة واحدة عند التحميل. القيم تُرسل عند إخفاء الصفحة فقط لأن LCP
 * وCLS وINP لا تكتمل قبل ذلك، وحينها `track` يُفرغ الدفعة بـ `sendBeacon`.
 */
export function startWebVitals(): void {
  if (started || typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  started = true;

  let lcp = 0;
  let inp = 0;
  let clsCurrent = 0;
  let clsWorst = 0;
  let clsFirstAt = 0;
  let clsLastAt = 0;
  let assetsReported = 0;

  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = Math.max(lcp, last.startTime);
  });

  observe("event", (entries) => {
    for (const entry of entries) {
      const duration = entry.duration;
      if (duration > inp) inp = duration;
    }
  });

  observe("layout-shift", (entries) => {
    for (const raw of entries) {
      const entry = raw as LayoutShift;
      if (entry.hadRecentInput) continue;
      // نافذة الجلسة: أكبر مجموع إزاحات متقاربة (فجوة ثانية / نافذة ٥ ثوانٍ).
      if (
        clsCurrent > 0 &&
        (entry.startTime - clsLastAt > 1000 || entry.startTime - clsFirstAt > 5000)
      ) {
        clsWorst = Math.max(clsWorst, clsCurrent);
        clsCurrent = 0;
      }
      if (clsCurrent === 0) clsFirstAt = entry.startTime;
      clsLastAt = entry.startTime;
      clsCurrent += entry.value;
    }
    clsWorst = Math.max(clsWorst, clsCurrent);
  });

  observe("resource", (entries) => {
    for (const raw of entries) {
      if (assetsReported >= MAX_ASSET_REPORTS) return;
      const entry = raw as PerformanceResourceTiming;
      const bytes = entry.transferSize || entry.encodedBodySize || 0;
      const kb = Math.round(bytes / 1024);
      if (kb < HEAVY_ASSET_KB) continue;
      let path = entry.name;
      try {
        path = new URL(entry.name).pathname;
      } catch {
        /* اسم غير قابل للتحليل — يُرسل كما هو مقصوصًا */
      }
      assetsReported += 1;
      track({
        name: "perf.asset",
        props: {
          path: path.slice(0, 120),
          kb,
          kind: entry.initiatorType.slice(0, 20),
        },
      });
    }
  });

  const report = () => {
    if (document.visibilityState !== "hidden") return;
    emit("LCP", lcp);
    if (inp > 0) emit("INP", inp);
    emit("CLS", Math.max(clsWorst, clsCurrent));
    document.removeEventListener("visibilitychange", report);
  };
  document.addEventListener("visibilitychange", report);
}
