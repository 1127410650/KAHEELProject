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
  "id, listing_id, provider_id, room_type_id, check_in, check_out, guests, message, status, decision_reason, expires_at, created_at, listing:mkt_realestate_listings(id, title, city, district, deal_track, property_type, price, price_currency, price_period)";

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

/**
 * «تمديد المدة» عندنا طلب جديد يشير إلى الطلب المقبول السابق، لأن المعلن هو
 * صاحب القرار ولا يمكن للمنصة أن تمدّد إقامة نيابة عنه.
 */
export async function requestAqarExtension(
  booking: AqarBookingRow,
  newCheckOut: string,
): Promise<string> {
  if (!booking.check_out) throw new Error("لا يوجد تاريخ خروج لتمديده.");
  return createAqarBooking({
    listing_id: booking.listing_id,
    provider_id: booking.provider_id,
    room_type_id: booking.room_type_id,
    check_in: booking.check_out,
    check_out: newCheckOut,
    guests: booking.guests,
    message: `طلب تمديد للحجز رقم ${booking.id.slice(0, 8)} حتى ${newCheckOut}.`,
  });
}

/** الطلب «قادم» إن كان تاريخ الخروج (أو الدخول) لم يمضِ بعد. */
export function isUpcomingBooking(row: AqarBookingRow): boolean {
  const edge = row.check_out ?? row.check_in;
  if (!edge) return row.status === "pending" || row.status === "accepted";
  return Date.parse(`${edge}T23:59:59Z`) >= Date.now();
}
