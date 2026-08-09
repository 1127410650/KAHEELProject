/**
 * تجوّل الشخصيتين عبر الصفحات — مشهد خفيف جدًا فوق المحتوى، بلا بطاقة.
 *
 * مشهدان يتبادلان:
 *  • **كَحيل يتمشّى**: يمشي بهدوء عند حافة الشاشة السفلية من جهة لأخرى ثم يخرج،
 *    ومعه أحيانًا ترحيب قصير مؤدّب.
 *  • **كَحيلان عم دوّر على واسطة**: يمشي، يتوقّف، يلتفت يمينًا ويسارًا، يفتل
 *    شاربه، ثم يقول جملته الفكاهية.
 *
 * الضوابط (كلها إلزامية):
 *  • الحركة على `transform` و`opacity` فقط ⇒ لا إعادة تخطيط ولا هزّة (CLS = 0).
 *  • `position: fixed` + `pointer-events-none` على كل شيء ⇒ لا تعطيل للتفاعل.
 *  • `z-30` تحت الهيدر وشريط التنقل (`z-40`)، وحاوية محصورة بين الهيدر والشريط
 *    السفلي مع `overflow-hidden` ⇒ لا تغطية ولا خروج عن الشاشة.
 *  • تتوقّف كليًا عند إخفاء التبويب (`animation-play-state: paused`) وتُطفأ
 *    مع `prefers-reduced-motion` (قاعدة CSS على `[data-kaheel-roam]`).
 *  • بوابات الأدب من `popup-pacing`: لا تجوّل أثناء الكتابة أو محادثة أو مكالمة
 *    أو إتمام طلب، ولا بعد «عدم الإظهار»، ولا فوق بطاقة مفتوحة.
 *  • التوقيتات والتشغيل/الإيقاف من لوحة الإدارة (`popup.pacing`).
 */
import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { Mascot } from "@/components/marketplace/campaign/Mascot";
import { useI18n } from "@/i18n";
import { useCallCenter } from "@/lib/mkt-call-center";
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

export function MascotRoam() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const pacing = usePopupPacing();
  const { call } = useCallCenter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [scene, setScene] = useState<{ key: number; kind: RoamScene; copy: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const keyRef = useRef(0);
  const lastKindRef = useRef<RoamScene>("search");
  const hideTimer = useRef(0);

  /** بوابات الأدب — أي واحدة تمنع التجوّل. */
  const blockedNow = () => {
    if (!pacing.roamEnabled || !pacing.enabled) return true;
    if (popupsMuted() || popupsSuppressed()) return true;
    if (call) return true;
    if (isQuietPath(pathname)) return true;
    if (isTypingNow()) return true;
    if (document.visibilityState !== "visible") return true;
    if (document.querySelector("[data-kaheel-drop-card]")) return true;
    return false;
  };

  // جدولة: أول تجوّل بعد مهلة، ثم واحد كل فاصل. لا يتراكم شيء.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let first = 0;
    let cycle = 0;
    const run = () => {
      if (blockedNow()) return;
      keyRef.current += 1;
      const kind: RoamScene = lastKindRef.current === "stroll" ? "search" : "stroll";
      lastKindRef.current = kind;
      const pool = kind === "stroll" ? STROLL_COPY : SEARCH_COPY;
      const line = pool[Math.floor(Math.random() * pool.length)]!;
      setScene({ key: keyRef.current, kind, copy: ar ? line.ar : line.en });
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setScene(null), pacing.roamDurationMs);
    };

    first = window.setTimeout(() => {
      run();
      cycle = window.setInterval(run, pacing.roamIntervalMs);
    }, pacing.roamFirstDelayMs);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(cycle);
      window.clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ar, pacing.roamEnabled, pacing.roamFirstDelayMs, pacing.roamIntervalMs, pacing.roamDurationMs]);

  // التبويب المخفي: الحركة تتوقّف تمامًا (لا رسم ولا حسابات).
  useEffect(() => {
    const sync = () => setPaused(document.visibilityState !== "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // مغادرة الصفحة إلى مسار هادئ تُنهي المشهد فورًا.
  useEffect(() => {
    if (scene && isQuietPath(pathname)) setScene(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!scene) return null;

  const search = scene.kind === "search";
  // اتجاه المشي: كَحيل من جهة النص، وكَحيلان من الجهة المقابلة — فيبدو تجوّلًا
  // لا مسارًا واحدًا مكرّرًا. المسافة نسبية للشاشة، فلا يخرج عن الحدود أبدًا.
  const toEnd = search ? !ar : ar;
  const duration = `${Math.max(6, pacing.roamDurationMs / 1000)}s`;

  return (
    <div
      data-kaheel-roam
      aria-hidden={false}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] top-[calc(6.9rem+env(safe-area-inset-top))] z-30 overflow-hidden lg:bottom-[calc(1.2rem+env(safe-area-inset-bottom))]"
    >
      <div
        key={scene.key}
        role="status"
        dir="ltr"
        style={{
          // المسافة تُحسب بوحدات العرض: من حافة إلى حافة مع هامش أمان.
          ["--roam-x" as string]: toEnd ? "calc(100vw - 6.5rem)" : "calc(-100vw + 6.5rem)",
          left: toEnd ? "0.75rem" : "auto",
          right: toEnd ? "auto" : "0.75rem",
          animation: `mascot-roam-x ${duration} linear both, mascot-roam-out 0.5s ease-in ${duration} both`,
          animationPlayState: paused ? "paused" : "running",
        }}
        className="pointer-events-none absolute bottom-0 flex w-[5.5rem] flex-col items-center gap-1"
      >
        {/* الفقاعة: نص قصير على لوح زجاجي خفيف خلف النص وحده. */}
        <span
          dir={ar ? "rtl" : "ltr"}
          className="max-w-[9.5rem] rounded-2xl border border-white/60 bg-white/92 px-2.5 py-1 text-center text-[11px] font-black leading-snug text-[#240046] shadow-[0_10px_24px_rgb(16_0_43/0.18)] backdrop-blur-md [overflow-wrap:anywhere]"
        >
          {scene.copy}
        </span>
        {/* الجسم: هزّة خطوة خفيفة، ولكَحيلان التفاتة يمين/يسار وفتل شارب. */}
        <span
          style={{
            animation: search
              ? `mascot-roam-search ${duration} ease-in-out both`
              : `mascot-roam-step 0.9s ease-in-out infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
          className="block h-[68px] w-auto sm:h-[78px]"
        >
          <Mascot
            name={search ? "kaheelan" : "kaheel"}
            pose={search ? "mustache" : "wave"}
            lang={ar ? "ar" : "en"}
            size="sm"
            className="h-full w-auto"
          />
        </span>
      </div>
    </div>
  );
}
