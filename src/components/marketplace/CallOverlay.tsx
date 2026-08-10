/**
 * The single active call, shown as a full-screen call screen.
 *
 * Deliberately minimal per policy: peer avatar/name, state, duration, and only
 * the controls the state allows (accept/decline while ringing, mute, speaker and
 * end while connected). No numbers, no recording controls.
 *
 * The screen can be minimized into a thin always-visible top bar without ending
 * the call — the device back button does the same — and the call itself lives in
 * the root-mounted provider, so it survives navigation between pages.
 *
 * There is no TURN relay, so a call can genuinely fail behind a closed NAT. In
 * that case the screen says so plainly and offers a way out — WhatsApp or a
 * phone call when the advertiser published a number, chat otherwise — instead
 * of leaving the user staring at a stuck "connecting".
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Mic,
  MicOff,
  MessageCircle,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatCallDuration } from "@/lib/mkt-calls";
import { isTerminalCallStatus, useCallCenter } from "@/lib/mkt-call-center";
import { Button } from "@/components/ui/button";

/** Only a phone the advertiser explicitly published is ever returned here. */
function usePublishedFallbackPhone(listingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "call-fallback-phone", listingId],
    enabled: enabled && !!listingId,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data: listing } = await supabase
        .from("mkt_listings")
        .select("owner_user_id")
        .eq("id", listingId!)
        .maybeSingle();
      const owner = listing?.owner_user_id;
      if (!owner) return null;
      const { data } = await supabase.rpc("mkt_public_phone", { _user_id: owner });
      const phone = typeof data === "string" ? data.trim() : "";
      return phone || null;
    },
  });
}

function initial(name: string) {
  const trimmed = name.trim();
  return trimmed ? Array.from(trimmed)[0] : "؟";
}

