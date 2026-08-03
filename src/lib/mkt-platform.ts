/**
 * Platform-level administration (system owner console).
 *
 * The client NEVER decides who is an administrator. Every answer here comes
 * from a server-side, `SECURITY DEFINER` function keyed on `auth.uid()`:
 *
 *   `mkt_my_platform_role()` → { platform_role, is_system_owner, staff_perms }
 *
 * No e-mail comparison, no localStorage role, no tenant claim is ever used as
 * an authorisation signal. Hiding a button is only cosmetic: each mutation
 * below is a server function that re-checks the caller and writes an audit row.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export type PlatformRole = "system_owner" | "platform_admin" | null;

export interface PlatformIdentity {
  user_id: string | null;
  platform_role: PlatformRole;
  is_system_owner: boolean;
  is_platform_admin: boolean;
  staff_perms: string[];
  restricted: boolean;
}

const ANONYMOUS: PlatformIdentity = {
  user_id: null,
  platform_role: null,
  is_system_owner: false,
  is_platform_admin: false,
  staff_perms: [],
  restricted: false,
};

/** Server-verified platform identity of the signed-in user. */
export async function loadPlatformIdentity(): Promise<PlatformIdentity> {
  const { data, error } = await supabase.rpc("mkt_my_platform_role");
  if (error || !data || typeof data !== "object") return ANONYMOUS;
  const row = data as Record<string, unknown>;
  const role = row["platform_role"];
  return {
    user_id: typeof row["user_id"] === "string" ? row["user_id"] : null,
    platform_role: role === "system_owner" || role === "platform_admin" ? role : null,
    is_system_owner: row["is_system_owner"] === true,
    is_platform_admin: row["is_platform_admin"] === true,
    staff_perms: Array.isArray(row["staff_perms"]) ? (row["staff_perms"] as string[]) : [],
    restricted: row["restricted"] === true,
  };
}

export const PLATFORM_IDENTITY_KEY = ["mkt", "platform-identity"] as const;

/**
 * Admin identity for the current session. Scoped by user id so a second
 * account in the same browser can never read the previous admin's cache.
 */
export function usePlatformIdentity() {
  const { session, status } = useSession();
  const query = useQuery({
    queryKey: [...PLATFORM_IDENTITY_KEY, session?.user.id ?? null],
    enabled: !!session,
    staleTime: 60_000,
    // A revoked role must close the console quickly, so keep re-checking.
    refetchOnWindowFocus: true,
    queryFn: loadPlatformIdentity,
  });
  return {
    identity: session ? (query.data ?? null) : ANONYMOUS,
    loading: status === "loading" || (!!session && query.isLoading),
    refetch: query.refetch,
  };
}

/** Drops every cached admin answer (sign-out, account switch, lost role). */
export function useClearAdminCache() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.removeQueries({ queryKey: ["mkt", "admin"] });
    queryClient.removeQueries({ queryKey: PLATFORM_IDENTITY_KEY });
  };
}

/** Where a freshly signed-in user belongs: the console, or the normal flow. */
export async function landingPathForSession(): Promise<string> {
  const identity = await loadPlatformIdentity();
  return identity.is_platform_admin && !identity.restricted ? "/admin" : "/select-account";
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface AdminOverview {
  users: number;
  businesses: number;
  listings_published: number;
  listings_pending: number;
  reports_new: number;
  verifications_pending: number;
  restricted_accounts: number;
  activity_suggestions: number;
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc("mkt_admin_overview");
  if (error) throw error;
  const row = (data ?? {}) as Record<string, number>;
  return {
    users: row["users"] ?? 0,
    businesses: row["businesses"] ?? 0,
    listings_published: row["listings_published"] ?? 0,
    listings_pending: row["listings_pending"] ?? 0,
    reports_new: row["reports_new"] ?? 0,
    verifications_pending: row["verifications_pending"] ?? 0,
    restricted_accounts: row["restricted_accounts"] ?? 0,
    activity_suggestions: row["activity_suggestions"] ?? 0,
  };
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_seen_at: string | null;
  verification_status: string | null;
  listings_count: number;
  businesses_count: number;
  restriction: string | null;
  restriction_id: string | null;
}

export async function loadAdminUsers(search: string): Promise<AdminUserRow[]> {
  const term = search.trim();
  const { data, error } = await supabase.rpc("mkt_admin_users", {
    ...(term ? { _search: term } : {}),
    _limit: 100,
  });
  if (error) throw error;
  return (data ?? []) as AdminUserRow[];
}

// ── Businesses ───────────────────────────────────────────────────────────────

export interface AdminBusinessRow {
  tenant_id: string;
  name: string | null;
  slug: string | null;
  country: string | null;
  city: string | null;
  main_activity: string | null;
  sub_activities: string[] | null;
  verification_status: string | null;
  listings_count: number;
  status: string | null;
  created_at: string;
  officer_name: string | null;
  restriction: string | null;
  restriction_id: string | null;
}

export async function loadAdminBusinesses(search: string): Promise<AdminBusinessRow[]> {
  const term = search.trim();
  const { data, error } = await supabase.rpc("mkt_admin_businesses", {
    ...(term ? { _search: term } : {}),
    _limit: 100,
  });
  if (error) throw error;
  return (data ?? []) as AdminBusinessRow[];
}

// ── Enforcement + notes ──────────────────────────────────────────────────────

export type SubjectAction = "restrict" | "suspend" | "ban" | "revoke_verification" | "lift";

/** Every sensitive action needs a reason; the database rejects an empty one. */
export async function runSubjectAction(input: {
  subjectType: "user" | "business";
  subjectId: string;
  action: SubjectAction;
  reason: string;
  days?: number | undefined;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_subject_action", {
    _subject_type: input.subjectType,
    _subject_id: input.subjectId,
    _action: input.action,
    _reason: input.reason,
    ...(input.days ? { _days: input.days } : {}),
  });
  if (error) throw error;
}

