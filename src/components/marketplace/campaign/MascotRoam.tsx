/**
 * تجوّل الشخصيتين — مشهد واحد، في منطقة آمنة فقط، وبتكرار قليل جدًا.
 *
 * القواعد المعتمدة (صارمة):
 *  • **شخصية واحدة فقط على الشاشة**: المشهد يحجز «مسرح الشخصيات»
 *    (`acquireStage`)، فلا يظهر مشهد ثانٍ — لا بطاقة ولا إطلالة — قبل انتهائه.
 *  • **تكرار قليل**: فاصل طويل بزمن التصفح النشط، حد أقصى للجلسة، ولا تظهر
 *    الشخصية نفسها مرتين متتاليتين — كلها من لوحة الإدارة عبر `popup.pacing`.
 *  • **صمت بعد الإغلاق**: لا ظهور أثناء فترة الصمت التالية لأي إغلاق.
 *  • **لا تغطية للمحتوى إطلاقًا**: الموضع يُقاس لحظة الظهور بـ`findSafeBand`
 *    (شريط حر فعلًا بهوامش من كل بطاقة/نص/زر). إن لم توجد مساحة آمنة ⇒ لا ظهور.
 *    وأثناء العرض يُعاد التحقق كل نصف ثانية، وأي تغيّر يجعل المكان غير آمن
 *    (تمرير، تحميل بطاقات، تغيير مقاس) يُنهي المشهد فورًا.
 *  • `pointer-events: none` على كل الحاوية ⇒ لا تعترض ضغطة ولا تمريرًا.
 *  • الحركة على `transform`/`opacity` فقط (CLS = 0)، تتوقّف مع إخفاء التبويب
 *    وتُطفأ كليًا مع `prefers-reduced-motion`.
 *  • لا خلفية بيضاء: النص على لوح زجاجي بنفسجي شفاف (`k-mascot-glass`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { MascotWalk } from "@/components/marketplace/campaign/MascotWalk";
import { useI18n } from "@/i18n";
import {
  acquireStage,
  areaStillFree,
  canShowMascot,
  findSafeBand,
  type SafeBand,
} from "@/lib/mascot-stage";
import { useCallCenter } from "@/lib/mkt-call-center";
import { watchScrollIdle } from "@/lib/scroll-idle";
import {
  isQuietPath,
  isTypingNow,
  popupsMuted,
  popupsSuppressed,
  usePopupPacing,
} from "@/lib/popup-pacing";

type RoamScene = "stroll" | "search";

/** ترحيب كَحيل القصير — نبرة رسمية مؤدّبة. */
const STROLL_COPY: { ar: string; en: string }[] = [
  { ar: "مرحبا فيك بكَحيل 🤍", en: "Welcome to Kaheel 🤍" },
  { ar: "عم مرق أشوف كل شي تمام 👌", en: "Just passing by to check on things 👌" },
  { ar: "إذا احتجت شي، أنا هون.", en: "If you need anything, I'm here." },
];

/** جُمل كَحيلان أثناء دورانه — نبرة زعيم الحارة. */
const SEARCH_COPY: { ar: string; en: string }[] = [
  { ar: "شفتك محتار… ترا عندي واسطة كبيرة 👀", en: "You look unsure… I've got a big favour 👀" },
  { ar: "عم دوّر عليك… شو بدك؟ 🧣", en: "I was looking for you… what do you need? 🧣" },
  { ar: "قول كلمة وبتوصل بواسطتي 😉", en: "Say the word — it happens through me 😉" },
];

/** مقاس المشهد: الفقاعة فوق الشخصية. يُستخدم لقياس المساحة الآمنة قبل الظهور. */
const SCENE_WIDTH = 176;
const SCENE_HEIGHT = 124;
/** أدنى عرض شريط آمن يستحق مشهد مشي (مساحة تنقّل معقولة). */
const MIN_TRAVEL = 56;

