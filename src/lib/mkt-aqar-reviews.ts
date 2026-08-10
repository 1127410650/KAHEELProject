/**
 * كَحيل عقار — تقييم ما بعد الإقامة.
 *
 * التقييم متاح لصاحب حجز مقبول انتهى تاريخ خروجه، ومرة واحدة لكل حجز. الكتابة
 * كلها عبر دالة `mkt_re_submit_review` (SECURITY DEFINER) فلا يمكن للعميل أن
 * يقيّم حجزًا ليس له أو لم ينتهِ. القراءة عامة للتقييمات المنشورة فقط.
 */

import { supabase } from "@/integrations/supabase/client";

/** الوسوم المعتمدة — نفس القائمة المسموح بها في قاعدة البيانات. */
export const AQAR_REVIEW_TAGS = [
  { key: "great_advertiser", label: "معلن رائع" },
  { key: "excellent_cleanliness", label: "نظافة مميزة" },
  { key: "accurate_info", label: "معلومات دقيقة" },
  { key: "great_location", label: "موقع ممتاز" },
  { key: "good_value", label: "سعر مناسب" },
] as const;

export type AqarReviewTag = (typeof AQAR_REVIEW_TAGS)[number]["key"];

export const AQAR_REVIEW_TAG_LABELS: Record<string, string> = Object.fromEntries(
  AQAR_REVIEW_TAGS.map((tag) => [tag.key, tag.label]),
);

export interface AqarReviewRow {
  id: string;
  booking_id: string;
  listing_id: string;
  provider_id: string;
  rating: number;
  tags: string[];
  comment: string | null;
  created_at: string;
}

export interface AqarReviewStats {
  reviews_count: number;
  rating_avg: number | null;
  top_tags: string[];
}

/** يرسل التقييم ويُرجع معرّف السجل. */
export async function submitAqarReview(input: {
  bookingId: string;
  rating: number;
  tags: string[];
  comment?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("mkt_re_submit_review", {
    _booking_id: input.bookingId,
    _rating: input.rating,
    _tags: input.tags,
    _comment: input.comment?.trim() || "",
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** معرّفات الحجوزات التي قيّمها المستخدم الحالي. */
export async function fetchMyReviewedBookingIds(): Promise<string[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return [];
  const { data } = await supabase
    .from("mkt_realestate_reviews")
    .select("booking_id")
    .eq("reviewer_user_id", auth.user.id);
  return (data ?? []).map((row) => row.booking_id);
}

/** ملخّص تقييمات معلن — محسوب في القاعدة لا على الجهاز. */
export async function fetchAqarProviderReviewStats(
  providerId: string,
): Promise<AqarReviewStats | null> {
  const { data } = await supabase
    .from("mkt_realestate_provider_review_stats")
    .select("reviews_count, rating_avg, top_tags")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!data) return null;
  return {
    reviews_count: data.reviews_count ?? 0,
    rating_avg: data.rating_avg ?? null,
    top_tags: data.top_tags ?? [],
  };
}

/** ملخّص تقييمات وحدة واحدة. */
export async function fetchAqarListingReviewStats(
  listingId: string,
): Promise<Omit<AqarReviewStats, "top_tags"> | null> {
  const { data } = await supabase
    .from("mkt_realestate_listing_review_stats")
    .select("reviews_count, rating_avg")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!data) return null;
  return { reviews_count: data.reviews_count ?? 0, rating_avg: data.rating_avg ?? null };
}

/** أحدث تقييمات معلن (منشورة فقط). */
export async function fetchAqarProviderReviews(
  providerId: string,
  limit = 10,
): Promise<AqarReviewRow[]> {
  const { data } = await supabase
    .from("mkt_realestate_reviews")
    .select("id, booking_id, listing_id, provider_id, rating, tags, comment, created_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AqarReviewRow[];
}

/** تنسيق المعدّل بأرقام إنجليزية بخانة عشرية واحدة. */
export function formatRating(avg: number | null | undefined): string {
  if (avg == null) return "—";
  return avg.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
