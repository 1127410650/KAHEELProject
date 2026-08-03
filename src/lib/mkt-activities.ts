import { supabase } from "@/integrations/supabase/client";

/**
 * Reference activity taxonomy (sectors → main activity → sub activities).
 *
 * Everything here is a thin, typed wrapper around the database: search, the
 * activities linked to one entity, and the admin operations. No activity is
 * ever created silently from the marketplace UI — a user can only *suggest*
 * one, and the platform staff decides.
 */

export interface ActivityGroup {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
  sort_order: number | null;
}

export interface ActivitySearchHit {
  id: string;
  group_id: string;
  group_name_ar: string;
  group_name_en: string | null;
  parent_id: string | null;
  parent_name_ar: string | null;
  name_ar: string;
  name_en: string | null;
  matched_alias: string | null;
  match_kind: string;
  score: number;
}

export interface EntityActivity {
  activity_id: string;
  is_primary: boolean;
  group_id: string;
  group_name_ar: string;
  group_name_en: string | null;
  parent_id: string | null;
  name_ar: string;
  name_en: string | null;
}

export interface AdminActivityRow {
  id: string;
  group_id: string;
  group_name_ar: string;
  parent_id: string | null;
  parent_name_ar: string | null;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
  merged_into_id: string | null;
  alias_count: number;
  entity_count: number;
  child_count: number;
  created_at: string;
}

export interface ActivityAlias {
  id: string;
  activity_id: string;
  alias: string;
  kind: string | null;
  created_at: string;
}

export interface ActivitySuggestion {
  id: string;
  raw_text: string;
  group_id: string | null;
  parent_id: string | null;
  tenant_id: string | null;
  status: string;
  review_note: string | null;
  linked_activity_id: string | null;
  created_at: string;
}

export interface ActivityMerge {
  id: string;
  source_id: string;
  target_id: string;
  moved_links: number | null;
  moved_aliases: number | null;
  moved_children: number | null;
  note: string | null;
  created_at: string;
}

/** Display helper: Arabic is the source of truth, English is optional. */
export function activityName(
  row: { name_ar: string; name_en?: string | null },
  locale: "ar" | "en",
): string {
  return locale === "en" ? row.name_en || row.name_ar : row.name_ar;
}

export async function loadActivityGroups(includeInactive = false): Promise<ActivityGroup[]> {
  let query = supabase
    .from("mkt_activity_groups")
    .select("id, slug, name_ar, name_en, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data } = await query;
  return (data ?? []) as ActivityGroup[];
}

/** Smart search: exact → alias → prefix → fuzzy, already ordered by score. */
export async function searchActivities(input: {
  q: string;
  groupId?: string | null | undefined;
  parentId?: string | null | undefined;
  onlyMain?: boolean | undefined;
  limit?: number | undefined;
}): Promise<ActivitySearchHit[]> {
  const { data, error } = await supabase.rpc("mkt_search_activities", {
    _q: input.q,
    ...(input.groupId ? { _group_id: input.groupId } : {}),
    ...(input.parentId ? { _parent_id: input.parentId } : {}),
    ...(input.onlyMain === undefined ? {} : { _only_main: input.onlyMain }),
    _limit: input.limit ?? 20,
  });
  if (error) throw error;
  return (data ?? []) as ActivitySearchHit[];
}

export async function loadEntityActivities(tenantId: string): Promise<EntityActivity[]> {
  const { data, error } = await supabase.rpc("mkt_entity_activities_list", {
    _tenant_id: tenantId,
  });
  if (error) throw error;
  return (data ?? []) as EntityActivity[];
}

/** Server-side validated: ownership, one main activity, same sector. */
export async function setEntityActivities(input: {
  tenantId: string;
  mainActivityId: string;
  subActivityIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_set_entity_activities", {
    _tenant_id: input.tenantId,
    _main_activity_id: input.mainActivityId,
    _sub_activity_ids: input.subActivityIds,
  });
  if (error) throw error;
}

/** Suggestions go to the admin review queue — never straight into the tree. */
export async function suggestActivity(input: {
  text: string;
  groupId?: string | null | undefined;
  parentId?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_suggest_activity", {
    _raw_text: input.text,
    ...(input.groupId ? { _group_id: input.groupId } : {}),
    ...(input.parentId ? { _parent_id: input.parentId } : {}),
    ...(input.tenantId ? { _tenant_id: input.tenantId } : {}),
  });
  if (error) throw error;
  return String(data ?? "");
}

// ---------------------------------------------------------------- admin side

export async function loadAdminActivities(input?: {
  q?: string | undefined;
  groupId?: string | undefined;
  includeInactive?: boolean | undefined;
  limit?: number | undefined;
}): Promise<AdminActivityRow[]> {
  const { data, error } = await supabase.rpc("mkt_admin_activities", {
    ...(input?.q ? { _q: input.q } : {}),
    ...(input?.groupId ? { _group_id: input.groupId } : {}),
    _include_inactive: input?.includeInactive ?? true,
    _limit: input?.limit ?? 200,
  });
  if (error) throw error;
  return (data ?? []) as AdminActivityRow[];
}

export async function loadAliases(activityIds: string[]): Promise<ActivityAlias[]> {
  if (activityIds.length === 0) return [];
  const { data } = await supabase
    .from("mkt_activity_aliases")
    .select("id, activity_id, alias, kind, created_at")
    .in("activity_id", activityIds)
    .order("created_at", { ascending: false });
  return (data ?? []) as ActivityAlias[];
}

