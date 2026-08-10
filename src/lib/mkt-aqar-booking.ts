/**
 * كَحيل عقار — طلبات الحجز والمعاينة.
 *
 * المسار عندنا «طلب بلا دفع»: لا حجز مالي ولا مبلغ محتجز ولا بوابة دفع. الطلب
 * إشعار للمعلن بنيّة الحجز، ويبقى `pending` حتى يقبله أو يرفضه أو تنتهي مدته.
 * الملخّص المالي يُحسب للعرض فقط (تقدير المدة × السعر) ولا يُخزَّن كالتزام.
 *
 * كل الكتابة تحت RLS: العميل يُدرج طلبه بحالة `pending` فقط، ويستطيع إلغاءه.
 */

import { supabase } from "@/integrations/supabase/client";

import { formatAqarAmount, type AqarListing, type AqarTrack } from "@/lib/mkt-aqar";

/** مدة صلاحية الطلب قبل انتهائه تلقائيًا (48 ساعة). */
export const AQAR_REQUEST_TTL_HOURS = 48;

export type AqarBookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "auto_cancelled"
  | "cancelled_by_customer";

export const AQAR_BOOKING_STATUS_LABELS: Record<AqarBookingStatus, string> = {
  pending: "بانتظار رد المعلن",
  accepted: "مقبول",
  rejected: "مرفوض",
  auto_cancelled: "انتهت مدة الطلب",
  cancelled_by_customer: "ألغيته",
};

export interface AqarBookingRow {
  id: string;
  listing_id: string;
  provider_id: string;
  room_type_id: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  message: string | null;
  status: AqarBookingStatus;
  decision_reason: string | null;
  expires_at: string;
  created_at: string;
  /** بيانات التمديد — تُملأ عند قبول المعلن لطلب تمديد. */
  extended_at: string | null;
  extension_count: number;
  previous_check_out: string | null;

  listing: {
    id: string;
    title: string;
    city: string;
    district: string;
    deal_track: AqarTrack;
    property_type: string;
    price: number;
    price_currency: "SYP" | "USD";
    price_period: "night" | "month" | "year" | "total";
  } | null;
}

export interface AqarBookingInput {
  listing_id: string;
  provider_id: string;
  room_type_id?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  guests?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  message?: string | null;
}

/** عدد الليالي بين تاريخين (YYYY-MM-DD)، أو 0 إن كان أحدهما ناقصًا. */
export function nightsBetween(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}

export interface AqarEstimateLine {
  label: string;
  value: string;
}

/**
 * ملخّص تقديري للعرض فقط: وحدة السعر × المدة. لا رسوم خدمة ولا ضريبة ولا
 * عمولة — لأن المنصة لا تحصّل شيئًا، فأي سطر إضافي سيكون وعدًا كاذبًا.
 */
export function estimateAqarTotal(
  listing: Pick<AqarListing, "price" | "price_currency" | "price_period" | "deal_track">,
  nights: number,
): { lines: AqarEstimateLine[]; total: string | null } {
  const unit = formatAqarAmount(listing.price, listing.price_currency);
  if (listing.deal_track === "daily_rent" && listing.price_period === "night") {
    if (nights <= 0) {
      return { lines: [{ label: "سعر الليلة", value: unit }], total: null };
    }
    return {
      lines: [
        { label: "سعر الليلة", value: unit },
        { label: "عدد الليالي", value: nights.toLocaleString("en-US") },
      ],
      total: formatAqarAmount(listing.price * nights, listing.price_currency),
    };
  }
  if (listing.deal_track === "long_rent") {
    return { lines: [{ label: "الإيجار المطلوب", value: unit }], total: null };
  }
  return { lines: [{ label: "السعر المطلوب", value: unit }], total: null };
}

