/**
 * Promo popup host — one light card at a time, on a paced rotation.
 *
 * Mounted once in the root layout so a card can appear anywhere the visitor is
 * browsing, and unmounted content-wise the rest of the time (it renders `null`
 * whenever no card is due, so there is nothing on the page to cost CPU).
 *
 * Zero layout shift by construction: the card is `position: fixed` with
 * `pointer-events-none` on its wrapper, mounts only after hydration, and never
 * participates in document flow. There is no backdrop, no scroll lock, no
 * focus trap — the page stays fully usable underneath.
 *
 * All rhythm and politeness rules live in `@/lib/popup-pacing`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { EyeOff, X } from "lucide-react";

import { PopupMascot, type MascotKind } from "@/components/marketplace/campaign/PopupMascot";
import { useI18n } from "@/i18n";
import { trackCampaign, useLiveCampaigns } from "@/lib/mkt-campaigns";
import { useCallCenter } from "@/lib/mkt-call-center";
import {
  isQuietPath,
  isTypingNow,
  loadPopupSession,
  mutePopups,
  popupsMuted,
  popupsSuppressed,
  savePopupSession,
  usePopupPacing,
  type PopupSessionState,
} from "@/lib/popup-pacing";
import {
  POPUP_SIDES,
  popupCopyAt,
  popupCopyCount,
  type PopupSide,
} from "@/lib/takeover-copy";

/** A close faster than this reads as irritation, not as a decision. */
const QUICK_CLOSE_MS = 2_000;
/** Blocked attempts retry on this cheap cadence instead of polling. */
const RETRY_MS = 20_000;
/** Browsing counts as "active" while the visitor touched the page recently. */
const ACTIVE_WINDOW_MS = 90_000;
/** Drag distance that dismisses the card. */
const SWIPE_PX = 60;

const POSITION: Record<PopupSide, string> = {
  bottom: "inset-x-0 bottom-20 justify-center sm:bottom-6",
  top: "inset-x-0 top-16 justify-center",
  left: "inset-y-0 left-0 items-end justify-start pb-24 sm:items-center sm:pb-0",
  right: "inset-y-0 right-0 items-end justify-end pb-24 sm:items-center sm:pb-0",
};

const ENTER: Record<PopupSide, string> = {
  bottom: "animate-[kaheel-popup-in-bottom_0.42s_cubic-bezier(0.16,1,0.3,1)]",
  top: "animate-[kaheel-popup-in-top_0.42s_cubic-bezier(0.16,1,0.3,1)]",
  left: "animate-[kaheel-popup-in-left_0.42s_cubic-bezier(0.16,1,0.3,1)]",
  right: "animate-[kaheel-popup-in-right_0.42s_cubic-bezier(0.16,1,0.3,1)]",
};

interface CardPlan {
  copyIndex: number;
  mascot: MascotKind;
  side: PopupSide;
  campaignIndex: number;
}

/** Picks the next line/mascot/side, never repeating the previous one. */
function planCard(state: PopupSessionState, ar: boolean): CardPlan {
  const size = popupCopyCount(ar);
  let copyIndex = Math.floor(Math.random() * size);
  if (size > 1 && copyIndex === state.lastCopy) copyIndex = (copyIndex + 1) % size;

  // Keep wording and drawing telling the same joke: when the mascot would repeat
  // back to back, walk the pool for another line instead of swapping the drawing.
  for (let step = 0; step < size; step += 1) {
    const candidate = (copyIndex + step) % size;
    if (candidate === state.lastCopy) continue;
    if (popupCopyAt(ar, candidate).mascot !== state.lastMascot) {
      copyIndex = candidate;
      break;
    }
  }

  const sides = POPUP_SIDES.filter((side) => side !== state.lastSide);
  const side = (sides[Math.floor(Math.random() * sides.length)] ?? "bottom") as PopupSide;

  const mascot: MascotKind = popupCopyAt(ar, copyIndex).mascot;
  return { copyIndex, mascot, side, campaignIndex: state.shown };
}

