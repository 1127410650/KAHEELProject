/**
 * المحادثات المبلّغ عنها — قراءة ومعالجة بلاغات الرسائل من لوحة الإدارة.
 *
 * كل الأرقام من public.mkt_message_reports عبر دالتين محميّتين بالصلاحيات:
 * mkt_admin_message_reports للعرض، وmkt_admin_message_report_review للقرار.
 * لا يوجد أي مسار قراءة للرسائل من هنا خارج البلاغ نفسه.
 */
import { supabase } from "@/integrations/supabase/client";

export type MessageReportStatus = "open" | "reviewed" | "dismissed" | "actioned";
export type MessageReportAction = "dismiss" | "hide_message" | "keep_reviewed";

export const MESSAGE_REPORT_STATUSES: MessageReportStatus[] = [
  "open",
  "actioned",
  "dismissed",
  "reviewed",
];

export interface AdminMessageReport {
  id: string;
  status: MessageReportStatus;
  severity: string;
  reason_code: string;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  decision: string | null;
  decision_note: string | null;
  conversation_id: string;
  message_id: string;
  message_body: string | null;
  message_created_at: string;
  message_moderation_state: string | null;
  message_deleted_at: string | null;
  sender_user_id: string | null;
  reporter_user_id: string;
  listing_id: string | null;
  reports_count: number;
}

/** يعيد البلاغات مرتّبة: المفتوح أولًا ثم الأحدث. status=null يعني الكل. */
export async function loadAdminMessageReports(
  status: MessageReportStatus | null,
  limit = 50,
  offset = 0,
): Promise<AdminMessageReport[]> {
  const { data, error } = await supabase.rpc("mkt_admin_message_reports", {
    _status: status,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return ((data ?? []) as AdminMessageReport[]).map((row) => ({
    ...row,
    reports_count: Number(row.reports_count ?? 0),
  }));
}

/** قرار على بلاغ: رفض، أو إخفاء الرسالة، أو اعتبارها مُراجَعة. */
export async function reviewMessageReport(
  id: string,
  action: MessageReportAction,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_message_report_review", {
    _id: id,
    _action: action,
    _note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
}
