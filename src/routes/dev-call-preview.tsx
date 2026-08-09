import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CallCenterContext } from "@/lib/mkt-call-center";
import { CallOverlay } from "@/components/marketplace/CallOverlay";

export const Route = createFileRoute("/dev-call-preview")({
  component: Preview,
});

function Preview() {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    setV(window.location.hash.replace("#", "") || null);
  }, []);
  const incoming = v === "inc";
  const minimized = v === "min";
  const value = {
    call: {
      id: "demo",
      role: "callee" as const,
      status: (incoming ? "ringing" : "connected") as "connected",
      peerName: "أبو محمود للمقاولات",
      peerAvatar: null,
      listingTitle: "صيانة مكيفات — دمشق",
      listingId: null,
      conversationId: null,
      peerUserId: null,
      errorKey: null,
      muted: false,
      speaker: false,
      seconds: 76,
      needsAudioGesture: false,
    },
    placeCall: async () => undefined,
    placeConversationCall: async () => undefined,
    requestCall: async () => false,
    startFromRequest: async () => undefined,
    accept: async () => undefined,
    decline: async () => undefined,
    hangUp: async () => undefined,
    toggleMute: () => undefined,
    toggleSpeaker: () => undefined,
    minimized,
    setMinimized: () => undefined,
    dismiss: () => undefined,
    stopReceiving: async () => undefined,
    starting: false,
  };
  return (
    <CallCenterContext.Provider value={value}>
      <CallOverlay />
    </CallCenterContext.Provider>
  );
}
