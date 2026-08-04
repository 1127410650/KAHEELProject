/**
 * In-platform voice call center.
 *
 * One provider mounted at the app root owns the single active call: it listens
 * for incoming calls addressed to the signed-in user, drives the WebRTC
 * `CallSession`, and exposes `placeCall` to any surface that wants a call
 * button. Phone numbers are never involved and nothing is recorded — only the
 * call row (parties, times, result) already stored server side.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  CallSession,
  RING_TIMEOUT_MS,
  callEligibility,
  createCallRequest,
  loadCallPeer,
  markCallMissed,
  setCallMode,
  startCall,
  startCallFromRequest,
  transitionCall,
  type CallPeer,
  type CallStatus,
} from "@/lib/mkt-calls";

export type CallRole = "caller" | "callee";

export interface ActiveCall {
  id: string;
  role: CallRole;
  status: CallStatus;
  peerName: string;
  peerAvatar: string | null;
  listingTitle: string | null;
  conversationId: string | null;
  peerUserId: string | null;
  /** Set when the call ended for a reason the user should see. */
  errorKey: string | null;
  muted: boolean;
  /** Seconds since the call was accepted; 0 until then. */
  seconds: number;
  /**
   * True when the browser refused microphone access without a user gesture, so
   * the panel must show an explicit "start audio" button.
   */
  needsAudioGesture: boolean;
}

interface CallCenterValue {
  call: ActiveCall | null;
  /** Places a call for an ad; resolves once ringing starts or fails. */
  placeCall: (listingId: string) => Promise<void>;
  /** Advertiser is in "request" mode: leave a call request instead of ringing. */
  requestCall: (listingId: string) => Promise<boolean>;
  /** Advertiser answers an open request by calling the requester back. */
  startFromRequest: (requestId: string) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangUp: () => Promise<void>;
  toggleMute: () => void;
  dismiss: () => void;
  /** Stops receiving calls right away and ends whatever is live. */
  stopReceiving: () => Promise<void>;
  /** True while a call attempt is being set up (button spinner). */
  starting: boolean;
}


const CallCenterContext = createContext<CallCenterValue | null>(null);

const TERMINAL: CallStatus[] = ["declined", "no_answer", "busy", "failed", "ended", "cancelled"];

function isTerminal(status: CallStatus) {
  return TERMINAL.includes(status);
}

