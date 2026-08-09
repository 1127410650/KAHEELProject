/**
 * Welcome takeover — the full-screen animated campaign a visitor sees at most
 * once every 24 hours (`kaheel.takeover.lastSeen` in localStorage).
 *
 * It mounts only after hydration and only when a live `welcome_takeover`
 * campaign exists, so it can never shift the first paint. Closing it, opening
 * its offer, Escape and a backdrop tap all mark it as seen.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { CampaignAsset } from "@/components/marketplace/campaign/CampaignAsset";
import { useI18n } from "@/i18n";
import {
  markTakeoverSeen,
  takeoverAllowed,
  trackCampaign,
  useLiveCampaigns,
} from "@/lib/mkt-campaigns";

export function WelcomeTakeover() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const { data } = useLiveCampaigns("welcome_takeover");
  const campaign = allowed ? data?.[0] : undefined;

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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || !campaign) return null;

  const title = ar ? campaign.title_ar : campaign.title_en;
  const subtitle = ar ? campaign.subtitle_ar : campaign.subtitle_en;
  const badge = ar ? campaign.badge_ar : campaign.badge_en;
  const cta = ar ? campaign.cta_ar : campaign.cta_en;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#10002b]/80 p-4 backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-[#c77dff]/40 bg-white shadow-[0_30px_80px_rgb(16_0_43/0.45)] animate-scale-in motion-reduce:animate-none"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={ar ? "إغلاق" : "Close"}
          className="absolute end-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-[#240046]/85 text-white"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
          <CampaignAsset campaign={campaign} eager />
        </div>

        <div className="px-5 pb-5 pt-4 text-center">
          {badge ? (
            <span className="inline-flex rounded-full bg-[#240046] px-3 py-1 text-[10px] font-bold text-white">
              {badge}
            </span>
          ) : null}
          <p className="mt-2 text-lg font-black leading-tight text-[#240046]">{title}</p>
          {subtitle ? (
            <p className="mt-1 text-xs font-bold text-[#5a189a]">{subtitle}</p>
          ) : null}
          <a
            href={campaign.click_url}
            onClick={() => {
              trackCampaign(campaign.id, "click");
              setOpen(false);
            }}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#3c096c] px-6 text-xs font-bold text-white shadow-[0_10px_24px_rgb(60_9_108/0.28)]"
          >
            {cta || (ar ? "تصفح الآن" : "Browse now")}
          </a>
        </div>
      </div>
    </div>
  );
}
