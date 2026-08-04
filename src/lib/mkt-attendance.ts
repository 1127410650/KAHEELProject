import { supabase } from "@/integrations/supabase/client";

/**
 * Attendance and shifts for platform staff.
 *
 * Check-in / check-out are manual and self-declared: no location tracking and
 * no implicit attendance from browsing. Every administrative correction keeps
 * the original values and requires a reason — the server enforces both.
 */

export type ShiftKind = "fixed" | "rotating" | "flex" | "rest" | "holiday";
export type AttendanceStatus =
  | "open"
  | "present"
  | "late"
  | "early_leave"
  | "absent"
  | "remote"
  | "leave"
  | "rest"
  | "holiday";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "open",
  "present",
  "late",
  "early_leave",
  "absent",
  "remote",
  "leave",
  "rest",
  "holiday",
];

export interface ShiftTemplate {
  code: string;
  name_ar: string;
  name_en: string;
  kind: ShiftKind;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  sort_order: number;
}

export interface AttendanceRow {
  id: string;
  user_id: string;
  label: string;
  work_date: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  source: "self" | "admin";
  remote: boolean;
  planned_minutes: number;
  actual_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  status: AttendanceStatus;
  note: string | null;
  approved_at: string | null;
  shift_template: string | null;
  shift_kind: ShiftKind | null;
  edits_count: number;
}

export interface MyAttendanceRow {
  id: string;
  work_date: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  source: "self" | "admin";
  remote: boolean;
  planned_minutes: number;
  actual_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  status: AttendanceStatus;
  note: string | null;
  shift_template: string | null;
  shift_kind: ShiftKind | null;
}

export interface ShiftRow {
  id: string;
  user_id: string;
  label: string;
  work_date: string;
  template_code: string | null;
  kind: ShiftKind;
  planned_start: string | null;
  planned_end: string | null;
  planned_minutes: number;
  remote: boolean;
  note: string | null;
}

export interface AttendanceEditRow {
  id: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string;
  created_at: string;
}

/** Today in Riyadh, as YYYY-MM-DD — the day every attendance row is keyed by. */
export function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

export async function loadShiftTemplates(): Promise<ShiftTemplate[]> {
  const { data, error } = await supabase
    .from("mkt_shift_templates")
    .select("code,name_ar,name_en,kind,start_time,end_time,break_minutes,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ShiftTemplate[];
}

export async function loadAttendance(
  from: string,
  to: string,
  userId?: string | null,
): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.rpc("mkt_attendance_list", {
    _from: from,
    _to: to,
    _user_id: userId ?? null,
  } as never);
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function loadMyAttendance(from?: string, to?: string): Promise<MyAttendanceRow[]> {
  const { data, error } = await supabase.rpc("mkt_attendance_my", {
    _from: from ?? null,
    _to: to ?? null,
  } as never);
  if (error) throw error;
  return (data ?? []) as MyAttendanceRow[];
}

export async function loadShifts(
  from: string,
  to: string,
  userId?: string | null,
): Promise<ShiftRow[]> {
  const { data, error } = await supabase.rpc("mkt_shifts_list", {
    _from: from,
    _to: to,
    _user_id: userId ?? null,
  } as never);
  if (error) throw error;
  return (data ?? []) as ShiftRow[];
}

export async function loadAttendanceEdits(attendanceId: string): Promise<AttendanceEditRow[]> {
  const { data, error } = await supabase.rpc("mkt_attendance_edits_list", {
    _attendance_id: attendanceId,
  } as never);
  if (error) throw error;
  return (data ?? []) as AttendanceEditRow[];
}

export async function checkIn(remote = false, note?: string | null): Promise<void> {
  const { error } = await supabase.rpc("mkt_attendance_check_in", {
    _remote: remote,
    _note: note ?? null,
  } as never);
  if (error) throw error;
}

export async function checkOut(note?: string | null): Promise<void> {
  const { error } = await supabase.rpc("mkt_attendance_check_out", {
    _note: note ?? null,
  } as never);
  if (error) throw error;
}

export async function adminSetAttendance(input: {
  userId: string;
  workDate: string;
  checkedIn: string | null;
  checkedOut: string | null;
  remote: boolean;
  status?: AttendanceStatus | null;
  note?: string | null;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_attendance_admin_set", {
    _user_id: input.userId,
    _work_date: input.workDate,
    _checked_in: input.checkedIn,
    _checked_out: input.checkedOut,
    _remote: input.remote,
    _status: input.status ?? null,
    _note: input.note ?? null,
    _reason: input.reason,
  } as never);
  if (error) throw error;
}

export async function approveAttendance(id: string, note?: string | null): Promise<void> {
  const { error } = await supabase.rpc("mkt_attendance_approve", {
    _id: id,
    _note: note ?? null,
  } as never);
  if (error) throw error;
}

export async function setShift(input: {
  userId: string;
  workDate: string;
  template: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  remote: boolean;
  note?: string | null;
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_shift_set", {
    _user_id: input.userId,
    _work_date: input.workDate,
    _template: input.template,
    _planned_start: input.plannedStart ?? null,
    _planned_end: input.plannedEnd ?? null,
    _remote: input.remote,
    _note: input.note ?? null,
    _reason: input.reason ?? null,
  } as never);
  if (error) throw error;
}

export function attendanceErrorKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes("already_checked_out")) return "admin.attendance.err.alreadyOut";
  if (message.includes("not_checked_in")) return "admin.attendance.err.notIn";
  if (message.includes("invalid_range")) return "admin.attendance.err.range";
  if (message.includes("reason_required")) return "admin.reasonRequired";
  if (message.includes("append_only_record")) return "admin.attendance.err.appendOnly";
  if (message.includes("forbidden")) return "market.admin.denied";
  return "admin.actionFailed";
}