export function CallOverlay() {
  const { t } = useI18n();
  const {
    call,
    accept,
    decline,
    hangUp,
    toggleMute,
    toggleSpeaker,
    dismiss,
    stopReceiving,
    minimized,
    setMinimized,
  } = useCallCenter();

  // A relay would have been needed: the direct peer-to-peer path was blocked.
  const relayFailed = call?.status === "failed" && call.errorKey === "relay_needed";
  const fallbackPhone = usePublishedFallbackPhone(call?.listingId ?? null, !!relayFailed);

  const live = !!call && !isTerminalCallStatus(call.status);
  const showFull = !!call && !minimized;

  /**
   * The device back button minimizes instead of ending the call: while the
   * full screen is open we hold one history entry and consume the pop.
   */
  useEffect(() => {
    if (!showFull) return;
    window.history.pushState({ kaheelCall: true }, "");
    const onPop = () => setMinimized(true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [showFull, setMinimized]);

  if (!call) return null;

  const ended = isTerminalCallStatus(call.status);
  const incoming = call.role === "callee" && call.status === "ringing";
  const connected = call.status === "connected";
  const needsGesture = incoming && call.needsAudioGesture;
  const phone = relayFailed ? fallbackPhone.data ?? null : null;
  const whatsappHref = phone
    ? `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
        call.listingTitle ?? "",
      )}`
    : null;

  const stateLine = connected ? (
    <span dir="ltr">{formatCallDuration(call.seconds)}</span>
  ) : call.errorKey ? (
    t(`market.call.error.${call.errorKey}`)
  ) : (
    t(`market.call.status.${call.status}`)
  );

  /* ------------------------- minimized top bar ------------------------- */
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label={t("market.call.returnToCall")}
        className="fixed inset-x-0 top-0 z-[70] flex h-9 w-full items-center justify-center gap-2 bg-[linear-gradient(105deg,#10002b,#5a189a_55%,#7b2cbf)] px-3 text-[12px] font-bold text-white shadow-[0_6px_18px_rgb(36_0_70/0.35)]"
      >
        <Phone className="size-3.5 shrink-0" aria-hidden />
        <span className="max-w-[45%] truncate">{call.peerName || t("market.call.title")}</span>
        <span aria-live="polite" className="tabular-nums">
          {stateLine}
        </span>
        <span className="opacity-80">· {t("market.call.returnToCall")}</span>
      </button>
    );
  }

  /* ------------------------- full call screen -------------------------- */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("market.call.title")}
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[radial-gradient(circle_at_22%_-10%,rgb(224_170_255/0.4),transparent_46%),linear-gradient(165deg,#10002b_0%,#3c096c_48%,#5a189a_100%)] text-white animate-fade-in"
    >
      <div className="flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label={t("market.call.minimize")}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/12 px-4 text-[12px] font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <ChevronDown className="size-4" aria-hidden />
          {t("market.call.minimize")}
        </button>
        <p className="text-[11px] font-semibold text-white/70">
          {call.role === "caller" ? t("market.call.outgoing") : t("market.call.incoming")}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <span className="grid size-32 place-items-center overflow-hidden rounded-full border border-white/35 bg-white/12 text-4xl font-black shadow-[0_18px_50px_rgb(16_0_43/0.55)] sm:size-36">
          {call.peerAvatar ? (
            <img
              src={call.peerAvatar}
              alt=""
              width={144}
              height={144}
              className="size-full object-cover"
            />
          ) : (
            initial(call.peerName || "؟")
          )}
        </span>

        <h2 className="max-w-[22ch] text-2xl font-black leading-tight">
          {call.peerName || t("market.call.title")}
        </h2>
        {call.listingTitle && (
          <p className="max-w-[30ch] truncate text-xs text-white/70">{call.listingTitle}</p>
        )}
        <p className="text-base font-semibold text-white/90 tabular-nums" aria-live="polite">
          {stateLine}
        </p>

        {relayFailed && (
          <div className="mt-2 w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-3 text-start backdrop-blur-sm">
            <p className="text-xs">{t("market.call.fallback.title")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {whatsappHref && (
                <Button asChild size="sm" variant="secondary" className="h-9">
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" aria-hidden />
                    {t("market.call.fallback.whatsapp")}
                  </a>
                </Button>
              )}
              {phone && (
                <Button asChild size="sm" variant="secondary" className="h-9">
                  <a href={`tel:${phone}`} dir="ltr">
                    <Phone className="size-4" aria-hidden />
                    {t("market.call.fallback.phone")}
                  </a>
                </Button>
              )}
              <Button asChild size="sm" variant="secondary" className="h-9">
                <Link to="/my/messages" onClick={dismiss}>
                  {t("market.call.fallback.chat")}
                </Link>
              </Button>
            </div>
            {!phone && (
              <p className="mt-2 text-[11px] text-white/70">{t("market.call.fallback.noPhone")}</p>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {incoming && !ended && (
          <div className="mx-auto flex max-w-sm items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => void decline()}
              className="flex flex-col items-center gap-2 text-[12px] font-bold"
            >
              <span className="grid size-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[0_14px_34px_rgb(16_0_43/0.5)] transition active:scale-95">
                <PhoneOff className="size-6" aria-hidden />
              </span>
              {t("market.call.decline")}
            </button>
            <button
              type="button"
              onClick={() => void accept()}
              className="flex flex-col items-center gap-2 text-[12px] font-bold"
            >
              <span className="grid size-16 place-items-center rounded-full bg-[#2f9e6a] text-[#ffffff] shadow-[0_14px_34px_rgb(16_0_43/0.5)] transition active:scale-95">
                <Phone className="size-6" aria-hidden />
              </span>
              {needsGesture ? t("market.call.startAudio") : t("market.call.accept")}
            </button>
          </div>
        )}

        {!incoming && !ended && (
          <div className="mx-auto flex max-w-sm items-center justify-center gap-7">
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={call.muted}
              className="flex flex-col items-center gap-2 text-[12px] font-bold"
            >
              <span
                className={`grid size-14 place-items-center rounded-full border border-white/25 transition active:scale-95 ${
                  call.muted ? "bg-white text-brand-900" : "bg-white/12 text-white"
                }`}
              >
                {call.muted ? (
                  <MicOff className="size-5" aria-hidden />
                ) : (
                  <Mic className="size-5" aria-hidden />
                )}
              </span>
              {call.muted ? t("market.call.unmute") : t("market.call.mute")}
            </button>

            <button
              type="button"
              onClick={() => void hangUp()}
              className="flex flex-col items-center gap-2 text-[12px] font-bold"
            >
              <span className="grid size-[68px] place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[0_16px_40px_rgb(16_0_43/0.55)] transition active:scale-95">
                <PhoneOff className="size-7" aria-hidden />
              </span>
              {t("market.call.hangup")}
            </button>

            <button
              type="button"
              onClick={toggleSpeaker}
              aria-pressed={call.speaker}
              className="flex flex-col items-center gap-2 text-[12px] font-bold"
            >
              <span
                className={`grid size-14 place-items-center rounded-full border border-white/25 transition active:scale-95 ${
                  call.speaker ? "bg-white text-brand-900" : "bg-white/12 text-white"
                }`}
              >
                {call.speaker ? (
                  <Volume2 className="size-5" aria-hidden />
                ) : (
                  <VolumeX className="size-5" aria-hidden />
                )}
              </span>
              {t("market.call.speaker")}
            </button>
          </div>
        )}

        {ended && (
          <div className="mx-auto max-w-sm">
            <Button size="lg" variant="secondary" className="h-12 w-full" onClick={dismiss}>
              {t("common.close")}
            </Button>
          </div>
        )}

        <div className="mt-5 flex flex-col items-center gap-2">
          {live && (
            <button
              type="button"
              className="text-[11px] text-white/70 underline"
              onClick={() => void stopReceiving()}
            >
              {t("market.call.stopReceiving")}
            </button>
          )}
          <p className="text-center text-[11px] text-white/65">{t("market.call.noPhoneHint")}</p>
        </div>
      </div>
    </div>
  );
}
