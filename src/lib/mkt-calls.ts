/**
 * Free in-platform voice calling (WebRTC).
 *
 * Signalling rides on the existing Supabase realtime + short lived
 * `mkt_call_signals` rows: no phone numbers, no virtual numbers, no recording.
 * A direct peer-to-peer connection is attempted with public STUN only; when NAT
 * or a firewall blocks it (a TURN relay would be needed) the call fails cleanly
 * and the UI asks the user to keep using chat.
 */
import { supabase } from "@/integrations/supabase/client";

export type CallStatus =
  | "requesting"
  | "ringing"
  | "connected"
  | "declined"
  | "no_answer"
  | "busy"
  | "failed"
  | "ended"
  | "cancelled";

export interface CallRow {
  id: string;
  listing_id: string | null;
  conversation_id: string | null;
  caller_user_id: string;
  callee_user_id: string;
  status: CallStatus;
  end_reason: string | null;
  ended_by: string | null;
  requested_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface CallPeer {
  role: "caller" | "callee";
  peer_name: string;
  peer_avatar: string | null;
  listing_title: string | null;
  listing_id: string | null;
  conversation_id: string | null;
  status: CallStatus;
  accepted_at: string | null;
}

/**
 * Per-account availability: calls off, "request a call" only, or open to
 * everyone. Messaging is never affected by this setting.
 */
export type CallMode = "off" | "request" | "direct";

export interface CallEligibility {
  ok: boolean;
  reason?: string;
  mode?: CallMode;
}

export interface CallRequestRow {
  id: string;
  listing_id: string;
  requester_user_id: string;
  status: "open" | "called" | "closed";
  created_at: string;
}

export const RING_TIMEOUT_MS = 40_000;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export async function callEligibility(listingId: string): Promise<CallEligibility> {
  const { data, error } = await supabase.rpc("mkt_call_can_call", { _listing_id: listingId });
  if (error) return { ok: false, reason: "error" };
  return (data as unknown as CallEligibility) ?? { ok: false, reason: "error" };
}


export async function startCall(listingId: string): Promise<{ call_id: string; conversation_id: string }> {
  const { data, error } = await supabase.rpc("mkt_call_start", { _listing_id: listingId });
  if (error) throw error;
  return data as unknown as { call_id: string; conversation_id: string };
}

export async function transitionCall(callId: string, status: CallStatus, reason?: string) {
  const { error } = await supabase.rpc("mkt_call_transition", {
    _call_id: callId,
    _status: status,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw error;
}

export async function loadCallPeer(callId: string): Promise<CallPeer | null> {
  const { data, error } = await supabase.rpc("mkt_call_peer", { _call_id: callId });
  if (error) return null;
  return (data as unknown as CallPeer) ?? null;
}

/** Availability of the account the user is currently working under. */
export async function getCallMode(tenantId: string | null): Promise<CallMode> {
  const query = supabase.from("mkt_call_settings").select("call_mode, tenant_id");
  const { data } = tenantId
    ? await query.eq("tenant_id", tenantId).maybeSingle()
    : await query.is("tenant_id", null).maybeSingle();
  return ((data?.call_mode as CallMode | undefined) ?? "off") satisfies CallMode;
}

/** Server side switch; turning it off also ends any call in flight. */
export async function setCallMode(tenantId: string | null, mode: CallMode) {
  const { error } = await supabase.rpc("mkt_call_mode_set", {
    // The personal account is stored as a NULL tenant; generated types are strict.
    _tenant_id: tenantId as unknown as string,
    _mode: mode,
  });

  if (error) throw error;
}

/** "Request a call" mode: notify the advertiser instead of ringing them. */
export async function createCallRequest(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_call_request_create", {
    _listing_id: listingId,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function listCallRequests(): Promise<CallRequestRow[]> {
  const { data } = await supabase
    .from("mkt_call_requests")
    .select("id, listing_id, requester_user_id, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as CallRequestRow[] | null) ?? [];
}

export async function startCallFromRequest(
  requestId: string,
): Promise<{ call_id: string; conversation_id: string }> {
  const { data, error } = await supabase.rpc("mkt_call_request_start", {
    _request_id: requestId,
  });
  if (error) throw error;
  return data as unknown as { call_id: string; conversation_id: string };
}

export async function closeCallRequest(requestId: string, reason?: string) {
  const { error } = await supabase.rpc("mkt_call_request_close", {
    _request_id: requestId,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw error;
}

/** Always-available kill switch across every account of the signed-in user. */
export async function stopReceivingCalls() {
  const { error } = await supabase.rpc("mkt_call_stop_receiving");
  if (error) throw error;
}

/** Records a missed call (offline/busy/no answer) and notifies the callee. */
export async function markCallMissed(callId: string, reason: "no_answer" | "busy" = "no_answer") {
  const { error } = await supabase.rpc("mkt_call_missed", {
    _call_id: callId,
    _reason: reason,
  });
  if (error) throw error;
}


export async function blockCaller(userId: string, kind: "block" | "mute" = "block") {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("auth_required");
  const { error } = await supabase
    .from("mkt_call_blocks")
    .upsert({ user_id: uid, blocked_user_id: userId, kind }, { onConflict: "user_id,blocked_user_id,kind" });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* WebRTC session                                                      */
/* ------------------------------------------------------------------ */

type SignalKind = "offer" | "answer" | "candidate" | "bye";

export interface CallSessionEvents {
  onState: (state: "connecting" | "connected" | "failed" | "closed") => void;
  onRemoteStream: (stream: MediaStream) => void;
}

/** Manages one audio-only peer connection and its signalling channel. */
export class CallSession {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private lastSignalId = 0;
  private closed = false;

  constructor(
    private readonly callId: string,
    private readonly isCaller: boolean,
    private readonly events: CallSessionEvents,
  ) {}

  /** Requests the microphone; throws so the UI can explain the denial. */
  async prepareMicrophone(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("no_microphone");
    }
    this.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  get localStream() {
    return this.local;
  }

  setMuted(muted: boolean) {
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  async connect() {
    if (!this.local) await this.prepareMicrophone();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;
    this.local?.getTracks().forEach((track) => pc.addTrack(track, this.local!));

    const remote = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0]?.getAudioTracks().forEach((track) => remote.addTrack(track));
      this.events.onRemoteStream(remote);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) void this.send("candidate", event.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      if (pc.connectionState === "connected") this.events.onState("connected");
      else if (pc.connectionState === "failed") this.events.onState("failed");
      else if (pc.connectionState === "closed") this.events.onState("closed");
    };

    this.subscribe();

    if (this.isCaller) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await this.send("offer", { sdp: offer.sdp, type: offer.type });
    }
    this.events.onState("connecting");
  }

  private async send(kind: SignalKind, payload: unknown) {
    if (this.closed) return;
    await supabase
      .from("mkt_call_signals")
      .insert({ call_id: this.callId, kind, payload: payload as never });
  }

  private subscribe() {
    this.channel = supabase
      .channel(`mkt-call-${this.callId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mkt_call_signals",
          filter: `call_id=eq.${this.callId}`,
        },
        (payload) => void this.handleSignal(payload.new as Record<string, unknown>),
      )
      .subscribe();
    void this.drain();
  }

  /** Fetches signals that landed before the realtime channel was ready. */
  private async drain() {
    const { data } = await supabase
      .from("mkt_call_signals")
      .select("id, kind, payload, sender_user_id")
      .eq("call_id", this.callId)
      .order("id", { ascending: true });
    for (const row of data ?? []) await this.handleSignal(row as Record<string, unknown>);
  }

  private async handleSignal(row: Record<string, unknown>) {
    const pc = this.pc;
    if (!pc || this.closed) return;
    const id = Number(row["id"] ?? 0);
    if (id && id <= this.lastSignalId) return;
    const { data: auth } = await supabase.auth.getUser();
    if (row["sender_user_id"] && row["sender_user_id"] === auth.user?.id) {
      this.lastSignalId = Math.max(this.lastSignalId, id);
      return;
    }
    this.lastSignalId = Math.max(this.lastSignalId, id);
    const kind = row["kind"] as SignalKind;
    const payload = row["payload"] as Record<string, unknown>;
    try {
      if (kind === "offer" && !this.isCaller) {
        await pc.setRemoteDescription({ type: "offer", sdp: String(payload["sdp"]) });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.send("answer", { sdp: answer.sdp, type: answer.type });
      } else if (kind === "answer" && this.isCaller) {
        await pc.setRemoteDescription({ type: "answer", sdp: String(payload["sdp"]) });
      } else if (kind === "candidate") {
        await pc.addIceCandidate(payload as RTCIceCandidateInit);
      } else if (kind === "bye") {
        this.events.onState("closed");
      }
    } catch {
      this.events.onState("failed");
    }
  }

  /** Tears everything down and clears this call's signalling rows. */
  async close(notifyPeer = true) {
    if (this.closed) return;
    this.closed = true;
    if (notifyPeer) {
      try {
        await this.send("bye", {});
      } catch {
        /* the call is going away anyway */
      }
    }
    this.local?.getTracks().forEach((track) => track.stop());
    this.pc?.getSenders().forEach((sender) => sender.track?.stop());
    try {
      this.pc?.close();
    } catch {
      /* already closed */
    }
    if (this.channel) await supabase.removeChannel(this.channel);
    await supabase.from("mkt_call_signals").delete().eq("call_id", this.callId);
    this.pc = null;
    this.local = null;
    this.channel = null;
  }
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
