/**
 * مضيف الشخصيتين — «تسقط الشخصية، وتُفتح الوجهة».
 *
 * أربعة مشاهد فقط، كلها فوق الصفحة بلا حجب وبلا هزّة تخطيط:
 *  ١) **السقوط عند اللمس**: عند لمس المستخدم لعنصر (رابط/زر/وجهة) يهوي
 *     «الزعيم كَحيلان» من الأعلى مائلًا، يرتطم فينضغط عرضًا، يرتد فيستطيل، ثلاث
 *     طبّات متناقصة، ثم يستقر — كلها في 1.05 ثانية. الوجهة تُفتح في نفس اللحظة
 *     بالتوازي: البطاقة لا تعترض الضغطة ولا تؤخّرها أبدًا.
 *  ٢) **مزحة الكبس المتكرر**: ٦ ضغطات خلال ٣ ثوانٍ ⇒ كَحيلان بمزحة «يكفي تكبس!».
 *  ٣) **دخول قسم الناس**: عند فتح القسم يدخل كَحيلان من الجانب بحركة واثقة
 *     ويلف كوفيته، مع فقاعة كلام مرحة.
 *  ٤) **الإطلالة**: بين حين وآخر يطلّ كَحيلان **برأسه وكتفه فقط** من حافة الشاشة
 *     (يمين/يسار/أسفل) كأنه يختلس النظر — بلا بطاقة كاملة، فقاعة كلام قصيرة فقط.
 *
 * ## جهة الظهور تتنوّع — لا من الأعلى فقط
 *  • كل ظهور يختار جهة عشوائية من خمس: أسفل، أعلى، يمين، يسار، الزاوية السفلية.
 *  • لا تتكرّر الجهة نفسها مرتين متتاليتين (`nextEntrySide` يحفظ الأخيرة).
 *  • لكل جهة دخول بـ spring خفيف وخروج **بنفس الاتجاه** عند الإغلاق.
 *  • جهة الإطلالة تتنوّع كذلك بنفس القاعدة (`nextPeekSide`).
 *
 * ## الإغلاق اليدوي حصرًا
 *  • **لا مؤقّت اختفاء إطلاقًا**: البطاقة تبقى ظاهرة حتى يضغط المستخدم زر × .
 *  • لا تُغلق بالضغط خارجها ولا بالتمرير ولا بالملاحة ولا بأي تفاعل آخر.
 *  • زر × كبير (36px) وموضعه ثابت أعلى البطاقة، وبجانبه «عدم الإظهار» (٢٤ ساعة).
 *  • مشهد واحد فقط: لا يظهر شيء جديد ما دام واحد مفتوحًا (`openRef`) — والإطلالة
 *    تخضع لنفس القاعدة، فلا تظهر فوق بطاقة.
 *
 * ضمانات التصميم:
 *  • `position: fixed` + `pointer-events-none` على الغلاف ⇒ صفر هزّة تخطيط
 *    وصفر اعتراض للتمرير أو الضغط. لا حجب للشاشة ولا قفل تمرير.
 *  • الاستماع في مرحلة الالتقاط بلا `preventDefault` ⇒ الملاحة تكمل طبيعية.
 *  • احترام `prefers-reduced-motion`: ظهور واختفاء ناعم بلا سقوط أو ارتداد،
 *    والفتح يبقى فوريًا كما هو.
 *  • بوابات الأدب من `@/lib/popup-pacing`: لا شيء أثناء الكتابة أو مكالمة أو
 *    في المسارات الهادئة، ولا شيء بعد «عدم الإظهار اليوم».
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { EyeOff, X } from "lucide-react";

import { MascotPeek } from "@/components/marketplace/campaign/MascotPeek";
import { PopupMascot, type MascotKind } from "@/components/marketplace/campaign/PopupMascot";
import { useI18n } from "@/i18n";
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
  ENTRY_ANIMATION,
  PEEK_LAYOUT,
  nextEntrySide,
  nextPeekSide,
  type EntrySide,
  type PeekSide,
} from "@/lib/mascot-entry";

import {
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
  peekCopyAt,
  peekCopyCount,
  rapidTapCopyAt,
  rapidTapCopyCount,
} from "@/lib/takeover-copy";

type CardMode = "drop" | "rapid" | "entrance" | "peek";

/** كم من مشاهد اللمس تكون إطلالة رأس بدلًا من بطاقة كاملة. */
const PEEK_SHARE = 0.35;

