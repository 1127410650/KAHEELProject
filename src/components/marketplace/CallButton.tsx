/**
 * "Call" action for an ad. Only rendered when the viewer is signed in, the ad is
 * published, and the advertiser accepts in-platform calls — eligibility is
 * re-checked server side before the call actually starts.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2, PhoneCall } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { callEligibility, conversationCallEligibility } from "@/lib/mkt-calls";
import { useCallCenter } from "@/lib/mkt-call-center";
import { Button } from "@/components/ui/button";

interface Props {
  /** Ad the call is about; omitted when calling from an open conversation. */
  listingId?: string | undefined;
  /**
   * When set, the call rides on the conversation instead of the ad, so both the
   * buyer and the advertiser can ring each other from the chat header.
   */
  conversationId?: string | undefined;
  className?: string;
}

export function CallButton({ listingId, conversationId, className }: Props) {
  const { t } = useI18n();
  const { session } = useSession();
  const { placeCall, placeConversationCall, requestCall, starting, call } = useCallCenter();

  const eligibility = useQuery({
    queryKey: [
      "mkt",
      "call-eligibility",
      conversationId ? `c:${conversationId}` : `l:${listingId}`,
      session?.user.id ?? "anon",
    ],
    enabled: !!session && (!!conversationId || !!listingId),
    queryFn: () =>
      conversationId ? conversationCallEligibility(conversationId) : callEligibility(listingId!),
    staleTime: 60_000,
  });

  // Mode "off" (or any other ineligibility) hides the button entirely; chat and
  // quote requests stay available elsewhere in the actions row.
  if (!session || !eligibility.data?.ok) return null;

  const mode = eligibility.data.mode ?? "direct";
  const busy = starting || !!call;
  // Inside an open thread the two sides already talk, so a call always rings.
  const isRequest = mode === "request" && !conversationId;

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-11 w-full sm:h-10"}
      disabled={busy}
      onClick={() =>
        void (conversationId
          ? placeConversationCall(conversationId)
          : isRequest
            ? requestCall(listingId!)
            : placeCall(listingId!))
      }
    >
      {starting ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <PhoneCall className="size-4" aria-hidden />
      )}
      {isRequest ? t("market.call.requestCall") : t("market.call.call")}
    </Button>
  );
}

