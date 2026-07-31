import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create"
  | "update"
  | "approve"
  | "cancel"
  | "soft_delete"
  | "restore"
  | "upload"
  | "download";

export async function logAudit(params: {
  /** Kept for call-site compatibility; the actor is derived server-side from the session. */
  actorId?: string | undefined;
  entityType: string;
  entityId?: string | null;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}) {
  await supabase.rpc("log_audit", {
    _entity_type: params.entityType,
    _action: params.action,
    ...(params.entityId ? { _entity_id: params.entityId } : {}),
    _old_value: (params.oldValue ?? null) as never,
    _new_value: (params.newValue ?? null) as never,
    ...(params.reason ? { _reason: params.reason } : {}),
  });
}
