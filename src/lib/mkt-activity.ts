import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { loadListings } from "@/lib/mkt-queries";
import type { ListingCardData } from "@/components/marketplace/ListingCard";

/**
 * A deliberately small, market-only activity trail used for one purpose:
 * suggesting ads. Only the event kind plus a category / ad / city id and a
 * trimmed search term are stored — never a phone number, e-mail, message or
 * precise location. Rows are readable by their owner only (RLS), pruned to the
 * last 90 days and capped at 300 events by database triggers.
 */
export type MktActivityEvent = "search" | "view_ad" | "favorite" | "open_category";

export interface MktActivityInput {
  event: MktActivityEvent;
  adId?: string | null | undefined;
  categoryId?: string | null | undefined;
  searchQuery?: string | null | undefined;
  cityId?: string | null | undefined;
}

/**
 * Fire-and-forget: a failure to log must never affect browsing. Guests are
 * skipped entirely, and so are users who turned personalisation off.
 */
export async function logMarketActivity(input: MktActivityInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return;

    const { data: prefs } = await supabase
      .from("mkt_user_profiles")
      .select("personalize_suggestions")
      .eq("user_id", userId)
      .maybeSingle();
    if (prefs && prefs.personalize_suggestions === false) return;

    await supabase.from("mkt_user_activity").insert({
      user_id: userId,
      event_type: input.event,
      ad_id: input.adId ?? null,
      category_id: input.categoryId ?? null,
      search_query: input.searchQuery?.slice(0, 80) ?? null,
      city_id: input.cityId ?? null,
    });
  } catch {
    // Personalisation is optional; silence is the correct behaviour here.
  }
}

/** Convenience wrapper for call sites that must not await. */
export function trackMarketActivity(input: MktActivityInput): void {
  void logMarketActivity(input);
}

/**
 * "Suggested for you": the categories the visitor interacted with most in the
 * recent past, restricted to their market. Returns an empty list when there is
 * no usable history, so the section simply does not render.
 */
export function useSuggestedListings(
  locale: "ar" | "en",
  geo: { countryIso2: string; cityId?: string | undefined },
) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ["mkt", "home", "suggested", userId, locale, geo.countryIso2, geo.cityId ?? "all"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<ListingCardData[]> => {
      const { data } = await supabase
        .from("mkt_user_activity")
        .select("event_type, category_id, ad_id, created_at")
        .order("created_at", { ascending: false })
        .limit(60);

      const rows = data ?? [];
      if (rows.length === 0) return [];

      // Weight recent, higher-intent signals more strongly.
      const weight: Record<string, number> = {
        favorite: 4,
        view_ad: 3,
        open_category: 2,
        search: 1,
      };
      const scores = new Map<string, number>();
      for (const r of rows) {
        const categoryId = r.category_id as string | null;
        if (!categoryId) continue;
        const w = weight[r.event_type as string] ?? 1;
        scores.set(categoryId, (scores.get(categoryId) ?? 0) + w);
      }

      const topCategories = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
      if (topCategories.length === 0) return [];

      const seenAdIds = new Set(
        rows
          .filter((r) => r.event_type === "view_ad")
          .map((r) => r.ad_id as string | null)
          .filter((v): v is string => !!v),
      );

      const listings = await loadListings(
        { ...geo, categoryIds: topCategories, limit: 12 },
        locale,
      );
      const fresh = listings.filter((l) => !seenAdIds.has(l.id));
      return (fresh.length >= 4 ? fresh : listings).slice(0, 8);
    },
  });
}