export async function addAlias(activityId: string, alias: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_activity_aliases")
    .insert({ activity_id: activityId, alias: alias.trim(), kind: "synonym" });
  if (error) throw error;
}

export async function removeAlias(id: string): Promise<void> {
  const { error } = await supabase.from("mkt_activity_aliases").delete().eq("id", id);
  if (error) throw error;
}

export async function setActivityActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from("mkt_activities")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw error;
}

export async function loadSuggestions(status?: string): Promise<ActivitySuggestion[]> {
  let query = supabase
    .from("mkt_activity_suggestions")
    .select(
      "id, raw_text, group_id, parent_id, tenant_id, status, review_note, linked_activity_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []) as ActivitySuggestion[];
}

export async function reviewSuggestion(input: {
  id: string;
  decision: "approved" | "rejected" | "merged";
  activityId?: string | undefined;
  note?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_review_activity_suggestion", {
    _suggestion_id: input.id,
    _decision: input.decision,
    ...(input.activityId ? { _activity_id: input.activityId } : {}),
    ...(input.note ? { _note: input.note } : {}),
  });
  if (error) throw error;
}

export async function mergeActivities(input: {
  sourceId: string;
  targetId: string;
  note?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_merge_activities", {
    _source_id: input.sourceId,
    _target_id: input.targetId,
    ...(input.note ? { _note: input.note } : {}),
  });
  if (error) throw error;
}

export async function loadMerges(): Promise<ActivityMerge[]> {
  const { data } = await supabase
    .from("mkt_activity_merges")
    .select("id, source_id, target_id, moved_links, moved_aliases, moved_children, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ActivityMerge[];
}

/** Entities linked to one activity — admin-only read, ids and names only. */
export async function loadActivityEntities(
  activityId: string,
): Promise<{ tenant_id: string; is_primary: boolean; name: string | null }[]> {
  const { data } = await supabase
    .from("mkt_entity_activities")
    .select("tenant_id, is_primary")
    .eq("activity_id", activityId)
    .limit(100);
  const rows = (data ?? []) as { tenant_id: string; is_primary: boolean }[];
  if (rows.length === 0) return [];
  const { data: profiles } = await supabase
    .from("mkt_business_profiles")
    .select("tenant_id, display_name_ar")
    .in(
      "tenant_id",
      rows.map((r) => r.tenant_id),
    );
  const names = new Map(
    ((profiles ?? []) as { tenant_id: string; display_name_ar: string | null }[]).map((p) => [
      p.tenant_id,
      p.display_name_ar,
    ]),
  );
  return rows.map((r) => ({ ...r, name: names.get(r.tenant_id) ?? null }));
}

// ------------------------------------------------- open sectors (admin only)

/**
 * The taxonomy is deliberately open-ended: staff can add a sector for any
 * lawful activity at any time. Both helpers are admin-guarded server side.
 */
export async function createActivityGroup(input: {
  nameAr: string;
  nameEn?: string | undefined;
  slug?: string | undefined;
  sortOrder?: number | undefined;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_create_group", {
    _name_ar: input.nameAr,
    ...(input.nameEn ? { _name_en: input.nameEn } : {}),
    ...(input.slug ? { _slug: input.slug } : {}),
    ...(input.sortOrder === undefined ? {} : { _sort_order: input.sortOrder }),
  });
  if (error) throw error;
  return String(data ?? "");
}

export async function updateActivityGroup(input: {
  id: string;
  nameAr?: string | undefined;
  nameEn?: string | undefined;
  isActive?: boolean | undefined;
  sortOrder?: number | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_update_group", {
    _id: input.id,
    ...(input.nameAr ? { _name_ar: input.nameAr } : {}),
    ...(input.nameEn ? { _name_en: input.nameEn } : {}),
    ...(input.isActive === undefined ? {} : { _is_active: input.isActive }),
    ...(input.sortOrder === undefined ? {} : { _sort_order: input.sortOrder }),
  });
  if (error) throw error;
}

export async function createActivity(input: {
  groupId: string;
  nameAr: string;
  nameEn?: string | undefined;
  parentId?: string | null | undefined;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_create_activity", {
    _group_id: input.groupId,
    _name_ar: input.nameAr,
    ...(input.nameEn ? { _name_en: input.nameEn } : {}),
    ...(input.parentId ? { _parent_id: input.parentId } : {}),
  });
  if (error) throw error;
  return String(data ?? "");
}

export async function updateActivity(input: {
  id: string;
  nameAr?: string | undefined;
  nameEn?: string | undefined;
  isActive?: boolean | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_update_activity", {
    _id: input.id,
    ...(input.nameAr ? { _name_ar: input.nameAr } : {}),
    ...(input.nameEn ? { _name_en: input.nameEn } : {}),
    ...(input.isActive === undefined ? {} : { _is_active: input.isActive }),
  });
  if (error) throw error;
}

// ------------------------------------------------- migration report (read-only)

export interface MigrationReportRow {
  tenant_id: string;
  legacy_text: string | null;
  bucket: string;
  matched_activity_id: string | null;
  matched_name_ar: string | null;
  score: number | null;
}

/**
 * Pure analysis of the legacy free-text activity stored on business profiles.
 * It reads and reports only — nothing is written or linked automatically.
 */
export async function loadMigrationReport(): Promise<MigrationReportRow[]> {
  const { data, error } = await supabase.rpc("mkt_activity_migration_report");
  if (error) throw error;
  return (data ?? []) as MigrationReportRow[];
}
