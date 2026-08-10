/**
 * «رفاق كَحيل» — مشهد مشترك واحد على الشاشة، في منطقة فارغة فعلًا، ويُخفى بأي ضغطة.
 *
 * القواعد المعتمدة (صارمة):
 *  • **شخصية رئيسية + رفيق صغير + فقاعة واحدة مشتركة** (`mascot-companions.ts`)،
 *    والضغط على المشهد أو نصّه يفتح القسم المذكور مباشرة.
 *  • **دراسة مكان النزول قبل أي ظهور**: نقيس كل العناصر المرئية
 *    (`getBoundingClientRect`) + فحص حسّي بشبكة نقاط (`elementsFromPoint`)،
 *    ونختار **أكبر منطقة فارغة** تتّسع للمشهد والفقاعة كاملين.
 *    **إن لم توجد مساحة كافية ⇒ لا ظهور إطلاقًا** — يُؤجَّل حتى يتغيّر التمرير.
 *  • **الإغلاق بالضغط في أي مكان**: أي ضغطة على الشاشة تُخفي المشهد فورًا،
 *    **دون استهلاك الضغطة** (البطاقة تُفتح والشخصية تختفي في الوقت نفسه).
 *    التمرير يُخفيه بنعومة أيضًا.
 *  • **صمت ٩٠ ثانية على الأقل** بعد أي إخفاء قبل الظهور التالي (`popup.pacing`).
 *  • شخصية واحدة فقط في أي لحظة (حجز المسرح)، وحد أقصى للجلسة، ولا يتكرّر
 *    المشهد نفسه مرتين متتاليتين.
 *  • الحركة على `transform`/`opacity` فقط (CLS = 0)، تتوقّف مع التبويب المخفي
 *    وتُطفأ كليًا مع `prefers-reduced-motion`.
 *  • لا خلفية للنص: لونه وظلّه يتكيّفان مع سطوع المكان.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";

import { MascotWalk } from "@/components/marketplace/campaign/MascotWalk";
import { useI18n } from "@/i18n";
import { KIDS_FRIEND_ART } from "@/lib/kids-friend-assets";
import { kidsFriendMeta } from "@/lib/kids-friends";
import {
  acquireStage,
  areaStillFree,
  canShowMascot,
  findSafeBand,
  floatingTextStyle,
  sampleAreaTone,
  type AreaTone,
  type SafeBand,
} from "@/lib/mascot-stage";
import {
  COMPANION_SCENES,
  pickCompanionScene,
  type CompanionScene,
} from "@/lib/mascot-companions";

import { useCallCenter } from "@/lib/mkt-call-center";
import { watchScrollIdle } from "@/lib/scroll-idle";
import {
  isQuietPath,
  isTypingNow,
  mutePopups,
  popupsMuted,
  popupsSuppressed,
  usePopupPacing,
} from "@/lib/popup-pacing";

/** مقاس المشهد كاملًا (فقاعة سطرين + شخصية + رفيق) — أساس قياس المنطقة الآمنة. */
const SCENE_WIDTH = 208;
const SCENE_HEIGHT = 150;
/** أدنى مسافة تنقّل تستحق مشهد مشي. */
const MIN_TRAVEL = 40;

interface Scene {
  key: number;
  data: CompanionScene;
  band: SafeBand;
  tone: AreaTone;
}

