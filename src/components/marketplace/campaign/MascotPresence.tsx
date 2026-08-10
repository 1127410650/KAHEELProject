/**
 * طبقة حضور الشخصيتين — تُركّب مرّة واحدة في `MarketShell`.
 *
 * • `fixed inset-0 z-30 pointer-events-none` ⇒ خارج تدفّق الصفحة تمامًا: صفر هزّة
 *   تخطيط، ولا تلتقط أي لمسة إلا على البطاقة نفسها.
 * • هوامش الأمان (96px أسفل · 160px أعلى) تُبعدها عن شريط التنقل والهيدر.
 * • المؤقّت يتوقّف مع: التبويب المخفي · الكتابة في أي حقل · فتح نافذة/لوحة ·
 *   المسارات الحسّاسة (`/admin/*`، الدخول، الدفع، خيط محادثة).
 * • كل ظهور: مدخل مختلف + موضع مختلف + شخصية مختلفة + عبارة جديدة.
 * • «لا تُظهرها اليوم» تكتم الظهور ٢٤ ساعة (localStorage).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";

import { useI18n } from "@/i18n";
import { mascotAsset } from "@/lib/mascot-assets";
import { acquireStage } from "@/lib/mascot-stage";
import {
  MASCOT_ANCHORS,
  SAFE_BOTTOM_PX,
  SAFE_TOP_PX,
  nextAppearance,
  useMascotPhrases,
  useMascotPresenceSettings,
  type MascotAnchor,
  type MascotAppearance,
} from "@/lib/mascot-presence";
import { isQuietPath, isTypingNow, mutePopups, popupsMuted } from "@/lib/popup-pacing";

/** ارتفاع الرسم على الشاشة — نفس نسبة الأصل، بأبعاد صريحة. */
const ART_H = 108;

/** هل هناك نافذة/لوحة مفتوحة الآن؟ */
function modalOpen(): boolean {
  if (typeof document === "undefined") return false;
  if (document.body.hasAttribute("data-scroll-locked")) return true;
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], [data-state="open"][data-sheet]');
}

function anchorStyle(anchor: MascotAnchor): React.CSSProperties {
  const base: React.CSSProperties = { position: "absolute", maxWidth: "min(320px, 88vw)" };
  switch (anchor) {
    case "bottom-start":
      return { ...base, insetInlineStart: 12, bottom: SAFE_BOTTOM_PX };
    case "bottom-end":
      return { ...base, insetInlineEnd: 12, bottom: SAFE_BOTTOM_PX };
    case "mid-start":
      return { ...base, insetInlineStart: 12, top: `max(${SAFE_TOP_PX}px, 42dvh)` };
    case "mid-end":
    default:
      return { ...base, insetInlineEnd: 12, top: `max(${SAFE_TOP_PX}px, 42dvh)` };
  }
}

export function MascotPresence() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const settings = useMascotPresenceSettings();
  const phrases = useMascotPhrases();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [muted, setMuted] = useState(false);
  const [scene, setScene] = useState<(MascotAppearance & { key: number }) | null>(null);
  const keyRef = useRef(0);
  const hideTimer = useRef(0);
  const releaseRef = useRef<((closed?: boolean) => void) | null>(null);

  useEffect(() => setMuted(popupsMuted()), []);

  const end = useCallback((closed = false) => {
    window.clearTimeout(hideTimer.current);
    releaseRef.current?.(closed);
    releaseRef.current = null;
    setScene(null);
  }, []);

  /** بوابات الأدب — أي واحدة تمنع الظهور وتوقف عدّ المؤقّت. */
  const blocked = useCallback(() => {
    if (!settings.enabled || muted) return true;
    if (isQuietPath(pathname)) return true;
    if (document.visibilityState !== "visible") return true;
    if (isTypingNow() || modalOpen()) return true;
    return false;
  }, [muted, pathname, settings.enabled]);

  // محرّك التوقيت: يعدّ الثواني «النشطة» فقط، ويظهر عند اكتمال الفاصل.
  useEffect(() => {
    if (!settings.enabled || muted) return;
    const pool = phrases.data ?? [];
    if (pool.length === 0) return;

    let active = 0;
    const tick = window.setInterval(() => {
      if (blocked()) return;
      if (scene) return;
      active += 1;
      if (active < settings.intervalSeconds) return;
      active = 0;
      const next = nextAppearance(pool);
      if (!next) return;
      releaseRef.current = acquireStage("presence");
      keyRef.current += 1;
      setScene({ ...next, key: keyRef.current });
      hideTimer.current = window.setTimeout(() => end(false), settings.visibleSeconds * 1000);
    }, 1000);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hideTimer.current);
    };
  }, [blocked, end, muted, phrases.data, scene, settings.enabled, settings.intervalSeconds, settings.visibleSeconds]);

  // إخفاء فوري إن تغيّر المسار أو صار المسار حسّاسًا أو خُفي التبويب.
  useEffect(() => {
    if (scene && blocked()) end(false);
  }, [blocked, end, scene]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "visible") end(false);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [end]);

  useEffect(() => () => releaseRef.current?.(false), []);

  if (!scene || muted) return null;

  const art = mascotAsset(scene.character, "sm");
  const width = Math.round((art.width / art.height) * ART_H);
  const name = scene.character === "kaheel" ? "كَحيل" : "الزعيم كَحيلان";
  const startSide = scene.anchor.endsWith("start");

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-live="polite">
      <div
        key={scene.key}
        data-mascot-presence={scene.entrance}
        data-mascot-anchor={scene.anchor}
        style={anchorStyle(scene.anchor)}
        className={`k-mascot-enter k-mascot-enter-${scene.entrance} pointer-events-auto flex items-end gap-2 ${
          startSide ? "flex-row" : "flex-row-reverse"
        }`}
      >
        <img
          src={art.src}
          width={width}
          height={ART_H}
          alt={ar ? name : scene.character}
          loading="eager"
          decoding="async"
          className="shrink-0 select-none drop-shadow-md"
          style={{ height: ART_H, width }}
        />

        <div className="relative min-w-0 max-w-[210px] rounded-[14px] border border-border bg-card p-3 shadow-md">
          <p className="line-clamp-3 pe-4 text-desc leading-[1.6] text-foreground">
            {scene.phrase.text_ar}
          </p>
          {scene.phrase.link_path ? (
            <button
              type="button"
              className="mt-1 text-nav font-bold text-primary underline-offset-2 hover:underline"
              onClick={() => {
                const path = scene.phrase.link_path as string;
                end(true);
                void navigate({ to: path });
              }}
            >
              {ar ? "خذني هناك" : "Take me there"}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={ar ? "إخفاء" : "Dismiss"}
            onClick={() => end(true)}
            className="absolute end-1 top-1 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              mutePopups(24);
              setMuted(true);
              end(true);
            }}
            className="mt-1 block text-nav text-muted-foreground hover:text-foreground"
          >
            {ar ? "لا تُظهرها اليوم" : "Not today"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MascotPresence;