/** اختيار جملة لا تتكرّر مباشرة بعد سابقتها. */
function pickCopy(
  pool: { ar: string; en: string }[],
  last: { current: string },
  ar: boolean,
): string {
  const options = pool.filter((line) => (ar ? line.ar : line.en) !== last.current);
  const list = options.length > 0 ? options : pool;
  const picked = list[Math.floor(Math.random() * list.length)]!;
  const text = ar ? picked.ar : picked.en;
  last.current = text;
  return text;
}

interface Scene {
  key: number;
  kind: RoamScene;
  copy: string;
  band: SafeBand;
}

export function MascotRoam() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const pacing = usePopupPacing();
  const { call } = useCallCenter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [scene, setScene] = useState<Scene | null>(null);
  const [paused, setPaused] = useState(false);
  const keyRef = useRef(0);
  const hideTimer = useRef(0);
  const lastCopyRef = useRef("");
  const releaseRef = useRef<((closed?: boolean) => void) | null>(null);

  const limits = {
    minGapMs: pacing.mascotMinGapMs,
    maxPerSession: pacing.mascotMaxPerSession,
    quietAfterCloseMs: pacing.mascotQuietAfterCloseMs,
  };

  /** إنهاء المشهد والإفراج عن المسرح. */
  const end = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    releaseRef.current?.();
    releaseRef.current = null;
    setScene(null);
  }, []);

  /** بوابات الأدب — أي واحدة تمنع التجوّل. */
  const blockedNow = useCallback(() => {
    if (!pacing.roamEnabled || !pacing.enabled) return true;
    if (popupsMuted() || popupsSuppressed()) return true;
    if (call) return true;
    if (isQuietPath(pathname)) return true;
    if (isTypingNow()) return true;
    if (document.visibilityState !== "visible") return true;
    return false;
  }, [call, pacing.enabled, pacing.roamEnabled, pathname]);
  /**
   * الجدولة بسلوك الزائر لا بمؤقّت: الشخصية تظهر عندما **يتوقّف التمرير** ويثبت
   * الزائر على منطقة لمدة `mascotIdleMs` (٢-٣ ثوانٍ افتراضيًا) — لحظة قراءة
   * هادئة، لا مقاطعة. أثناء التمرير لا ظهور، والاستئناف السريع يُنهي المشهد.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // بوابة «أول ٣ ثوانٍ من تحميل الصفحة»: لا ظهور قبل أن تستقرّ الصفحة.
    const settledAt = Date.now() + pacing.pageSettleMs;

    const start = (kind: RoamScene) => {
      // القاعدة الثانية: منطقة آمنة أو لا ظهور. (القياس بعد السكون فقط.)
      const band = findSafeBand(SCENE_WIDTH, SCENE_HEIGHT, {
        topInset: 118,
        bottomInset: 84,
        pad: 14,
      });
      console.debug('[rd] band', JSON.stringify(band));
      if (!band || band.width < SCENE_WIDTH + MIN_TRAVEL) return;
      releaseRef.current = acquireStage(`roam:${kind}`);
      keyRef.current += 1;
      const pool = kind === "stroll" ? STROLL_COPY : SEARCH_COPY;
      const line = pickCopy(pool, lastCopyRef, ar);
      setScene({ key: keyRef.current, kind, copy: line, band });
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(end, pacing.roamDurationMs);
    };

    const run = () => {
      if (Date.now() < settledAt) { console.debug('[rd] settle'); return; }
      if (blockedNow()) { console.debug('[rd] blocked', JSON.stringify({roam:pacing.roamEnabled,en:pacing.enabled,muted:popupsMuted(),sup:popupsSuppressed(),call:!!call,quiet:isQuietPath(pathname),typing:isTypingNow(),vis:document.visibilityState})); return; }
      const kind: RoamScene = Math.random() < 0.5 ? "stroll" : "search";
      // القاعدة الأولى: شخصية واحدة فقط، وفاصل أدنى، ولا تكرار للنوع نفسه.
      if (!canShowMascot(`roam:${kind}`, limits)) {
        const other: RoamScene = kind === "stroll" ? "search" : "stroll";
        if (!canShowMascot(`roam:${other}`, limits)) { console.debug('[rd] limits', JSON.stringify(limits)); return; }
        return start(other);
      }
      start(kind);
    };

    const stop = watchScrollIdle({
      idleMs: pacing.mascotIdleMs,
      onIdle: run,
      // استئناف التمرير بسرعة ⇒ المشهد يختفي بنعومة (لا مطاردة للزائر).
      onScroll: (delta) => {
        if (delta > 24) end();
      },
    });

    // صفحة قصيرة لا تُمرَّر: السكون هنا هو الحالة الأصلية، فيُفحص مرة واحدة بعد
    // استقرار الصفحة + مدة السكون نفسها.
    const quick = window.location.search.includes("roam=now");
    const first = window.setTimeout(run, quick ? 900 : pacing.pageSettleMs + pacing.mascotIdleMs);

    return () => {
      stop();
      window.clearTimeout(first);
      end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ar,
    pacing.roamEnabled,
    pacing.pageSettleMs,
    pacing.mascotIdleMs,
    pacing.roamDurationMs,
    pacing.mascotMinGapMs,
    pacing.mascotMaxPerSession,
    pacing.mascotQuietAfterCloseMs,
  ]);


  // التبويب المخفي: الحركة تتوقّف تمامًا (لا رسم ولا حسابات).
  useEffect(() => {
    const sync = () => setPaused(document.visibilityState !== "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // مغادرة الصفحة أو الكتابة أو مكالمة تُنهي المشهد فورًا.
  useEffect(() => {
    if (scene && isQuietPath(pathname)) end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /**
   * إعادة التحقق المستمر: عدم التغطية شرط لحظي لا قرار مرة واحدة. أي تمرير أو
   * تحميل بطاقة أو تغيير مقاس يجعل الشريط غير آمن ⇒ ينتهي المشهد فورًا.
   */
  useEffect(() => {
    if (!scene) return;
    const check = () => {
      const rect = {
        left: scene.band.left,
        top: scene.band.top,
        width: scene.band.width,
        height: SCENE_HEIGHT,
      };
      if (!areaStillFree(rect, 10)) end();
    };
    const timer = window.setInterval(check, 500);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.key]);

  if (!scene) return null;

  const search = scene.kind === "search";
  const travel = Math.max(0, scene.band.width - SCENE_WIDTH);
  // اتجاه المشي: داخل الشريط الآمن حصرًا — لا يتجاوز حدوده أبدًا.
  const toEnd = search ? !ar : ar;
  const duration = `${Math.max(6, pacing.roamDurationMs / 1000)}s`;

  return (
    <div
      data-kaheel-roam
      data-kaheel-stage="roam"
      aria-hidden={false}
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      <div
        key={scene.key}
        role="status"
        dir="ltr"
        style={{
          position: "absolute",
          left: `${toEnd ? scene.band.left : scene.band.left + travel}px`,
          top: `${scene.band.top}px`,
          width: `${SCENE_WIDTH}px`,
          height: `${SCENE_HEIGHT}px`,
          ["--roam-x" as string]: `${toEnd ? travel : -travel}px`,
          animation: `mascot-roam-x ${duration} linear both, mascot-roam-out 0.5s ease-in ${duration} both`,
          animationPlayState: paused ? "paused" : "running",
        }}
        className="pointer-events-none flex flex-col items-center justify-end gap-1"
      >
        {/* الفقاعة: زجاج بنفسجي شفاف متناسق مع الخلفية — لا مستطيل أبيض. */}
        <span
          dir={ar ? "rtl" : "ltr"}
          className="k-mascot-glass max-w-[10.5rem] rounded-2xl px-2.5 py-1 text-center text-[11px] font-black leading-snug [overflow-wrap:anywhere]"
        >
          {scene.copy}
        </span>
        {/* الجسم: مشي حقيقي بتسلسل الإطارات الأربعة + ارتدادة وميلان خفيفين. */}
        <MascotWalk
          name={search ? "kaheelan" : "kaheel"}
          lang={ar ? "ar" : "en"}
          facing={toEnd ? 1 : -1}
          paused={paused}
          className="h-[68px]"
        />
      </div>
    </div>
  );
}
