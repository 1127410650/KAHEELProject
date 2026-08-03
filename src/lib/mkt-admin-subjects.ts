/**
 * Resolves the *identifiers* an admin list needs in order to open a person's
 * administrative file (listing owners, report owners, reporters).
 *
 * The server function `mkt_admin_subject_ids` returns nothing at all unless the
 * caller may view users, and it returns a reporter identifier only to an admin
 * allowed to unmask reporters. No names, emails or phones travel through here —
 * only ids used for internal navigation.
 */
import { supabase } from "@/integrations/supabase/client";

export type AdminSubjectKind = "listing_owner" | "report_owner" | "report_reporter";

export interface AdminSubjectIdRow {
  kind: AdminSubjectKind;
  source_id: string;
  user_id: string;
}

/** Map keyed as `${kind}:${sourceId}` → user id. */
export type AdminSubjectMap = Record<string, string>;

export function subjectKey(kind: AdminSubjectKind, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

export async function loadAdminSubjectIds(input: {
  listingIds?: string[];
  reportIds?: string[];
}): Promise<AdminSubjectMap> {
  const listingIds = Array.from(new Set(input.listingIds ?? [])).filter(Boolean);
  const reportIds = Array.from(new Set(input.reportIds ?? [])).filter(Boolean);
  if (listingIds.length === 0 && reportIds.length === 0) return {};

  const { data, error } = await supabase.rpc("mkt_admin_subject_ids", {
    ...(listingIds.length ? { _listing_ids: listingIds } : {}),
    ...(reportIds.length ? { _report_ids: reportIds } : {}),
  });
  // A limited admin simply gets no ids; that must not break the list.
  if (error) return {};

  const map: AdminSubjectMap = {};
  for (const row of (data ?? []) as AdminSubjectIdRow[]) {
    map[subjectKey(row.kind, row.source_id)] = row.user_id;
  }
  return map;
}