/**
 * بعض اللمسات تفتح الوجهة بتحميل كامل للصفحة (روابط عادية، فتح خارجي، تحديث)،
 * وذلك يمحو حالة React قبل أن تُرى الشخصية. لذلك نُودع مشهد السقوط في
 * `sessionStorage` ونستأنفه على الوجهة الجديدة لما بقي من عمره — فتبقى القاعدة
 * محقّقة: تسقط الشخصية وتُفتح الوجهة في اللحظة نفسها.
 */
const RESUME_KEY = "kaheel.mascot.resume";

/**
 * نافذة الاستئناف: تخصّ الانتقال الجاري فقط (٨ ثوانٍ). ليست عمرًا للبطاقة —
 * البطاقة بعد ظهورها تبقى حتى يضغط المستخدم ×.
 */
const RESUME_WINDOW_MS = 8_000;

interface ResumeRecord {
  title: string;
  subtitle: string;
  mascot: MascotKind;
  mode: CardMode;
  from: "start" | "end";
  side: EntrySide;
  peekSide: PeekSide;
  /** طابع زمني لنهاية نافذة الاستئناف. */
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

/** مقاسات المشاهد — تُقاس بها المنطقة الآمنة قبل أي ظهور. */
const CARD_WIDTH = 224;
const CARD_HEIGHT = 208;
const PEEK_WIDTH = 296;
const PEEK_HEIGHT = 152;

/**
 * منطقة آمنة للمشهد أو `null`. النطاق يبتعد عن الهيدر أعلى وعن شريط التنقل
 * أسفل، والهامش من كل عنصر محتوى ١٤px — إن لم توجد مساحة فلا ظهور إطلاقًا.
 */
function safeBandFor(mode: CardMode): SafeBand | null {
  const peek = mode === "peek";
  return findSafeBand(peek ? PEEK_WIDTH : CARD_WIDTH, peek ? PEEK_HEIGHT : CARD_HEIGHT, {
    topInset: 118,
    bottomInset: 84,
    pad: 14,
  });
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
  /** جهة ظهور البطاقة الكاملة — تُستخدم لحركة الدخول والخروج. */
  side: EntrySide;
  /** حافة الإطلالة لمشهد «يطلّ برأسه». */
  peekSide: PeekSide;
  /** الموضع الآمن المقاس لحظة الظهور. */
  band: SafeBand;
  /** سطوع المكان لحظة الظهور — يحدّد لون النص العائم وظلّه. */
  tone: AreaTone;
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
  const lastPeekRef = useRef(-1);
  const keyRef = useRef(0);
  /** مؤقّت حركة الخروج فقط — لا يوجد مؤقّت اختفاء تلقائي. */
  const fadeTimerRef = useRef(0);
  /** مشهد مفتوح الآن؟ لمنع ظهور ثانٍ فوقه. */
  const openRef = useRef(false);
  /** الإفراج عن «مسرح الشخصيات» — شخصية واحدة فقط في كل لحظة. */
  const releaseRef = useRef<((closed?: boolean) => void) | null>(null);

  /** حدود التكرار المعتمدة من لوحة الإدارة. */
  const limits = {
    minGapMs: pacing.mascotMinGapMs,
    maxPerSession: pacing.mascotMaxPerSession,
    quietAfterCloseMs: pacing.mascotQuietAfterCloseMs,
  };


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
    // مشهد واحد فقط في الشاشة: ما دام مفتوحًا لا يظهر مشهد جديد.
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
   * هو زمن حركة الخروج بنفس اتجاه الدخول (260ms) بعد ضغط المستخدم على الزر.
   */
  const dismiss = useCallback((mute?: boolean) => {
    window.clearTimeout(fadeTimerRef.current);
    if (mute) mutePopups(24);
    openRef.current = false;
    // الإفراج عن المسرح مع بدء فترة الصمت الإجبارية بعد الإغلاق.
    releaseRef.current?.(true);
    releaseRef.current = null;
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      /* التخزين محجوب: لا شيء لنحذفه. */
    }
    setLeaving(true);
    fadeTimerRef.current = window.setTimeout(() => {
      setCard(null);
      setLeaving(false);
    }, 260);
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
      // قاعدة «شخصية واحدة وبتكرار قليل»: المسرح يقرّر، لا المشهد.
      if (!canShowMascot(`card:${mode}`, limits)) return;
      // قاعدة «لا تغطية»: مساحة آمنة أو لا ظهور.
      const band = safeBandFor(mode);
      if (!band) return;
      const boxHeight = mode === "peek" ? PEEK_HEIGHT : CARD_HEIGHT;
      const boxWidth = mode === "peek" ? PEEK_WIDTH : CARD_WIDTH;
      const box = {
        left: band.left + Math.max(0, (band.width - boxWidth) / 2),
        top: band.top,
        width: boxWidth,
        height: boxHeight,
      };
      // تأكيد لحظي: المنطقة فارغة فعلًا من البطاقات والنصوص، وإلا فلا ظهور.
      if (!areaStillFree(box, 14)) return;
      const tone = sampleAreaTone(box);
      keyRef.current += 1;
      let copy;
      if (mode === "rapid") {
        copy = rapidTapCopyAt(ar, rotate(rapidTapCopyCount(ar), lastRapidRef));
      } else if (mode === "entrance") {
        copy = entranceCopyAt(ar, rotate(entranceCopyCount(ar), lastEntranceRef));
      } else if (mode === "peek") {
        copy = peekCopyAt(ar, rotate(peekCopyCount(ar), lastPeekRef));
      } else {
        copy = bossCopyAt(ar, rotate(bossCopyCount(ar), lastCopyRef));
      }
      window.clearTimeout(fadeTimerRef.current);
      openRef.current = true;
      releaseRef.current = acquireStage(`card:${mode}`);
      setLeaving(false);
      // جهة جديدة في كل ظهور، ولا تتكرّر الجهة السابقة.
      const side = nextEntrySide();
      const peekSide = nextPeekSide();
      setCard({
        key: keyRef.current,
        mode,
        from: Math.random() < 0.5 ? "start" : "end",
        side,
        peekSide,
        band,
        tone,
        ...copy,
      });


      if (mode !== "entrance") {
        try {
          // نافذة استئناف قصيرة: تخصّ الانتقال الحالي فقط ولا تُعيد مشهدًا قديمًا
          // بعد ذلك. المشهد نفسه بعد ظهوره يبقى حتى الإغلاق اليدوي.
          sessionStorage.setItem(
            RESUME_KEY,
            JSON.stringify({
              mode,
              from: "start",
              side,
              peekSide,
              ...copy,
              until: Date.now() + RESUME_WINDOW_MS,
            }),
          );
        } catch {
          /* التخزين ممتلئ أو محجوب: المشهد يبقى داخل الصفحة فقط. */
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ar, pacing.mascotMinGapMs, pacing.mascotMaxPerSession, pacing.mascotQuietAfterCloseMs],

  );

  // الاستماع في مرحلة الالتقاط: نقرأ الحدث فقط، ثم نترك المتصفح يكمل عمله.
  useEffect(() => {
    const onTap = (event: PointerEvent | MouseEvent) => {
      const target = tapTarget(event);
      if (!target) return;
      if (blocked()) return;
      const { drop, rapid } = decideDrop();
      if (!drop) return;
      if (rapid) {
        show("rapid");
        return;
      }
      // بين حين وآخر: إطلالة رأس خفيفة بدل البطاقة الكاملة.
      show(Math.random() < PEEK_SHARE ? "peek" : "drop");
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

  // استئناف مشهد بدأ قبل تحميل كامل للصفحة — في منطقة آمنة فقط، وإلا فلا شيء.
  useEffect(() => {
    const record = readResume();
    if (!record || blocked()) return;
    const band = safeBandFor(record.mode);
    if (!band) return;
    releaseRef.current = acquireStage(`card:${record.mode}`);
    keyRef.current += 1;
    openRef.current = true;
    setCard({
      key: keyRef.current,
      band,
      tone: sampleAreaTone({
        left: band.left,
        top: band.top,
        width: band.width,
        height: record.mode === "peek" ? PEEK_HEIGHT : CARD_HEIGHT,
      }),
      ...record,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * إعادة التحقق أثناء العرض: عدم التغطية شرط لحظي. أي تمرير أو تحميل بطاقة
   * يجعل الموضع غير آمن ⇒ يُغلق المشهد فورًا (الاحتواء أولى من أي تأثير).
   */
  useEffect(() => {
    if (!card) return;
    const height = card.mode === "peek" ? PEEK_HEIGHT : CARD_HEIGHT;
    const width = card.mode === "peek" ? PEEK_WIDTH : CARD_WIDTH;
    const check = () => {
      const left = card.band.left + Math.max(0, (card.band.width - width) / 2);
      if (!areaStillFree({ left, top: card.band.top, width, height }, 8)) dismiss();
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const timer = window.setInterval(check, 700);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.key]);

  useEffect(() => () => window.clearTimeout(fadeTimerRef.current), []);

  if (!card) return null;

  const calm = prefersReducedMotion();


  const closeButtons = (
    <div className="flex gap-[var(--sp-2)]">
      <button
        type="button"
        onClick={() => dismiss(true)}
        aria-label={ar ? "عدم الإظهار اليوم" : "Don't show today"}
        className="pointer-events-auto grid size-6 shrink-0 place-items-center rounded-full bg-brand-950/35 text-white backdrop-blur-sm"
      >
        <EyeOff className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => dismiss()}
        aria-label={ar ? "إغلاق" : "Close"}
        className="pointer-events-auto grid size-7 shrink-0 place-items-center rounded-full bg-brand-950/45 text-white backdrop-blur-sm"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );

  // ── مشهد الإطلالة: رأس وكتف فقط من الحافة، بلا بطاقة كاملة ────────────────
  if (card.mode === "peek") {
    const layout = PEEK_LAYOUT[card.peekSide];
    /**
     * الحركة تُكتب في `style` لا في كلاس: أسماء الحركات تُختار وقت التشغيل،
     * وTailwind لا يولّد كلاسات من نصوص متغيّرة — فالـ inline style هو الطريق
     * الوحيد الذي يضمن عمل كل الجهات فعلًا.
     */
    const peekAnimation = calm
      ? leaving
        ? "kaheel-tap-fade 0.22s ease-in forwards"
        : "kaheel-scrim-in 0.2s ease-out"
      : leaving
        ? `${layout.animation.out} 0.26s ease-in forwards`
        : `${layout.animation.in} 0.6s cubic-bezier(0.2,0.9,0.3,1) both`;

    return (
      <div
        className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
        data-kaheel-stage="peek"
        aria-live="polite"
      >
        <div
          key={card.key}
          data-kaheel-drop-card
          data-kaheel-peek={card.peekSide}
          role="status"
          // dir=ltr على الصفّ فقط: ترتيب الشخصية والفقاعة فيزيائي لا منطقي،
          // فتبقى الإطلالة من نفس الحافة في العربية والإنجليزية على حد سواء.
          dir="ltr"
          style={{
            position: "absolute",
            left: `${card.band.left + Math.max(0, (card.band.width - PEEK_WIDTH) / 2)}px`,
            top: `${card.band.top}px`,
            width: `${PEEK_WIDTH}px`,
            transformOrigin: layout.origin,
            animation: peekAnimation,
          }}
          className={`pointer-events-none flex items-end gap-[var(--sp-2)] ${layout.row}`}
        >
          <MascotPeek lang={ar ? "ar" : "en"} animated={!calm} />
          {/* نص عائم بلا خلفية: اللون والظل يتكيّفان مع سطوع المكان. */}
          <div
            dir={ar ? "rtl" : "ltr"}
            style={floatingTextStyle(card.tone)}
            className="mb-2 max-w-[9.5rem] bg-transparent px-1 text-start min-[360px]:max-w-[11rem]"
          >
            <div className="mb-0.5 flex items-start justify-between gap-2">
              <p className="text-desc font-black leading-snug [overflow-wrap:anywhere]">
                {card.title}
              </p>
              {closeButtons}
            </div>
            <p className="text-desc font-bold leading-snug [overflow-wrap:anywhere]">
              {card.subtitle}
            </p>
          </div>
        </div>
      </div>
    );

  }

  const entrance = card.mode === "entrance";
  const sideMotion = ENTRY_ANIMATION[card.side];

  // نفس السبب: الجهة تُختار وقت التشغيل، فالحركة في `style` لتعمل كل الجهات.
  const animation = leaving
    ? calm
      ? "kaheel-tap-fade 0.22s ease-in forwards"
      : `${sideMotion.out} 0.26s ease-in forwards`
    : calm
      ? "kaheel-scrim-in 0.2s ease-out"
      : entrance
        ? `mascot-enter-${card.from} 0.62s cubic-bezier(0.2,0.9,0.3,1) both`
        : `${sideMotion.in} 0.62s cubic-bezier(0.22,0.9,0.3,1) both`;

  const bodyMotion =
    calm || leaving
      ? ""
      : entrance
        ? "animate-[mascot-scarf-spin_1.1s_ease-in-out_0.5s_1] motion-reduce:animate-none"
        : "animate-[mascot-drop-wobble_1.05s_ease-out_both] motion-reduce:animate-none";

  /**
   * لا بطاقة بيضاء ولا إطار: الشخصية بخلفية شفافة، والنص على لوح زجاجي بنفسجي
   * النص بلا خلفية: لون وظل حروف متكيّفان مع سطوع المكان ⇒ مقروء فوق أي خلفية. الموضع من المنطقة
   * الآمنة المقاسة وقت الظهور فقط، فلا تغطي بطاقة ولا نصًا ولا زرًا. الحاوية
   * `pointer-events-none` وأزرارها وحدها `auto`.
   */
  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      data-kaheel-stage="card"
      aria-live="polite"
    >
      <div
        key={card.key}
        data-kaheel-drop-card
        data-kaheel-side={card.side}
        role="status"
        style={{
          position: "absolute",
          left: `${card.band.left + Math.max(0, (card.band.width - CARD_WIDTH) / 2)}px`,
          top: `${card.band.top}px`,
          width: `${CARD_WIDTH}px`,
          transformOrigin: "bottom center",
          animation,
        }}
        className="pointer-events-none flex max-w-full flex-col items-center gap-1 text-center"
      >
        {/* الشخصية وحدها — خلفية شفافة تمامًا، وزر × صغير أنيق ملاصق لها. */}
        <div className="relative flex min-h-0 w-full shrink justify-center">
          <div className={`min-h-0 max-w-full overflow-hidden ${bodyMotion}`}>
            <PopupMascot kind={card.mascot} lang={ar ? "ar" : "en"} scale="hero" />
          </div>
          <div className="absolute -top-1 end-0 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => dismiss()}
              aria-label={ar ? "إغلاق" : "Close"}
              className="pointer-events-auto grid size-7 place-items-center rounded-full bg-brand-950/90 text-white shadow-[0_4px_12px_rgb(0_0_0/0.3)] backdrop-blur-sm"
            >
              <X className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => dismiss(true)}
              aria-label={ar ? "عدم الإظهار اليوم" : "Don't show today"}
              className="pointer-events-auto grid size-6 place-items-center rounded-full bg-brand-900/85 text-white shadow-[0_3px_10px_rgb(0_0_0/0.18)] backdrop-blur-sm"
            >
              <EyeOff className="size-3" aria-hidden />
            </button>
          </div>
        </div>

        {/* النص تحتها: عائم بلا أي خلفية، بلون وظل متكيّفين مع سطوع المكان. */}
        <div
          style={floatingTextStyle(card.tone)}
          className="w-full shrink-0 bg-transparent px-1"
        >
          <p className="text-body font-black leading-snug [overflow-wrap:anywhere]">
            {card.title}
          </p>
          <p className="text-desc font-semibold leading-snug [overflow-wrap:anywhere]">
            {card.subtitle}
          </p>
        </div>
      </div>
    </div>
  );

}

