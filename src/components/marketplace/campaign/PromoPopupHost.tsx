/**
 * مضيف الشخصيتين — «تسقط الشخصية، وتُفتح الوجهة».
 *
 * ثلاثة مشاهد فقط، كلها فوق الصفحة بلا حجب وبلا هزّة تخطيط:
 *  ١) **السقوط عند اللمس**: عند لمس المستخدم لعنصر (رابط/زر/وجهة) يهوي
 *     «الزعيم كَحيلان» من الأعلى مائلًا، يرتطم فينضغط عرضًا، يرتد فيستطيل، ثلاث
 *     طبّات متناقصة، ثم يستقر — كلها في 1.05 ثانية. الوجهة تُفتح في نفس اللحظة
 *     بالتوازي: البطاقة لا تعترض الضغطة ولا تؤخّرها أبدًا.
 *  ٢) **مزحة الكبس المتكرر**: ٦ ضغطات خلال ٣ ثوانٍ ⇒ كَحيلان بمزحة «يكفي تكبس!».
 *  ٣) **دخول قسم الناس**: عند فتح القسم يدخل كَحيلان من الجانب بحركة واثقة
 *     ويلف كوفيته، مع فقاعة كلام مرحة تختفي وحدها بعد ٦ ثوانٍ.
 *
 * ضمانات التصميم:
 *  • `position: fixed` + `pointer-events-none` على الغلاف ⇒ صفر هزّة تخطيط
 *    وصفر اعتراض للتمرير أو الضغط. لا حجب للشاشة ولا قفل تمرير.
 *  • الاستماع في مرحلة الالتقاط بلا `preventDefault` ⇒ الملاحة تكمل طبيعية.
 *  • احترام `prefers-reduced-motion`: ظهور واختفاء ناعم بلا سقوط أو ارتداد،
 *    والفتح يبقى فوريًا كما هو.
 *  • كل التوقيتات من `popup_pacing` في لوحة الإدارة عبر `configureMascotTiming`.
 *  • بوابات الأدب من `@/lib/popup-pacing`: لا شيء أثناء الكتابة أو مكالمة أو
 *    في المسارات الهادئة، ولا شيء بعد «عدم الإظهار اليوم».
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { EyeOff, X } from "lucide-react";

import { PopupMascot, type MascotKind } from "@/components/marketplace/campaign/PopupMascot";
import { useI18n } from "@/i18n";
import {
  MASCOT_TIMING,
  configureMascotTiming,
  decideDrop,
  prefersReducedMotion,
  tapTarget,
} from "@/lib/mascot-tap";
import { useCallCenter } from "@/lib/mkt-call-center";
import {
  isPeoplePath,
  isQuietPath,
  isTypingNow,
  mutePopups,
  popupsMuted,
  popupsSuppressed,
  usePopupPacing,
} from "@/lib/popup-pacing";
import {
  bossCopyAt,
  bossCopyCount,
  entranceCopyAt,
  entranceCopyCount,
  rapidTapCopyAt,
  rapidTapCopyCount,
} from "@/lib/takeover-copy";

type CardMode = "drop" | "rapid" | "entrance";

/**
 * بعض اللمسات تفتح الوجهة بتحميل كامل للصفحة (روابط عادية، فتح خارجي، تحديث)،
 * وذلك يمحو حالة React قبل أن تُرى الشخصية. لذلك نُودع مشهد السقوط في
 * `sessionStorage` ونستأنفه على الوجهة الجديدة لما بقي من عمره — فتبقى القاعدة
 * محقّقة: تسقط الشخصية وتُفتح الوجهة في اللحظة نفسها.
 */
const RESUME_KEY = "kaheel.mascot.resume";

interface ResumeRecord {
  title: string;
  subtitle: string;
  mascot: MascotKind;
  mode: CardMode;
  from: "start" | "end";
  /** طابع زمني لنهاية عمر البطاقة. */
  until: number;
}

function readResume(): ResumeRecord | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESUME_KEY);
    const record = JSON.parse(raw) as ResumeRecord;
    if (!record?.title || record.mode === "entrance") return null;
    return record.until > Date.now() ? record : null;
  } catch {
    return null;
  }
}

