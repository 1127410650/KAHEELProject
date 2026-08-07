/**
 * Compact in-call panel shown above everything else for the single active call.
 *
 * Deliberately minimal per policy: peer name, ad title, state, duration, and
 * only the controls the state allows (accept/decline while ringing, mute and
 * end while connected). No numbers, no recording controls.
 */
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatCallDuration } from "@/lib/mkt-calls";
import { isTerminalCallStatus, useCallCenter } from "@/lib/mkt-call-center";
import { Button } from "@/components/ui/button";

export function CallOverlay() {
  const { t } = useI18n();
  const { call, accept, decline, hangUp, toggleMute, dismiss, stopReceiving } = useCallCenter();

  if (!call) return null;

  const ended = isTerminalCallStatus(call.status);
  const incoming = call.role === "callee" && call.status === "ringing";
  const connected = call.status === "connected";
  const needsGesture = incoming && call.needsAudioGesture;

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
