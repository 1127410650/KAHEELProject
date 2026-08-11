import { supabase } from "@/integrations/supabase/client";

/* ──────────────  unified append-only operations log  ────────────── */

export interface OpsLogRow {
  id: string;
  at: string;
  actor_user_id: string | null;
  action: string;
  unit: string;
  entity: string | null;
  entity_id: string | null;
  summary: string | null;
  meta: Record<string, unknown>;
}

export interface OpsLogFilters {
  search?: string;
  unit?: string;
  from?: string;
  to?: string;
}

export const OPS_LOG_UNITS = [
  "platform",
  "market",
  "aqar",
  "services",
  "errands",
  "guide",
  "account",
  "billing",
] as const;

export async function loadOpsLog(
  filters: OpsLogFilters = {},
  limit = 100,
  offset = 0,
): Promise<OpsLogRow[]> {
  const search = filters.search?.trim();
  const { data, error } = await supabase.rpc("mkt_admin_ops_log", {
    ...(search ? { _search: search } : {}),
    ...(filters.unit ? { _unit: filters.unit } : {}),
    ...(filters.from ? { _from: filters.from } : {}),
    ...(filters.to ? { _to: filters.to } : {}),
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as OpsLogRow[];
}

export async function writeOpsLog(input: {
  action: string;
  unit?: string;
  entity?: string;
  entityId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_ops_log_write", {
    _action: input.action,
    ...(input.unit ? { _unit: input.unit } : {}),
    ...(input.entity ? { _entity: input.entity } : {}),
    ...(input.entityId ? { _entity_id: input.entityId } : {}),
    ...(input.summary ? { _summary: input.summary } : {}),
    ...(input.meta ? { _meta: input.meta } : {}),
  });
  if (error) throw error;
  return data as string;
}

/* ──────────────────────  audited data export  ────────────────────── */

export interface ExportLogRow {
  id: string;
  at: string;
  actor_user_id: string;
  kind: string;
  unit: string;
  filters: Record<string, unknown>;
  row_count: number;
  reason: string;
}

export async function loadExportLog(limit = 100, offset = 0): Promise<ExportLogRow[]> {
  const { data, error } = await supabase.rpc("mkt_admin_export_log", {
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return ((data ?? []) as ExportLogRow[]).map((row) => ({
    ...row,
    row_count: Number(row.row_count ?? 0),
  }));
}

/** Records the export attempt server-side. Throws when the caller lacks the
 *  export permission, omits a reason, or passed the daily export limit. */
export async function recordExport(input: {
  kind: string;
  reason: string;
  unit?: string;
  filters?: Record<string, unknown>;
  rowCount?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_admin_export_record", {
    _kind: input.kind,
    _reason: input.reason.trim(),
    ...(input.unit ? { _unit: input.unit } : {}),
    ...(input.filters ? { _filters: input.filters } : {}),
    ...(input.rowCount != null ? { _row_count: input.rowCount } : {}),
  });
  if (error) throw error;
  return data as string;
}

/* ────────────────────  server-side session revoke  ──────────────────── */

export async function revokeUserSessions(userId: string, reason: string): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_admin_revoke_user_sessions", {
    _user_id: userId,
    _reason: reason.trim(),
  });
  if (error) throw error;
  return Number(data ?? 0);
}
