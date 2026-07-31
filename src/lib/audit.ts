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
  actorId: string | undefined;
  entityType: string;
  entityId?: string | null;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}) {
  if (!params.actorId) return;
  await supabase.from("audit_log").insert({
    actor_id: params.actorId,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    action: params.action,
    old_value: (params.oldValue ?? null) as never,
    new_value: (params.newValue ?? null) as never,
    reason: params.reason ?? null,
  });
}
