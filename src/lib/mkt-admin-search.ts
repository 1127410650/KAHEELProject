import { supabase } from "@/integrations/supabase/client";

/**
 * Unified administrative search.
 *
 * One server function answers for every entity so a limited administrator can
 * never widen their reach through the search box: each group is included only
 * when the caller holds the matching read permission, and sensitive columns
 * (phone, commercial registration) are returned only with `docs.view_sensitive`.
 * Arabic-Indic digits are normalised server-side, so "١٢٣" and "123" match.
 */
export type SearchGroupType =
  | "users"
  | "businesses"
  | "listings"
  | "reports"
  | "verifications";

export interface SearchItem {
  id: string;
  title: string | null;
  subtitle: string | null;
  meta: string | null;
}

export interface SearchGroup {
  type: SearchGroupType;
  count: number;
  items: SearchItem[];
}

export interface AdminSearchResult {
  query: string;
  groups: SearchGroup[];
}

export async function runAdminSearch(query: string, limit = 8): Promise<AdminSearchResult> {
  const term = query.trim();
  if (term.length < 2) return { query: term, groups: [] };
  const { data, error } = await supabase.rpc("mkt_admin_search", { _q: term, _limit: limit });
  if (error) throw error;
  const row = (data ?? {}) as { query?: string; groups?: SearchGroup[] };
  return {
    query: row.query ?? term,
    groups: (row.groups ?? []).filter((group) => group.count > 0),
  };
}

/** In-console destination for a hit — always the same tab, always a real route. */
export function searchHref(type: SearchGroupType, id: string): string {
  switch (type) {
    case "users":
      return `/admin/users/${id}`;
    case "businesses":
      return `/admin/businesses/${id}`;
    case "listings":
      return `/admin/listings/${id}`;
    case "reports":
      return `/admin/reports/${id}`;
    case "verifications":
      return `/admin/verifications/${id}`;
  }
}
