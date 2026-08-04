/**
 * "Call" action for an ad. Only rendered when the viewer is signed in, the ad is
 * published, and the advertiser accepts in-platform calls — eligibility is
 * re-checked server side before the call actually starts.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2, PhoneCall } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { callEligibility } from "@/lib/mkt-calls";
import { useCallCenter } from "@/lib/mkt-call-center";
import { Button } from "@/components/ui/button";

interface Props {
  listingId: string;
  className?: string;
}

export function CallButton({ listingId, className }: Props) {
  const { t } = useI18n();
  const { session } = useSession();
  const { placeCall, starting, call } = useCallCenter();

  const eligibility = useQuery({
    queryKey: ["mkt", "call-eligibility", listingId, session?.user.id ?? "anon"],
    enabled: !!session,
    queryFn: () => callEligibility(listingId),
    staleTime: 60_000,
  });

  if (!session || !eligibility.data?.ok) return null;

  const busy = starting || !!call;

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-11 w-full sm:h-10"}
      disabled={busy}
      onClick={() => void placeCall(listingId)}
    >
      {starting ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <PhoneCall className="size-4" aria-hidden />
      )}
      {t("market.call.call")}
    </Button>
  );
}
