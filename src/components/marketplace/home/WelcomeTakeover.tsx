/**
 * Welcome popup — a compact ad card a visitor sees at most once every 24 hours
 * (`kaheel.takeover.lastSeen` in localStorage).
 *
 * Deliberately *not* a full-screen takeover: there is no blocking overlay, the
 * page stays scrollable and clickable, and the card slides in from one side
 * (random, or fixed per campaign via `popup_side`), auto-dismisses after a few
 * seconds and closes on Escape, on the close button, or on any tap outside it.
 * It mounts only after hydration, so it can never shift the first paint.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { PopupMascot, type MascotKind } from "@/components/marketplace/campaign/PopupMascot";
import { useI18n } from "@/i18n";
import {
  markTakeoverSeen,
  takeoverAllowed,
  trackCampaign,
  useLiveCampaigns,
} from "@/lib/mkt-campaigns";
import { pickPopupCopy, pickPopupSide, type PopupSide } from "@/lib/takeover-copy";

/** How long the card lingers when the visitor ignores it. */
const AUTO_DISMISS_MS = 7000;

const POSITION: Record<PopupSide, string> = {
  bottom: "inset-x-0 bottom-20 justify-center sm:bottom-6",
  top: "inset-x-0 top-4 justify-center",
  left: "inset-y-0 left-0 items-end justify-start pb-24 sm:items-center sm:pb-0",
  right: "inset-y-0 right-0 items-end justify-end pb-24 sm:items-center sm:pb-0",
};

const ENTER: Record<PopupSide, string> = {
  bottom: "animate-[kaheel-popup-in-bottom_0.34s_ease-out]",
  top: "animate-[kaheel-popup-in-top_0.34s_ease-out]",
  left: "animate-[kaheel-popup-in-left_0.34s_ease-out]",
  right: "animate-[kaheel-popup-in-right_0.34s_ease-out]",
};

export function WelcomeTakeover() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data } = useLiveCampaigns("welcome_takeover");
  const campaign = allowed ? data?.[0] : undefined;
  const fallback = useMemo(() => pickPopupCopy(ar), [ar]);
  const randomSide = useMemo(() => pickPopupSide(), []);

  // Read the cooldown after hydration only: localStorage is not available on SSR.
  useEffect(() => {
    setAllowed(takeoverAllowed());
  }, []);

  useEffect(() => {
    if (!campaign) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      markTakeoverSeen();
      trackCampaign(campaign.id, "impression");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [campaign]);

  // Play the exit animation, then unmount.
  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  // Escape, outside tap and the idle timeout all dismiss it. No overlay is used,
  // so "outside" is a plain document listener and the page stays usable.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) close();
    };
    const idle = window.setTimeout(close, AUTO_DISMISS_MS);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.clearTimeout(idle);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  if (!open || !campaign) return null;

  const title = (ar ? campaign.title_ar : campaign.title_en) || fallback.title;
  const subtitle = (ar ? campaign.subtitle_ar : campaign.subtitle_en) || fallback.subtitle;
  const badge = ar ? campaign.badge_ar : campaign.badge_en;
  const cta = ar ? campaign.cta_ar : campaign.cta_en;
  const side: PopupSide =
    campaign.popup_side && campaign.popup_side !== "auto"
      ? (campaign.popup_side as PopupSide)
      : randomSide;
  const mascot: MascotKind =
    campaign.popup_mascot && campaign.popup_mascot !== "auto"
      ? (campaign.popup_mascot as MascotKind)
      : fallback.mascot;

  return (
    <div
      className={`pointer-events-none fixed z-[80] flex p-3 sm:p-4 ${POSITION[side]}`}
      aria-live="polite"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-label={title}
        className={`pointer-events-auto relative flex w-full max-w-[22rem] items-center gap-3 rounded-3xl border border-white/60 bg-white/90 p-3 pe-9 shadow-[0_18px_44px_rgb(16_0_43/0.22)] backdrop-blur-xl motion-reduce:animate-none ${
          closing ? "animate-[kaheel-popup-out_0.2s_ease-in_forwards]" : ENTER[side]
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label={ar ? "إغلاق" : "Close"}
          className="absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-[#240046]/80 text-white transition-transform hover:scale-105 motion-reduce:transition-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>

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
            href={campaign.click_url}
            onClick={() => {
              trackCampaign(campaign.id, "click");
              close();
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
