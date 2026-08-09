/**
 * مضيف الشخصية عند اللمس — «تسقط الشخصية، وتُفتح الوجهة».
 *
 * السلوك المعتمد من صاحب المنصة: لا ظهور تلقائي مقتحم. عند لمس المستخدم
 * لعنصر (رابط/زر/وجهة) تسقط الشخصية من أعلى إلى منتصف الشاشة بحركة سقوط
 * وارتداد لطيف، ثم تختفي بنعومة. الوجهة تُفتح في نفس اللحظة — البطاقة لا
 * تعترض الضغطة ولا تؤخّرها أبدًا.
 *
 * ولمزحة الكبس المتكرر: خمس ضغطات سريعة متتالية تُنزل «الزعيم كَحيلان» بمزحة
 * لطيفة عن كثرة الكبس، بتدوير بلا تكرار متتالٍ.
 *
 * ضمانات التصميم:
 *  • `position: fixed` + `pointer-events-none` على الغلاف ⇒ صفر هزّة تخطيط
 *    وصفر اعتراض للتمرير أو الضغط. لا حجب للشاشة ولا قفل تمرير.
 *  • الاستماع في مرحلة الالتقاط بلا `preventDefault` ⇒ الملاحة تكمل طبيعية.
 *  • احترام `prefers-reduced-motion`: ظهور واختفاء ناعم بلا سقوط أو ارتداد.
 *  • بوابات الأدب من `@/lib/popup-pacing`: لا شيء أثناء الكتابة أو مكالمة أو
 *    في المسارات الهادئة، ولا شيء بعد «عدم الإظهار اليوم».
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { EyeOff, X } from "lucide-react";

import { PopupMascot, type MascotKind } from "@/components/marketplace/campaign/PopupMascot";
import { useI18n } from "@/i18n";
import {
  DROP_COOLDOWN_MS,
  DROP_VISIBLE_MS,
  emptyBurst,
  prefersReducedMotion,
  registerTap,
  tapTarget,
} from "@/lib/mascot-tap";
import { useCallCenter } from "@/lib/mkt-call-center";
import {
  isQuietPath,
  isTypingNow,
  mutePopups,
  popupsMuted,
  popupsSuppressed,
  usePopupPacing,
} from "@/lib/popup-pacing";
import {
  popupCopyAt,
  popupCopyCount,
  rapidTapCopyAt,
  rapidTapCopyCount,
} from "@/lib/takeover-copy";

interface DropCard {
  /** مفتاح يجبر إعادة تشغيل الحركة عند كل سقوط. */
  key: number;
  title: string;
  subtitle: string;
  mascot: MascotKind;
  /** مزحة الكبس المتكرر تُقرأ بنبرة مختلفة، فنميّزها للتوثيق فقط. */
  rapid: boolean;
}

export function PromoPopupHost() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const pacing = usePopupPacing();
  const { call } = useCallCenter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [card, setCard] = useState<DropCard | null>(null);
  const [leaving, setLeaving] = useState(false);

  const burstRef = useRef(emptyBurst());
  const lastDropRef = useRef(0);
  const lastCopyRef = useRef(-1);
  const lastRapidRef = useRef(-1);
  const keyRef = useRef(0);
  const hideTimerRef = useRef(0);

  /** بوابات الأدب: أي واحدة منها تمنع المزحة بلا أن تمنع الوجهة. */
  const blocked = useCallback((): boolean => {
    if (!pacing.enabled) return true;
    if (popupsMuted() || popupsSuppressed()) return true;
    if (call) return true;
    if (isQuietPath(pathname)) return true;
    if (isTypingNow()) return true;
    if (document.visibilityState !== "visible") return true;
    return false;
  }, [call, pacing.enabled, pathname]);

  const dismiss = useCallback((mute?: boolean) => {
    window.clearTimeout(hideTimerRef.current);
    if (mute) mutePopups(24);
    setLeaving(true);
    hideTimerRef.current = window.setTimeout(() => {
      setCard(null);
      setLeaving(false);
    }, 220);
  }, []);

  const show = useCallback(
    (rapid: boolean) => {
      keyRef.current += 1;
      let copy;
      if (rapid) {
        const size = rapidTapCopyCount(ar);
        let index = Math.floor(Math.random() * size);
        if (size > 1 && index === lastRapidRef.current) index = (index + 1) % size;
        lastRapidRef.current = index;
        copy = rapidTapCopyAt(ar, index);
      } else {
        const size = popupCopyCount(ar);
        let index = Math.floor(Math.random() * size);
        if (size > 1 && index === lastCopyRef.current) index = (index + 1) % size;
        lastCopyRef.current = index;
        copy = popupCopyAt(ar, index);
      }
      setLeaving(false);
      setCard({ key: keyRef.current, rapid, ...copy });

      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => dismiss(), DROP_VISIBLE_MS);
    },
    [ar, dismiss],
  );

  // الاستماع في مرحلة الالتقاط: نقرأ الحدث فقط، ثم نترك المتصفح يكمل عمله.
  useEffect(() => {
    const onTap = (event: PointerEvent | MouseEvent) => {
      const target = tapTarget(event);
      if (!target) return;
      const now = Date.now();
      const rapid = registerTap(burstRef.current, now);
      if (blocked()) return;
      if (rapid) {
        show(true);
        lastDropRef.current = now;
        return;
      }
      if (now - lastDropRef.current < DROP_COOLDOWN_MS) return;
      lastDropRef.current = now;
      show(false);
    };
    window.addEventListener("pointerdown", onTap, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", onTap, { capture: true });
  }, [blocked, show]);

  // الملاحة إلى وجهة جديدة تُنهي المزحة بهدوء — الشخصية لا تتبع المستخدم.
  useEffect(() => {
    window.clearTimeout(hideTimerRef.current);
    setCard(null);
    setLeaving(false);
  }, [pathname]);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  if (!card) return null;

  const calm = prefersReducedMotion();
  const animation = leaving
    ? "animate-[kaheel-tap-fade_0.22s_ease-in_forwards]"
    : calm
      ? "animate-[kaheel-scrim-in_0.2s_ease-out]"
      : "animate-[kaheel-tap-drop_0.95s_cubic-bezier(0.34,1.56,0.64,1)_both]";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center p-4"
      aria-live="polite"
    >
      <div
        key={card.key}
        data-kaheel-drop-card
        role="status"
        className={`pointer-events-auto relative flex w-full max-w-[15.5rem] flex-col items-center gap-1 rounded-3xl border border-white/60 bg-white/90 p-2.5 pb-3 text-center shadow-[0_18px_44px_rgb(16_0_43/0.22)] backdrop-blur-xl motion-reduce:animate-[kaheel-scrim-in_0.2s_ease-out] ${animation}`}
      >
        <div className="absolute end-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={() => dismiss(true)}
            aria-label={ar ? "عدم الإظهار اليوم" : "Don't show today"}
            className="grid size-6 place-items-center rounded-full bg-[#240046]/10 text-[#3c096c]"
          >
            <EyeOff className="size-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label={ar ? "إغلاق" : "Close"}
            className="grid size-6 place-items-center rounded-full bg-[#240046]/80 text-white"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>

        <PopupMascot kind={card.mascot} />

        <p className="line-clamp-2 text-sm font-black leading-tight text-[#240046]">{card.title}</p>
        <p className="line-clamp-3 text-[11px] font-bold leading-snug text-[#5a189a]">
          {card.subtitle}
        </p>
      </div>
    </div>
  );
}
