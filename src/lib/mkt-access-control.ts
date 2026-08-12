/**
 * Access control (roles & permissions) — client layer.
 *
 * The permission KEYS are not defined here. They live in
 * `public.mkt_permission_catalog`, which is the single source of truth shared by
 * the database policies, the `SECURITY DEFINER` RPCs, the route guards and this
 * screen. A key that is not in the catalog cannot be granted at all: the save
 * RPC rejects it, so the UI can never render a checkbox without a server effect.
 *
 * Nothing here is an authorisation decision. Every read and every write below is
 * re-checked server-side against `auth.uid()`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PermissionCatalogRow {
  perm_key: string;
  module: string;
  action: string;
  label_ar: string;
  label_en: string;
  description_ar: string;
  description_en: string;
  sort: number;
}

/** Display order of the permission groups inside the screen. */
export const MODULE_ORDER = [
  "console",
  "users",
  "accounts",
  "listings",
  "content",
  "reports",
  "verifications",
  "support",
  "analytics",
  "workforce",
  "finance",
  "platform",
  "audit",
] as const;

/** Action columns, in the order the owner's specification lists them. */
export const ACTION_ORDER = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "execute",
  "assign",
  "export",
  "manage",
] as const;

export async function loadPermissionCatalog(): Promise<PermissionCatalogRow[]> {
  const { data, error } = await supabase.rpc("mkt_permission_catalog_list");
  if (error) throw error;
  return (data ?? []) as PermissionCatalogRow[];
}

export interface PermSaveResult {
  operation_id: string;
  before: string[];
  after: string[];
  added: string[];
  removed: string[];
}

/**
 * Writes the whole permission set of one user in a single atomic call: the
 * database computes the diff under a row/advisory lock, so two sessions editing
 * the same person cannot produce a torn result, and records the before/after in
 * the audit and operations logs.
 */
export async function saveStaffPerms(
  userId: string,
  perms: string[],
  reason: string,
): Promise<PermSaveResult> {
  const { data, error } = await supabase.rpc("mkt_admin_save_staff_perms", {
    _user_id: userId,
    _perms: perms,
    _reason: reason,
  });
  if (error) throw error;
  return data as unknown as PermSaveResult;
}

export interface PermissionGroup {
  module: string;
  rows: PermissionCatalogRow[];
}

/** Groups the catalog by module, preserving `MODULE_ORDER` then catalog order. */
export function groupCatalog(rows: PermissionCatalogRow[]): PermissionGroup[] {
  const byModule = new Map<string, PermissionCatalogRow[]>();
  for (const row of rows) {
    const list = byModule.get(row.module) ?? [];
    list.push(row);
    byModule.set(row.module, list);
  }
  const known = MODULE_ORDER.filter((module) => byModule.has(module));
  const extra = [...byModule.keys()].filter(
    (module) => !(MODULE_ORDER as readonly string[]).includes(module),
  );
  return [...known, ...extra].map((module) => ({
    module,
    rows: (byModule.get(module) ?? []).slice().sort((a, b) => a.sort - b.sort),
  }));
}