export function MascotRoam() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const pacing = usePopupPacing();
  const { call } = useCallCenter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [scene, setScene] = useState<Scene | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const keyRef = useRef(0);
  const hideTimer = useRef(0);
  const exitTimer = useRef(0);
  const lastSceneRef = useRef<string | null>(null);
  const releaseRef = useRef<((closed?: boolean) => void) | null>(null);

  const limits = {
    minGapMs: pacing.mascotMinGapMs,
    maxPerSession: pacing.mascotMaxPerSession,
    // فترة الصمت بعد أي إخفاء — لا تقلّ عن ٩٠ ثانية.
    quietAfterCloseMs: Math.max(90_000, pacing.mascotQuietAfterCloseMs),
  };

  /** إخفاء فوري بحركة خروج سريعة + بدء عدّ فترة الصمت. */
  const end = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    releaseRef.current?.(true);
    releaseRef.current = null;
    setLeaving(true);
    window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => {
      setScene(null);
      setLeaving(false);
    }, 200);
  }, []);

  /** بوابات الأدب — أي واحدة تمنع الظهور. */
  const blockedNow = useCallback(() => {
    if (!pacing.roamEnabled || !pacing.enabled) return true;
    if (popupsMuted() || popupsSuppressed()) return true;
    if (call) return true;
    if (isQuietPath(pathname)) return true;
    if (isTypingNow()) return true;
    if (document.visibilityState !== "visible") return true;
    return false;
  }, [call, pacing.enabled, pacing.roamEnabled, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const settledAt = Date.now() + pacing.pageSettleMs;

    const start = (data: CompanionScene) => {
      // دراسة مكان النزول: أكبر منطقة فارغة فعلًا، وإلا فلا ظهور.
      const band = findSafeBand(SCENE_WIDTH, SCENE_HEIGHT, {
        topInset: 118,
        bottomInset: 92,
        pad: 20,
      });
      if (!band || band.width < SCENE_WIDTH + MIN_TRAVEL) return;
      const box = { left: band.left, top: band.top, width: band.width, height: SCENE_HEIGHT };
      if (!areaStillFree(box, 14)) return;
      releaseRef.current = acquireStage(`companion:${data.id}`);
      lastSceneRef.current = data.id;
      keyRef.current += 1;
      setLeaving(false);
      setScene({ key: keyRef.current, data, band, tone: sampleAreaTone(box) });
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(end, pacing.roamDurationMs);
    };

    const run = () => {
      if (Date.now() < settledAt) return;
      if (blockedNow()) return;
      // معاينة/اختبار: `?scene=<id>` يُثبّت مشهدًا محددًا (لا تأثير على الزوار).
      const forced = new URLSearchParams(window.location.search).get("scene");
      const data = forced
        ? (COMPANION_SCENES.find((item) => item.id === forced) ??
           pickCompanionScene(lastSceneRef.current))
        : pickCompanionScene(lastSceneRef.current);
      if (!canShowMascot(`companion:${data.id}`, limits)) return;
      start(data);
    };

    const stop = watchScrollIdle({
      idleMs: pacing.mascotIdleMs,
      onIdle: run,
      onScroll: (delta) => {
        if (delta > 24) end();
      },
    });

    const quick = window.location.search.includes("roam=now");
    const first = window.setTimeout(run, quick ? 900 : pacing.pageSettleMs + pacing.mascotIdleMs);

    return () => {
      stop();
      window.clearTimeout(first);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(exitTimer.current);
      releaseRef.current?.(true);
      releaseRef.current = null;
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

  /**
   * الضغط في أي مكان يُخفي المشهد — **بلا استهلاك الضغطة**: نستمع في مرحلة
   * الالتقاط بلا `preventDefault` ولا `stopPropagation`، فالبطاقة تُفتح كما لو
   * لم تكن الشخصية موجودة، والشخصية تختفي في نفس اللحظة.
   */
  useEffect(() => {
    if (!scene || leaving) return;
    const hide = (event: Event) => {
      // ضغطة على المشهد نفسه: تتولّاها أزراره (تفتح القسم ثم تُخفي).
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-kaheel-stage]")) return;
      end();
    };
    window.addEventListener("pointerdown", hide, { capture: true, passive: true });
    window.addEventListener("touchstart", hide, { capture: true, passive: true });
    window.addEventListener("keydown", hide, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", hide, { capture: true });
      window.removeEventListener("touchstart", hide, { capture: true });
      window.removeEventListener("keydown", hide, { capture: true });
    };
  }, [scene?.key, leaving, end]);

  // التبويب المخفي: الحركة تتوقّف تمامًا.
  useEffect(() => {
    const sync = () => setPaused(document.visibilityState !== "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // مغادرة الصفحة أو مسار هادئ يُنهي المشهد فورًا.
  useEffect(() => {
    if (scene && isQuietPath(pathname)) end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /** عدم التغطية شرط لحظي: أي تغيّر يجعل المكان غير آمن يُنهي المشهد. */
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

  const data = scene.data;
  const search = data.main === "kaheelan";
  const travel = Math.max(0, scene.band.width - SCENE_WIDTH);
  const toEnd = search ? !ar : ar;
  const duration = `${Math.max(6, pacing.roamDurationMs / 1000)}s`;
  const friend = KIDS_FRIEND_ART[data.friend].sm;
  const friendName = kidsFriendMeta(data.friend);
  const textStyle = floatingTextStyle(scene.tone);

  const open = () => {
    end();
    navigate({ to: data.to as never });
  };

  return (
    <div
      data-kaheel-roam
      data-kaheel-stage="companion"
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
          animation: leaving
            ? "mascot-scene-out 0.2s ease-in both"
            : `mascot-roam-x ${duration} linear both, mascot-roam-out 0.5s ease-in ${duration} both`,
          animationPlayState: paused ? "paused" : "running",
        }}
        className="pointer-events-auto flex flex-col items-center justify-end gap-1"
      >
        {/* فقاعة واحدة مشتركة، بلا أي خلفية — والضغط عليها يفتح القسم. */}
        <button
          type="button"
          dir={ar ? "rtl" : "ltr"}
          onClick={open}
          style={textStyle}
          className="max-w-[13rem] bg-transparent px-1 text-center text-[11px] font-black leading-snug [overflow-wrap:anywhere]"
        >
          <span className="block">{ar ? data.hook.ar : data.hook.en}</span>
          <span className="mt-0.5 block text-[10px] font-bold opacity-95">
            {ar ? data.line.ar : data.line.en}
          </span>
        </button>

        <div className="flex w-full items-end justify-center gap-1">
          {/* الرئيسية أكبر — مشي حقيقي بالإطارات الأربعة. */}
          <button
            type="button"
            onClick={open}
            aria-label={ar ? data.line.ar : data.line.en}
            className="block"
          >
            <MascotWalk
              name={data.main}
              lang={ar ? "ar" : "en"}
              facing={toEnd ? 1 : -1}
              paused={paused}
              className="h-[72px]"
            />
          </button>

          {/* الرفيق أصغر بجانبها — نفس الأصول المعتمدة لقسم الأطفال. */}
          <button type="button" onClick={open} className="block" tabIndex={-1}>
            <img
              src={friend.src}
              width={friend.width}
              height={friend.height}
              alt={ar ? friendName.nameAr : friendName.nameEn}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-[42px] w-auto select-none object-contain"
              style={
                paused
                  ? undefined
                  : { animation: "mascot-walk-bob 520ms ease-in-out infinite" }
              }
            />
          </button>
        </div>

        {/* الإغلاق الصريح يبقى: × وعدم الإظهار اليوم. */}
        <div className="flex items-center gap-2 pt-0.5" style={textStyle}>
          <button
            type="button"
            aria-label={ar ? "إغلاق" : "Close"}
            onClick={(event) => {
              event.stopPropagation();
              end();
            }}
            className="grid h-5 w-5 place-items-center rounded-full border border-current/40"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              mutePopups(24);
              end();
            }}
            className="text-[9px] font-bold underline underline-offset-2"
          >
            {ar ? "لا تُظهرها اليوم" : "Not today"}
          </button>
        </div>
      </div>
    </div>
  );
}
