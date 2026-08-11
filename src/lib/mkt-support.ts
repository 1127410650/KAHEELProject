import { supabase } from "@/integrations/supabase/client";
import { writeOpsLog } from "@/lib/mkt-ops-log";

export type SupportStatus = "new" | "processing" | "awaiting_customer" | "closed";
export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportUnit =
  | "market"
  | "aqar"
  | "services"
  | "errands"
  | "guide"
  | "account"
  | "billing";

export const SUPPORT_STATUSES: SupportStatus[] = [
  "new",
  "processing",
  "awaiting_customer",
  "closed",
];
export const SUPPORT_PRIORITIES: SupportPriority[] = ["low", "normal", "high", "urgent"];
export const SUPPORT_UNITS: SupportUnit[] = [
  "market",
  "aqar",
  "services",
  "errands",
  "guide",
  "account",
  "billing",
];

export interface SupportTicket {
  id: string;
  ref_no: string;
  requester_user_id: string;
  subject: string;
  body: string;
  channel: string;
  unit: string;
  subject_kind: string | null;
  subject_id: string | null;
  status: SupportStatus;
  priority: SupportPriority;
  assignee: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_user_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export async function loadSupportTickets(
  status: SupportStatus | null,
  limit = 50,
): Promise<SupportTicket[]> {
  let query = supabase
    .from("mkt_support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function loadSupportMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from("mkt_support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

export async function openSupportTicket(input: {
  subject: string;
  body: string;
  unit?: SupportUnit;
  subjectKind?: string;
  subjectId?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("mkt_support_tickets")
    .insert({
      subject: input.subject.trim(),
      body: input.body.trim(),
      unit: input.unit ?? "market",
      ...(input.subjectKind ? { subject_kind: input.subjectKind } : {}),
      ...(input.subjectId ? { subject_id: input.subjectId } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Staff reply. Both branches are mirrored into the append-only ops log so the
 *  action has an accountable line with its real actor (taken from auth.uid()). */
export async function replySupportTicket(
  ticketId: string,
  body: string,
  isInternal = false,
): Promise<void> {
  const { error } = await supabase.from("mkt_support_messages").insert({
    ticket_id: ticketId,
    body: body.trim(),
    is_internal: isInternal,
  });
  if (error) throw error;
  await writeOpsLog({
    action: isInternal ? "support.internal_note_added" : "support.replied",
    unit: "platform",
    entity: "support_ticket",
    entityId: ticketId,
    summary: isInternal ? "internal note" : "public reply",
  });
}

export async function updateSupportTicket(
  ticketId: string,
  patch: { status?: SupportStatus; priority?: SupportPriority; assignee?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("mkt_support_tickets")
    .update(patch)
    .eq("id", ticketId);
  if (error) throw error;
  await writeOpsLog({
    action: "support.ticket_updated",
    unit: "platform",
    entity: "support_ticket",
    entityId: ticketId,
    summary: Object.entries(patch)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(", "),
  });
}