export function PromoPopupHost() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const pacing = usePopupPacing();
  const { call } = useCallCenter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: campaigns } = useLiveCampaigns("welcome_takeover");

  const [plan, setPlan] = useState<CardPlan | null>(null);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const shownAtRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const pageReadyAtRef = useRef(Date.now());
  const sessionRef = useRef<PopupSessionState>({
    shown: 0,
    lastCopy: -1,
    lastMascot: "",
    lastSide: "",
    quickCloses: 0,
    stopped: false,
  });
  const hydratedRef = useRef(false);

  // localStorage/sessionStorage are only readable after hydration.
  useEffect(() => {
    sessionRef.current = loadPopupSession();
    hydratedRef.current = true;
  }, []);

  // Any page navigation restarts the settle window.
  useEffect(() => {
    pageReadyAtRef.current = Date.now();
  }, [pathname]);

  // Cheap activity signal: passive listeners that only stamp a timestamp.
  useEffect(() => {
    const stamp = () => {
      lastActivityRef.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "scroll", "keydown"];
    events.forEach((event) => window.addEventListener(event, stamp, { passive: true }));
    document.addEventListener("visibilitychange", stamp, { passive: true });
    return () => {
      events.forEach((event) => window.removeEventListener(event, stamp));
      document.removeEventListener("visibilitychange", stamp);
    };
  }, []);

  const blocked = useCallback((): boolean => {
    if (!hydratedRef.current) return true;
    if (!pacing.enabled) return true;
    if (sessionRef.current.stopped) return true;
    if (sessionRef.current.shown >= pacing.maxPerSession) return true;
    if (popupsMuted()) return true;
    if (popupsSuppressed()) return true;
    if (call) return true;
    if (isQuietPath(pathname)) return true;
    if (isTypingNow()) return true;
    if (document.visibilityState !== "visible") return true;
    if (Date.now() - pageReadyAtRef.current < pacing.pageSettleMs) return true;
    if (Date.now() - lastActivityRef.current > ACTIVE_WINDOW_MS) return true;
    return false;
  }, [call, pacing, pathname]);

  // One self-rescheduling timer — no interval, no work while idle.
  useEffect(() => {
    if (plan) return;
    let timer = 0;
    const shown = sessionRef.current.shown;
    const delay = shown === 0 ? pacing.firstDelayMs : pacing.intervalMs;

    const attempt = () => {
      if (blocked()) {
        timer = window.setTimeout(attempt, RETRY_MS);
        return;
      }
      setPlan(planCard(sessionRef.current, ar));
    };

    timer = window.setTimeout(attempt, delay);
    return () => window.clearTimeout(timer);
  }, [plan, pacing, blocked, ar]);

  const campaign = useMemo(() => {
    const list = campaigns ?? [];
    if (!plan || list.length === 0) return undefined;
    return list[plan.campaignIndex % list.length];
  }, [campaigns, plan]);

  // Count the impression once the card is actually on screen.
  useEffect(() => {
    if (!plan) return;
    shownAtRef.current = Date.now();
    const next: PopupSessionState = {
      ...sessionRef.current,
      shown: sessionRef.current.shown + 1,
      lastCopy: plan.copyIndex,
      lastMascot: plan.mascot,
      lastSide: plan.side,
    };
    sessionRef.current = next;
    savePopupSession(next);
    if (campaign) trackCampaign(campaign.id, "impression");
  }, [plan, campaign]);

  const close = useCallback(
    (reason: "user" | "idle" | "click") => {
      if (reason === "user") {
        const fast = Date.now() - shownAtRef.current < QUICK_CLOSE_MS;
        const quickCloses = fast ? sessionRef.current.quickCloses + 1 : 0;
        const next: PopupSessionState = {
          ...sessionRef.current,
          quickCloses,
          // Two impatient closes in a row: stop for the rest of the session.
          stopped: quickCloses >= 2,
        };
        sessionRef.current = next;
        savePopupSession(next);
      }
      setClosing(true);
      setMenuOpen(false);
      window.setTimeout(() => {
        setClosing(false);
        setDrag(0);
        setPlan(null);
      }, 200);
    },
    [],
  );

  // Escape, tap outside and the idle timeout all dismiss the card.
  useEffect(() => {
    if (!plan) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close("user");
    };
    const onPointer = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) close("idle");
    };
    const idle = window.setTimeout(() => close("idle"), pacing.autoDismissMs);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.clearTimeout(idle);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [plan, close, pacing.autoDismissMs]);

  if (!plan) return null;

  const fallback = popupCopyAt(ar, plan.copyIndex);
  const title = (ar ? campaign?.title_ar : campaign?.title_en) || fallback.title;
  const subtitle = (ar ? campaign?.subtitle_ar : campaign?.subtitle_en) || fallback.subtitle;
  const badge = ar ? campaign?.badge_ar : campaign?.badge_en;
  const cta = ar ? campaign?.cta_ar : campaign?.cta_en;
  const href = campaign?.click_url || "/search";
  const side: PopupSide =
    campaign?.popup_side && campaign.popup_side !== "auto"
      ? (campaign.popup_side as PopupSide)
      : plan.side;
  const mascot: MascotKind =
    campaign?.popup_mascot && campaign.popup_mascot !== "auto"
      ? (campaign.popup_mascot as MascotKind)
      : plan.mascot;
  const vertical = side === "top" || side === "bottom";

  // Finger drag: follow the finger, dismiss past the threshold, spring back otherwise.
  let startX = 0;
  let startY = 0;
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX = event.clientX;
    startY = event.clientY;
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return;
    const delta = vertical ? event.clientY - startY : event.clientX - startX;
    setDrag(delta);
  };
  const onPointerUp = () => {
    if (Math.abs(drag) > SWIPE_PX) close("user");
    else setDrag(0);
  };

  return (
    <div
      className={`pointer-events-none fixed z-[80] flex p-3 sm:p-4 ${POSITION[side]}`}
      aria-live="polite"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-label={title}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={
          drag
            ? {
                transform: vertical ? `translateY(${drag}px)` : `translateX(${drag}px)`,
                opacity: Math.max(0.35, 1 - Math.abs(drag) / 220),
                transition: "none",
              }
            : undefined
        }
        className={`pointer-events-auto relative flex w-full max-w-[22rem] touch-pan-y items-center gap-3 rounded-3xl border border-white/60 bg-white/90 p-3 pe-9 shadow-[0_18px_44px_rgb(16_0_43/0.22)] backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none ${
          closing ? "animate-[kaheel-popup-out_0.2s_ease-in_forwards]" : ENTER[side]
        }`}
      >
        <div className="absolute end-2 top-2 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => close("user")}
            aria-label={ar ? "إغلاق" : "Close"}
            className="grid size-7 place-items-center rounded-full bg-[#240046]/80 text-white transition-transform hover:scale-105 motion-reduce:transition-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={ar ? "خيارات الإظهار" : "Display options"}
            aria-expanded={menuOpen}
            className="grid size-7 place-items-center rounded-full bg-[#240046]/10 text-[#3c096c] transition-transform hover:scale-105 motion-reduce:transition-none"
          >
            <EyeOff className="size-3.5" aria-hidden />
          </button>
        </div>

        {menuOpen ? (
          <div className="absolute end-10 top-8 z-10 rounded-2xl border border-white/70 bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                mutePopups(24);
                close("user");
              }}
              className="whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-bold text-[#3c096c] hover:bg-[#f3ecff]"
            >
              {ar ? "عدم الإظهار اليوم" : "Don't show today"}
            </button>
          </div>
        ) : null}

        <PopupMascot kind={mascot} />

        <div className="min-w-0 flex-1 text-start">
          {badge ? (
            <span className="inline-flex rounded-full bg-[#240046] px-2 py-0.5 text-[10px] font-bold text-white">
              {badge}
            </span>
          ) : null}
          <p className="line-clamp-2 text-sm font-black leading-tight text-[#240046]">{title}</p>
          {subtitle ? (
            <p className="line-clamp-2 text-[11px] font-bold leading-snug text-[#5a189a]">
              {subtitle}
            </p>
          ) : null}
          <a
            href={href}
            onClick={() => {
              if (campaign) trackCampaign(campaign.id, "click");
              close("click");
            }}
            className="mt-2 inline-flex min-h-8 items-center justify-center rounded-full bg-[#3c096c] px-4 text-[11px] font-bold text-white shadow-[0_8px_18px_rgb(60_9_108/0.25)]"
          >
            {cta || (ar ? "تصفح الآن" : "Browse now")}
          </a>
        </div>
      </div>
    </div>
  );
}