interface MascotCard {
  /** مفتاح يجبر إعادة تشغيل الحركة عند كل ظهور. */
  key: number;
  title: string;
  subtitle: string;
  mascot: MascotKind;
  mode: CardMode;
  /** جهة الدخول لمشهد قسم الناس. */
  from: "start" | "end";
}

export function PromoPopupHost() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const pacing = usePopupPacing();
  const { call } = useCallCenter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [card, setCard] = useState<MascotCard | null>(null);
  const [leaving, setLeaving] = useState(false);

  const lastCopyRef = useRef(-1);
  const lastRapidRef = useRef(-1);
  const lastEntranceRef = useRef(-1);
  const keyRef = useRef(0);
  /** مؤقّت حركة الخروج فقط — لا يوجد مؤقّت اختفاء تلقائي. */
  const fadeTimerRef = useRef(0);
  /** بطاقة مفتوحة الآن؟ لمنع ظهور بطاقة ثانية فوقها. */
  const openRef = useRef(false);

  // التوقيتات كلها من لوحة الإدارة — تُطبَّق أول ما تصل الإعدادات.
  useEffect(() => {
    configureMascotTiming({
      dropCooldownMs: pacing.dropCooldownMs,
      dropVisibleMs: pacing.dropVisibleMs,
      rapidTaps: pacing.rapidTaps,
      rapidWindowMs: pacing.rapidWindowMs,
      entranceMs: pacing.entranceMs,
    });
  }, [
    pacing.dropCooldownMs,
    pacing.dropVisibleMs,
    pacing.entranceMs,
    pacing.rapidTaps,
    pacing.rapidWindowMs,
  ]);

  /** بوابات الأدب: أي واحدة منها تمنع المزحة بلا أن تمنع الوجهة. */
  const blocked = useCallback((): boolean => {
    if (!pacing.enabled) return true;
    // بطاقة واحدة فقط في الشاشة: ما دامت مفتوحة لا تظهر بطاقة جديدة.
    if (openRef.current) return true;
    if (popupsMuted() || popupsSuppressed()) return true;
    if (call) return true;
    if (isQuietPath(pathname)) return true;
    if (isTypingNow()) return true;
    if (document.visibilityState !== "visible") return true;
    return false;
  }, [call, pacing.enabled, pathname]);

  /**
   * الإغلاق اليدوي حصرًا — لا مؤقّت اختفاء في المنصة إطلاقًا. المؤقّت الوحيد هنا
   * هو زمن حركة الخروج الناعمة (220ms) بعد ضغط المستخدم على الزر.
   */
  const dismiss = useCallback((mute?: boolean) => {
    window.clearTimeout(fadeTimerRef.current);
    if (mute) mutePopups(24);
    openRef.current = false;
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      /* التخزين محجوب: لا شيء لنحذفه. */
    }
    setLeaving(true);
    fadeTimerRef.current = window.setTimeout(() => {
      setCard(null);
      setLeaving(false);
    }, 220);
  }, []);

  /** فهرس جديد بلا تكرار متتالٍ. */
  const rotate = (size: number, last: React.MutableRefObject<number>): number => {
    let index = Math.floor(Math.random() * size);
    if (size > 1 && index === last.current) index = (index + 1) % size;
    last.current = index;
    return index;
  };

  const show = useCallback(
    (mode: CardMode) => {
      keyRef.current += 1;
      let copy;
      if (mode === "rapid") {
        copy = rapidTapCopyAt(ar, rotate(rapidTapCopyCount(ar), lastRapidRef));
      } else if (mode === "entrance") {
        copy = entranceCopyAt(ar, rotate(entranceCopyCount(ar), lastEntranceRef));
      } else {
        copy = bossCopyAt(ar, rotate(bossCopyCount(ar), lastCopyRef));
      }
      window.clearTimeout(fadeTimerRef.current);
      openRef.current = true;
      setLeaving(false);
      setCard({
        key: keyRef.current,
        mode,
        from: Math.random() < 0.5 ? "start" : "end",
        ...copy,
      });

      if (mode !== "entrance") {
        try {
          // نافذة استئناف قصيرة: تخصّ الانتقال الحالي فقط ولا تُعيد بطاقة قديمة
          // بعد ذلك. البطاقة نفسها بعد ظهورها تبقى حتى الإغلاق اليدوي.
          sessionStorage.setItem(
            RESUME_KEY,
            JSON.stringify({ mode, from: "start", ...copy, until: Date.now() + RESUME_WINDOW_MS }),
          );
        } catch {
          /* التخزين ممتلئ أو محجوب: المشهد يبقى داخل الصفحة فقط. */
        }
      }
    },
    [ar],
  );

  // الاستماع في مرحلة الالتقاط: نقرأ الحدث فقط، ثم نترك المتصفح يكمل عمله.
  useEffect(() => {
    const onTap = (event: PointerEvent | MouseEvent) => {
      const target = tapTarget(event);
      if (!target) return;
      if (blocked()) return;
      const { drop, rapid } = decideDrop();
      if (!drop) return;
      show(rapid ? "rapid" : "drop");
    };
    window.addEventListener("pointerdown", onTap, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", onTap, { capture: true });
  }, [blocked, show]);

  /**
   * الملاحة لا تُغلق البطاقة: الإغلاق بزر × حصرًا، فالبطاقة التي ظهرت مع اللمسة
   * تبقى مقروءة على الوجهة الجديدة. لا نُظهر مشهد دخول جديد ما دامت بطاقة مفتوحة.
   */
  useEffect(() => {
    if (!isPeoplePath(pathname)) return;
    if (blocked()) return;
    // تأخير قصير حتى تستقر الصفحة، فالمشهد يدخل على محتوى جاهز لا على فراغ.
    const timer = window.setTimeout(() => {
      if (blocked()) return;
      show("entrance");
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // استئناف مشهد سقوط بدأ قبل تحميل كامل للصفحة — ثم يبقى حتى الإغلاق اليدوي.
  useEffect(() => {
    const record = readResume();
    if (!record || blocked()) return;
    keyRef.current += 1;
    openRef.current = true;
    setCard({ key: keyRef.current, ...record });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => window.clearTimeout(fadeTimerRef.current), []);

  if (!card) return null;

  const calm = prefersReducedMotion();
  const entrance = card.mode === "entrance";

  const animation = leaving
    ? "animate-[kaheel-tap-fade_0.22s_ease-in_forwards]"
    : calm
      ? "animate-[kaheel-scrim-in_0.2s_ease-out]"
      : entrance
        ? `animate-[mascot-enter-${card.from}_0.62s_cubic-bezier(0.2,0.9,0.3,1)_both]`
        : "animate-[mascot-drop_1.05s_cubic-bezier(0.22,0.9,0.3,1)_both]";

  const bodyMotion =
    calm || leaving
      ? ""
      : entrance
        ? "animate-[mascot-scarf-spin_1.1s_ease-in-out_0.5s_1] motion-reduce:animate-none"
        : "animate-[mascot-drop-wobble_1.05s_ease-out_both] motion-reduce:animate-none";

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[80] flex p-4 ${
        entrance ? "items-end justify-start pb-24" : "items-center justify-center"
      }`}
      aria-live="polite"
    >
      <div
        key={card.key}
        data-kaheel-drop-card
        role="status"
        style={{ transformOrigin: "bottom center" }}
        className={`pointer-events-none relative flex w-full max-w-[15.5rem] flex-col items-center gap-1 rounded-3xl border border-white/60 bg-white/90 p-2.5 pb-3 text-center shadow-[0_18px_44px_rgb(16_0_43/0.22)] backdrop-blur-xl motion-reduce:animate-[kaheel-scrim-in_0.2s_ease-out] ${animation}`}
      >
        <div className="absolute end-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={() => dismiss(true)}
            aria-label={ar ? "عدم الإظهار اليوم" : "Don't show today"}
            className="pointer-events-auto grid size-6 place-items-center rounded-full bg-[#240046]/10 text-[#3c096c]"
          >
            <EyeOff className="size-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label={ar ? "إغلاق" : "Close"}
            className="pointer-events-auto grid size-6 place-items-center rounded-full bg-[#240046]/80 text-white"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>

        <div className={bodyMotion}>
          <PopupMascot kind={card.mascot} lang={ar ? "ar" : "en"} />
        </div>

        <p className="line-clamp-2 text-sm font-black leading-tight text-[#240046]">{card.title}</p>
        <p className="line-clamp-3 text-[11px] font-bold leading-snug text-[#5a189a]">
          {card.subtitle}
        </p>
      </div>
    </div>
  );
}