export function CallCenterProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { t } = useI18n();
  const userId = session?.user.id ?? null;

  const [call, setCall] = useState<ActiveCall | null>(null);
  const [starting, setStarting] = useState(false);

  const sessionRef = useRef<CallSession | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  callRef.current = call;

  const clearTimers = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    ringTimer.current = null;
    tickTimer.current = null;
  }, []);

  const teardown = useCallback(
    async (notifyPeer: boolean) => {
      clearTimers();
      const current = sessionRef.current;
      sessionRef.current = null;
      if (current) await current.close(notifyPeer);
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    },
    [clearTimers],
  );

  const finish = useCallback(
    async (status: CallStatus, errorKey: string | null, notifyPeer = true) => {
      await teardown(notifyPeer);
      setCall((prev) => (prev ? { ...prev, status, errorKey, seconds: prev.seconds } : prev));
    },
    [teardown],
  );

  const attachSession = useCallback(
    (callId: string, isCaller: boolean) => {
      const rtc = new CallSession(callId, isCaller, {
        onState: (state) => {
          if (state === "connected") {
            setCall((prev) => (prev ? { ...prev, status: "connected" } : prev));
          } else if (state === "failed") {
            void transitionCall(callId, "failed", "relay_needed").catch(() => undefined);
            void finish("failed", "relay_needed", false);
          } else if (state === "closed") {
            void finish("ended", null, false);
          }
        },
        onRemoteStream: (stream) => {
          if (!audioRef.current) return;
          audioRef.current.srcObject = stream;
          void audioRef.current.play().catch(() => undefined);
        },
      });
      sessionRef.current = rtc;
      return rtc;
    },
    [finish],
  );

  /* --------------------------- incoming calls --------------------------- */
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`mkt-calls-inbox-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mkt_calls",
          filter: `callee_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: CallStatus };
          if (row.status !== "requesting" && row.status !== "ringing") return;
          if (sessionRef.current) {
            // Already on a call on this device: the caller sees a missed call.
            void markCallMissed(row.id, "busy").catch(() => undefined);
            return;
          }
          void (async () => {
            const peer = await loadCallPeer(row.id);
            setCall({
              id: row.id,
              role: "callee",
              status: "ringing",
              peerName: peer?.peer_name ?? "",
              peerAvatar: peer?.peer_avatar ?? null,
              listingTitle: peer?.listing_title ?? null,
              conversationId: peer?.conversation_id ?? null,
              peerUserId: null,
              errorKey: null,
              muted: false,
              seconds: 0,
              needsAudioGesture: false,
            });
            await transitionCall(row.id, "ringing").catch(() => undefined);
            ringTimer.current = setTimeout(() => {
              void markCallMissed(row.id, "no_answer").catch(() => undefined);
              void finish("no_answer", null, false);
            }, RING_TIMEOUT_MS);

            // Direct mode: connect straight away when the microphone permission
            // is already granted, otherwise ask for one tap ("start audio").
            if (await micAlreadyGranted()) void acceptRef.current?.();
            else setCall((prev) => (prev ? { ...prev, needsAudioGesture: true } : prev));
          })();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, finish]);


  /* ------------------- peer-side status changes (both) ------------------ */
  useEffect(() => {
    const callId = call?.id;
    if (!callId || (call && isTerminal(call.status))) return;
    const channel = supabase
      .channel(`mkt-call-row-${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mkt_calls",
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const row = payload.new as { status: CallStatus; end_reason: string | null };
          if (isTerminal(row.status)) {
            clearTimers();
            void finish(row.status, row.end_reason, false);
            return;
          }
          setCall((prev) => (prev ? { ...prev, status: row.status } : prev));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [call?.id, call?.status, clearTimers, finish]);

  /* --------------------------- duration ticker -------------------------- */
  useEffect(() => {
    if (call?.status !== "connected") return;
    tickTimer.current = setInterval(() => {
      setCall((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : prev));
    }, 1000);
    return () => {
      if (tickTimer.current) clearInterval(tickTimer.current);
      tickTimer.current = null;
    };
  }, [call?.status]);

  const placeCall = useCallback(
    async (listingId: string) => {
      if (!userId) {
        toast.error(t("market.call.error.auth_required"));
        return;
      }
      if (sessionRef.current) {
        toast.error(t("market.call.error.busy"));
        return;
      }
      setStarting(true);
      try {
        const eligible = await callEligibility(listingId);
        if (!eligible.ok) {
          toast.error(t(`market.call.error.${eligible.reason ?? "generic"}`));
          return;
        }
        const started = await startCall(listingId);
        const peer = await loadCallPeer(started.call_id);
        setCall({
          id: started.call_id,
          role: "caller",
          status: "requesting",
          peerName: peer?.peer_name ?? "",
          peerAvatar: peer?.peer_avatar ?? null,
          listingTitle: peer?.listing_title ?? null,
          conversationId: started.conversation_id ?? peer?.conversation_id ?? null,
          peerUserId: null,
          errorKey: null,
          muted: false,
          seconds: 0,
        });
        const rtc = attachSession(started.call_id, true);
        try {
          await rtc.prepareMicrophone();
        } catch {
          await transitionCall(started.call_id, "failed", "mic_denied").catch(() => undefined);
          await finish("failed", "mic_denied", false);
          return;
        }
        await rtc.connect();
        ringTimer.current = setTimeout(() => {
          void transitionCall(started.call_id, "no_answer").catch(() => undefined);
          void finish("no_answer", null, true);
        }, RING_TIMEOUT_MS);
      } catch (error) {
        const message = error instanceof Error ? error.message : "generic";
        const key = message.includes("rate") ? "rate_limited" : "generic";
        toast.error(t(`market.call.error.${key}`));
        await teardown(false);
        setCall(null);
      } finally {
        setStarting(false);
      }
    },
    [attachSession, finish, t, teardown, userId],
  );

  const accept = useCallback(async () => {
    const current = call;
    if (!current || current.role !== "callee") return;
    clearTimers();
    const rtc = attachSession(current.id, false);
    try {
      await rtc.prepareMicrophone();
    } catch {
      await transitionCall(current.id, "failed", "mic_denied").catch(() => undefined);
      await finish("failed", "mic_denied", false);
      return;
    }
    await transitionCall(current.id, "connected").catch(() => undefined);
    await rtc.connect();
    setCall((prev) => (prev ? { ...prev, status: "connected", seconds: 0 } : prev));
  }, [attachSession, call, clearTimers, finish]);

  const decline = useCallback(async () => {
    const current = call;
    if (!current) return;
    clearTimers();
    await transitionCall(current.id, "declined").catch(() => undefined);
    await finish("declined", null, true);
  }, [call, clearTimers, finish]);

  const hangUp = useCallback(async () => {
    const current = call;
    if (!current) return;
    clearTimers();
    const next: CallStatus = current.status === "connected" ? "ended" : "cancelled";
    await transitionCall(current.id, next).catch(() => undefined);
    await finish(next, null, true);
  }, [call, clearTimers, finish]);

  const toggleMute = useCallback(() => {
    setCall((prev) => {
      if (!prev) return prev;
      const muted = !prev.muted;
      sessionRef.current?.setMuted(muted);
      return { ...prev, muted };
    });
  }, []);

  const dismiss = useCallback(() => {
    void teardown(false);
    setCall(null);
  }, [teardown]);

  useEffect(
    () => () => {
      void teardown(false);
    },
    [teardown],
  );

  /**
   * Closing/refreshing the tab must not leave a call hanging for the other side:
   * best-effort transition on pagehide, and the every-minute server sweep closes
   * anything the browser could not send in time.
   */
  useEffect(() => {
    const onPageHide = () => {
      const current = callRef.current;
      if (current && !isTerminal(current.status)) {
        const next: CallStatus = current.status === "connected" ? "ended" : "cancelled";
        void transitionCall(current.id, next).catch(() => undefined);
      }
      void teardown(false);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [teardown]);

  const value = useMemo<CallCenterValue>(
    () => ({ call, placeCall, accept, decline, hangUp, toggleMute, dismiss, starting }),
    [accept, call, decline, dismiss, hangUp, placeCall, starting, toggleMute],
  );

  return (
    <CallCenterContext.Provider value={value}>
      {children}
      {/* Remote audio sink: audio only, never rendered as a visible player. */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
    </CallCenterContext.Provider>
  );
}

export function useCallCenter(): CallCenterValue {
  const ctx = useContext(CallCenterContext);
  if (ctx) return ctx;
  // Surfaces rendered outside the provider (e.g. print portal) stay inert.
  return {
    call: null,
    placeCall: async () => undefined,
    accept: async () => undefined,
    decline: async () => undefined,
    hangUp: async () => undefined,
    toggleMute: () => undefined,
    dismiss: () => undefined,
    starting: false,
  };
}

export { isTerminal as isTerminalCallStatus };