/** ينشئ طلبًا جديدًا بحالة `pending` وينتهي تلقائيًا بعد 48 ساعة. */
export async function createAqarBooking(input: AqarBookingInput): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("يلزم تسجيل الدخول لإرسال الطلب.");

  const expires = new Date(Date.now() + AQAR_REQUEST_TTL_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("mkt_realestate_bookings")
    .insert({
      listing_id: input.listing_id,
      provider_id: input.provider_id,
      room_type_id: input.room_type_id ?? null,
      customer_user_id: userId,
      customer_name: input.customer_name?.trim() || null,
      customer_phone: input.customer_phone?.trim() || null,
      check_in: input.check_in ?? null,
      check_out: input.check_out ?? null,
      guests: input.guests ?? null,
      message: input.message?.trim() || null,
      status: "pending",
      expires_at: expires,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

const BOOKING_COLUMNS =
  "id, listing_id, provider_id, room_type_id, check_in, check_out, guests, message, status, decision_reason, expires_at, created_at, extended_at, extension_count, previous_check_out, listing:mkt_realestate_listings(id, title, city, district, deal_track, property_type, price, price_currency, price_period)";


/** طلبات المستخدم الحالي، الأحدث أولًا. تُرجع مصفوفة فارغة لغير المسجَّل. */
export async function fetchMyAqarBookings(): Promise<AqarBookingRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return [];
  const { data } = await supabase
    .from("mkt_realestate_bookings")
    .select(BOOKING_COLUMNS)
    .eq("customer_user_id", auth.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as unknown as AqarBookingRow[];
}

/** إلغاء العميل لطلبه — لا حذف: الحالة تتغيّر ويبقى السجل للمراجعة. */
export async function cancelAqarBooking(id: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_realestate_bookings")
    .update({ status: "cancelled_by_customer" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type AqarExtensionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export const AQAR_EXTENSION_STATUS_LABELS: Record<AqarExtensionStatus, string> = {
  pending: "بانتظار رد المعلن",
  accepted: "تم التمديد",
  rejected: "رُفض التمديد",
  expired: "انتهت مهلة الرد",
  cancelled: "ملغى",
};

export interface AqarExtensionRow {
  id: string;
  booking_id: string;
  previous_check_out: string | null;
  new_check_out: string;
  status: AqarExtensionStatus;
  expires_at: string;
  decision_reason: string | null;
  created_at: string;
}

/**
 * «تمديد المدة» طلب مستقل على نفس الحجز المقبول: المعلن وحده يقبله، وعند القبول
 * يُحدَّث تاريخ الخروج ويُحفظ التاريخ السابق. كل ذلك داخل دالة SECURITY DEFINER
 * فلا يمكن للعميل تمديد إقامته بنفسه.
 */
export async function requestAqarExtension(
  booking: AqarBookingRow,
  newCheckOut: string,
): Promise<string> {
  if (!booking.check_out) throw new Error("لا يوجد تاريخ خروج لتمديده.");
  const { data, error } = await supabase.rpc("mkt_re_request_extension", {
    _booking_id: booking.id,
    _new_check_out: newCheckOut,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** قرار المعلن على طلب تمديد: قبول أو رفض. */
export async function decideAqarExtension(
  extensionId: string,
  accept: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_re_decide_extension", {
    _extension_id: extensionId,
    _accept: accept,
    _reason: reason?.trim() || "",
  });
  if (error) throw new Error(error.message);
}

const EXTENSION_COLUMNS =
  "id, booking_id, previous_check_out, new_check_out, status, expires_at, decision_reason, created_at";

/** طلبات التمديد الخاصة بحجوزات المستخدم الحالي. */
export async function fetchMyAqarExtensions(): Promise<AqarExtensionRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return [];
  const { data } = await supabase
    .from("mkt_realestate_booking_extensions")
    .select(EXTENSION_COLUMNS)
    .eq("requested_by", auth.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as AqarExtensionRow[];
}


/** الطلب «قادم» إن كان تاريخ الخروج (أو الدخول) لم يمضِ بعد. */
export function isUpcomingBooking(row: AqarBookingRow): boolean {
  const edge = row.check_out ?? row.check_in;
  if (!edge) return row.status === "pending" || row.status === "accepted";
  return Date.parse(`${edge}T23:59:59Z`) >= Date.now();
}

/** عدد الأيام حتى تاريخ (سالب إن مضى). */
export function daysUntil(date: string): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

/**
 * أقرب حجز قادم للمستخدم (مقبول أو بانتظار الرد) — تُستعمل في لوحة الدخول
 * المصغّرة على /aqar. تُرجع null لغير المسجَّل أو إن لم يوجد.
 */
export async function fetchNextUpcomingAqarBooking(): Promise<AqarBookingRow | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return null;
  const { data } = await supabase
    .from("mkt_realestate_bookings")
    .select(BOOKING_COLUMNS)
    .eq("customer_user_id", auth.user.id)
    .in("status", ["pending", "accepted"])
    .is("deleted_at", null)
    .order("check_in", { ascending: true, nullsFirst: false })
    .limit(10);
  const rows = (data ?? []) as unknown as AqarBookingRow[];
  return rows.filter(isUpcomingBooking)[0] ?? null;
}

/**
 * أحدث إقامة مقبولة انتهت ولم تُقيَّم بعد — مصدر «تلميح التقييم» الذي يظلّ
 * ظاهرًا حتى يقيّم العميل فعلًا.
 */
export async function fetchRatableAqarBooking(
  reviewedBookingIds: string[],
): Promise<AqarBookingRow | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("mkt_realestate_bookings")
    .select(BOOKING_COLUMNS)
    .eq("customer_user_id", auth.user.id)
    .eq("status", "accepted")
    .is("deleted_at", null)
    .not("check_out", "is", null)
    .lt("check_out", today)
    .order("check_out", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as unknown as AqarBookingRow[];
  const reviewed = new Set(reviewedBookingIds);
  return rows.find((row) => !reviewed.has(row.id)) ?? null;
}

