/**
 * Compact in-call panel shown above everything else for the single active call.
 *
 * Deliberately minimal per policy: peer name, ad title, state, duration, and
 * only the controls the state allows (accept/decline while ringing, mute and
 * end while connected). No numbers, no recording controls.
 *
 * There is no TURN relay, so a call can genuinely fail behind a closed NAT. In
 * that case the panel says so plainly and offers a way out — WhatsApp or a
 * phone call when the advertiser published a number, chat otherwise — instead
 * of leaving the user staring at a stuck "connecting".
 */
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, MessageCircle, Phone, PhoneOff } from "lucide-react";
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

export function CallOverlay() {
  const { t } = useI18n();
  const { call, accept, decline, hangUp, toggleMute, dismiss, stopReceiving } = useCallCenter();

  // A relay would have been needed: the direct peer-to-peer path was blocked.
  const relayFailed = call?.status === "failed" && call.errorKey === "relay_needed";
  const fallbackPhone = usePublishedFallbackPhone(call?.listingId ?? null, !!relayFailed);

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


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("market.call.title")}
      className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-[60] p-3 sm:inset-x-auto sm:end-4 sm:bottom-4 sm:w-80"
    >
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <p className="text-xs text-muted-foreground">
          {call.role === "caller" ? t("market.call.outgoing") : t("market.call.incoming")}
        </p>
        <p className="mt-1 truncate text-base font-semibold text-foreground">
          {call.peerName || t("market.call.title")}
        </p>
        {call.listingTitle && (
          <p className="truncate text-xs text-muted-foreground">{call.listingTitle}</p>
        )}

        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {connected ? (
            <span dir="ltr">{formatCallDuration(call.seconds)}</span>
          ) : call.errorKey ? (
            t(`market.call.error.${call.errorKey}`)
          ) : (
            t(`market.call.status.${call.status}`)
          )}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {incoming && !ended && (
            <>
              <Button size="sm" className="h-10 flex-1" onClick={() => void accept()}>
                <Phone className="size-4" aria-hidden />
                {needsGesture ? t("market.call.startAudio") : t("market.call.accept")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-10 flex-1"
                onClick={() => void decline()}
              >
                {t("market.call.decline")}
              </Button>
            </>
          )}

          {!incoming && !ended && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-10"
                onClick={toggleMute}
                aria-pressed={call.muted}
                aria-label={call.muted ? t("market.call.unmute") : t("market.call.mute")}
              >
                {call.muted ? (
                  <MicOff className="size-4" aria-hidden />
                ) : (
                  <Mic className="size-4" aria-hidden />
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-10 flex-1"
                onClick={() => void hangUp()}
              >
                <PhoneOff className="size-4" aria-hidden /> {t("market.call.hangup")}
              </Button>
            </>
          )}

          {ended && (
            <Button size="sm" variant="outline" className="h-10 flex-1" onClick={dismiss}>
              {t("common.close")}
            </Button>
          )}
        </div>

        {relayFailed && (
          <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-xs text-foreground">{t("market.call.fallback.title")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {whatsappHref && (
                <Button asChild size="sm" variant="outline" className="h-9">
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" aria-hidden />
                    {t("market.call.fallback.whatsapp")}
                  </a>
                </Button>
              )}
              {phone && (
                <Button asChild size="sm" variant="outline" className="h-9">
                  <a href={`tel:${phone}`} dir="ltr">
                    <Phone className="size-4" aria-hidden />
                    {t("market.call.fallback.phone")}
                  </a>
                </Button>
              )}
              <Button asChild size="sm" variant="outline" className="h-9">
                <Link to="/my/messages" onClick={dismiss}>
                  {t("market.call.fallback.chat")}
                </Link>
              </Button>
            </div>
            {!phone && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("market.call.fallback.noPhone")}
              </p>
            )}
          </div>
        )}

        {/* Available in every state: stop new calls and end the current one. */}
        <button
          type="button"
          className="mt-2 text-[11px] text-muted-foreground underline"
          onClick={() => void stopReceiving()}
        >
          {t("market.call.stopReceiving")}
        </button>

        <p className="mt-2 text-[11px] text-muted-foreground">{t("market.call.noPhoneHint")}</p>
      </div>
    </div>
  );
}