export async function addAdminNote(
  subjectType: "user" | "business",
  subjectId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_add_note", {
    _subject_type: subjectType,
    _subject_id: subjectId,
    _body: body,
  });
  if (error) throw error;
}

export interface AdminNote {
  id: string;
  subject_type: string;
  subject_id: string;
  body: string;
  author_id: string;
  created_at: string;
}

export async function loadAdminNotes(
  subjectType: "user" | "business",
  subjectId: string,
): Promise<AdminNote[]> {
  const { data } = await supabase
    .from("mkt_admin_notes")
    .select("id, subject_type, subject_id, body, author_id, created_at")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as AdminNote[];
}

export async function notifyUser(userId: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_notify_user", {
    _user_id: userId,
    _title: title,
    _body: body,
  });
  if (error) throw error;
}

// ── Roles ────────────────────────────────────────────────────────────────────

export interface AdminRoleRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  platform_role: PlatformRole;
  staff_perms: string[];
  granted_at: string | null;
}

/** Staff permissions a limited administrator can hold (platform scope). */
export const STAFF_PERMISSIONS = [
  "reports.inbox_view",
  "reports.review",
  "reports.assign",
  "reports.close",
  "reports.reopen",
  "reports.escalate",
  "reports.merge",
  "reports.add_internal_note",
  "reports.message_advertiser",
  "reports.message_reporter",
  "reports.audit_view",
  "ads.moderation_hide",
  "ads.moderation_suspend",
  "accounts.restrict",
  "accounts.suspend",
  "businesses.suspend",
  "verifications.review",
  "appeals.review",
] as const;

export async function loadAdminRoles(): Promise<AdminRoleRow[]> {
  const { data, error } = await supabase.rpc("mkt_admin_roles");
  if (error) throw error;
  return (data ?? []) as AdminRoleRow[];
}

export async function setPlatformRole(
  userId: string,
  role: Exclude<PlatformRole, null> | null,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_set_platform_role", {
    _user_id: userId,
    // `null` revokes the platform role entirely (server-side check applies).
    _role: (role ?? null) as never,
    _reason: reason,
  });
  if (error) throw error;
}

export async function setStaffPermission(
  userId: string,
  perm: string,
  granted: boolean,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_set_staff_perm", {
    _user_id: userId,
    _perm: perm,
    _granted: granted,
    _reason: reason,
  });
  if (error) throw error;
}

// ── Audit log ────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
}

export async function loadAuditLog(search: string, entity: string): Promise<AuditRow[]> {
  const term = search.trim();
  const scope = entity.trim();
  const { data, error } = await supabase.rpc("mkt_admin_audit_log", {
    ...(term ? { _search: term } : {}),
    ...(scope ? { _entity: scope } : {}),
    _limit: 200,
  });
  if (error) throw error;
  return (data ?? []) as AuditRow[];
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface PlatformSetting {
  key: string;
  section: string;
  value: Record<string, unknown>;
  description_ar: string | null;
  updated_at: string;
}

export async function loadPlatformSettings(): Promise<PlatformSetting[]> {
  const { data } = await supabase
    .from("mkt_platform_settings")
    .select("key, section, value, description_ar, updated_at")
    .order("section")
    .order("key");
  return (data ?? []) as PlatformSetting[];
}

export async function savePlatformSetting(
  key: string,
  value: Record<string, unknown>,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_set_setting", {
    _key: key,
    _value: value as never,
    _reason: reason,
  });
  if (error) throw error;
}

/** Database errors never reach the screen verbatim. */
export function adminErrorMessage(error: unknown, fallback: string): string {
  const raw = String((error as { message?: string })?.message ?? "").toLowerCase();
  if (raw.includes("not authorized")) return "لا تملك صلاحية تنفيذ هذا الإجراء.";
  if (raw.includes("reason is required")) return "السبب إلزامي.";
  if (raw.includes("last system owner")) return "لا يمكن سحب صلاحية آخر مدير نظام.";
  if (raw.includes("confirmed e-mail")) return "يجب أن يكون الحساب موجودًا وبريده مؤكدًا.";
  return fallback;
}
