import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

/**
 * A marketplace account is "set up" once it has an identity (username + display
 * name), an account location (country + city) and a phone number on file. The
 * short setup screen is shown only while something is missing.
 */
export function useMarketSetupStatus() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ["mkt", "setup-status", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: profile }, { data: contact }] = await Promise.all([
        supabase
          .from("mkt_user_profiles")
          .select("username, display_name, country_id, city_id")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("mkt_user_contacts")
          .select("phone_e164")
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);
      const complete =
        !!profile?.username &&
        !!profile?.display_name &&
        !!profile?.country_id &&
        !!profile?.city_id &&
        !!contact?.phone_e164;
      return { complete, needsSetup: !complete };
    },
  });
}
