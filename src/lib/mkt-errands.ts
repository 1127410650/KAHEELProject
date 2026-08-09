/**
 * خدمة «جيب لي» — العميل يطلب أي شي من أي مكان بوصف حرّ، والكابتن يجيبه له،
 * بلا حاجة لمتجر مسجّل في المنصة.
 *
 * هذا الملف هو **المصدر الوحيد** لكل قراءة وكتابة في الخدمة:
 *  • دليل الخدمات المرافقة (`mkt_errand_services`) — يُفعَّل ويُطفأ من لوحة الإدارة.
 *  • الطلبات (`mkt_errand_requests`) وعروض الكباتن (`mkt_errand_offers`) وسجل
 *    الحالات (`mkt_errand_events`) وسجل الكباتن (`mkt_errand_captains`).
 *
 * ## الأمان
 *  • كل انتقال في دورة الطلب يمرّ بعملية مؤمّنة على الخادم (`rpc`)، لا بكتابة
 *    مباشرة: تقديم عرض، قبوله/رفضه، تقدّم التنفيذ، الإلغاء، التقييم. حاميات
 *    قاعدة البيانات تُعيد أي عمود دورة حياة يحاول العميل تعديله بنفسه.
 *  • أرقام الهواتف لا تُقرأ من الجداول: `mkt_errand_contact` تُظهر رقم الطرف
 *    الآخر **بعد قبول العرض فقط**.
 *  • الصورة المرفقة تُخزَّن خارج المسار العام (`errands/…`)، ويقرأها صاحب الطلب
 *    والكابتن المكلّف والإدارة فقط عبر رابط موقّع.
 *
 * ## الصور
 *  الضغط في المتصفح إلزامي: نستعمل نفس مُحسِّن صور الدليل (WebP، ١٦٠٠px على
 *  الحد الأطول، ≤ 300KB) فلا تُرفع أي صورة أثقل من ذلك.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";
import { prepareGuidePhoto } from "@/lib/mkt-guide-community";

/* ── الأنواع ──────────────────────────────────────────────────────────────── */

export type ErrandStatus =
  | "open"
  | "offered"
  | "accepted"
  | "purchasing"
  | "delivering"
  | "delivered"
  | "cancelled"
  | "expired";

export interface ErrandService {
  id: string;
  slug: string;
  kind: string;
  name_ar: string;
  name_en: string;
  tagline_ar: string;
  tagline_en: string;
  icon: string;
  needs_pickup: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ErrandRequest {
  id: string;
  user_id: string;
  service_slug: string;
  details: string;
  photo_path: string | null;
  budget_estimate: number | null;
  currency: string;
  pickup_label: string | null;
  pickup_details: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_label: string;
  dropoff_details: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: ErrandStatus;
  captain_id: string | null;
  accepted_offer_id: string | null;
  delivery_fee: number | null;
  offers_count: number;
  rating: number | null;
  rating_comment: string | null;
  cancel_reason: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface ErrandOffer {
  id: string;
  request_id: string;
  captain_id: string;
  fee: number;
  eta_minutes: number | null;
  note: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
}

export interface ErrandEvent {
  id: string;
  request_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

export interface ErrandCaptain {
  id: string;
  user_id: string;
  display_name: string;
  phone: string | null;
  vehicle: string | null;
  status: "pending" | "approved" | "suspended";
  is_online: boolean;
  rating_avg: number;
  rating_count: number;
  jobs_done: number;
}

export interface ErrandContact {
  role: string;
  display_name: string;
  phone: string;
}

const SERVICE_COLUMNS =
  "id, slug, kind, name_ar, name_en, tagline_ar, tagline_en, icon, needs_pickup, is_active, sort_order";

const REQUEST_COLUMNS =
  "id, user_id, service_slug, details, photo_path, budget_estimate, currency, " +
  "pickup_label, pickup_details, pickup_lat, pickup_lng, " +
  "dropoff_label, dropoff_details, dropoff_lat, dropoff_lng, " +
  "status, captain_id, accepted_offer_id, delivery_fee, offers_count, " +
  "rating, rating_comment, cancel_reason, accepted_at, delivered_at, created_at";

const OFFER_COLUMNS = "id, request_id, captain_id, fee, eta_minutes, note, status, created_at";

const CAPTAIN_COLUMNS =
  "id, user_id, display_name, phone, vehicle, status, is_online, rating_avg, rating_count, jobs_done";

/* ── نصوص الحالات ─────────────────────────────────────────────────────────── */

/** ترتيب المراحل التي تُعرض للعميل كخط زمني. */
export const ERRAND_FLOW: ErrandStatus[] = [
  "open",
  "offered",
  "accepted",
  "purchasing",
  "delivering",
  "delivered",
];

const STATUS_AR: Record<ErrandStatus, string> = {
  open: "بانتظار عرض الكابتن",
  offered: "وصلك عرض سعر",
  accepted: "الكابتن قبل الطلب",
  purchasing: "الكابتن عمّال يجيب الطلب",
  delivering: "الطلب على الطريق",
  delivered: "تم التسليم",
  cancelled: "ملغى",
  expired: "انتهت مدته",
};

const STATUS_EN: Record<ErrandStatus, string> = {
  open: "Waiting for a captain's offer",
  offered: "You got a price offer",
  accepted: "Captain accepted",
  purchasing: "Captain is fetching your order",
  delivering: "On the way to you",
  delivered: "Delivered",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function errandStatusLabel(status: ErrandStatus, ar: boolean): string {
  return ar ? STATUS_AR[status] : STATUS_EN[status];
}

/** المرحلة التالية التي يستطيع الكابتن الانتقال إليها، أو `null` عند النهاية. */
export function nextCaptainStatus(status: ErrandStatus): ErrandStatus | null {
  if (status === "accepted") return "purchasing";
  if (status === "purchasing") return "delivering";
  if (status === "delivering") return "delivered";
  return null;
}

export function serviceName(service: ErrandService, ar: boolean): string {
  return ar ? service.name_ar : service.name_en;
}

export function serviceTagline(service: ErrandService, ar: boolean): string {
  return ar ? service.tagline_ar : service.tagline_en;
}

/* ── الصورة المرفقة ───────────────────────────────────────────────────────── */

/** الحد الأعلى بعد الضغط — نفس سقف صور الدليل. */
export const ERRAND_PHOTO_MAX_BYTES = 300 * 1024;

/**
 * يضغط الصورة في المتصفح ثم يرفعها خارج المسار العام. يرجع مسار الملف الذي
 * يُخزَّن في الطلب — لا رابطًا عامًا.
 */
export async function uploadErrandPhoto(file: File): Promise<string> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error("AUTH_REQUIRED");

  const prepared = await prepareGuidePhoto(file);
  const path = `errands/${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, prepared.blob, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** رابط موقّع قصير العمر للصورة المرفقة (يعمل لأطراف الطلب فقط). */
export async function errandPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/* ── دليل الخدمات ─────────────────────────────────────────────────────────── */

export function useErrandServices(includeInactive = false) {
  return useQuery({
    queryKey: ["mkt", "errand-services", includeInactive],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ErrandService[]> => {
      let query = supabase
        .from("mkt_errand_services")
        .select(SERVICE_COLUMNS)
        .order("sort_order", { ascending: true });
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ErrandService[];
    },
  });
}

export async function setServiceActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from("mkt_errand_services")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw error;
}

/* ── إنشاء الطلب ──────────────────────────────────────────────────────────── */

export interface ErrandPoint {
  label: string;
  details?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface NewErrandInput {
  serviceSlug: string;
  details: string;
  photoPath?: string | null;
  budgetEstimate?: number | null;
  pickup?: ErrandPoint | null;
  dropoff: ErrandPoint;
}

/** رسائل تحقّق عربية واضحة تُعرض كما هي في الواجهة. */
export function errandInputError(input: NewErrandInput, ar: boolean): string | null {
  const details = input.details.trim();
  if (details.length < 10) {
    return ar
      ? "اكتب تفاصيل الطلب بوضوح (١٠ أحرف على الأقل)."
      : "Describe your order clearly (at least 10 characters).";
  }
  if (details.length > 1200) {
    return ar ? "التفاصيل طويلة — ١٢٠٠ حرف كحد أقصى." : "Details are too long — 1200 characters max.";
  }
  if (!input.dropoff.label.trim()) {
    return ar ? "حدّد عنوان التوصيل إليه." : "Pick the delivery address.";
  }
  return null;
}

export async function createErrandRequest(input: NewErrandInput): Promise<string> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error("AUTH_REQUIRED");

  const { data, error } = await supabase
    .from("mkt_errand_requests")
    .insert({
      user_id: userId,
      service_slug: input.serviceSlug,
      details: input.details.trim(),
      photo_path: input.photoPath ?? null,
      budget_estimate: input.budgetEstimate ?? null,
      pickup_label: input.pickup?.label?.trim() || null,
      pickup_details: input.pickup?.details ?? null,
      pickup_lat: input.pickup?.lat ?? null,
      pickup_lng: input.pickup?.lng ?? null,
      dropoff_label: input.dropoff.label.trim(),
      dropoff_details: input.dropoff.details ?? null,
      dropoff_lat: input.dropoff.lat ?? null,
      dropoff_lng: input.dropoff.lng ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/* ── قراءات العميل ────────────────────────────────────────────────────────── */

export function useMyErrands(userId: string | null) {
  return useQuery({
    queryKey: ["mkt", "my-errands", userId],
    enabled: !!userId,
    staleTime: 10_000,
    queryFn: async (): Promise<ErrandRequest[]> => {
      const { data, error } = await supabase
        .from("mkt_errand_requests")
        .select(REQUEST_COLUMNS)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as ErrandRequest[];
    },
  });
}

export function useErrand(id: string | null) {
  return useQuery({
    queryKey: ["mkt", "errand", id],
    enabled: !!id,
    refetchInterval: 15_000,
    queryFn: async (): Promise<ErrandRequest | null> => {
      const { data, error } = await supabase
        .from("mkt_errand_requests")
        .select(REQUEST_COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ErrandRequest | null;
    },
  });
}

export function useErrandOffers(requestId: string | null) {
  return useQuery({
    queryKey: ["mkt", "errand-offers", requestId],
    enabled: !!requestId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<ErrandOffer[]> => {
      const { data, error } = await supabase
        .from("mkt_errand_offers")
        .select(OFFER_COLUMNS)
        .eq("request_id", requestId!)
        .order("fee", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ErrandOffer[];
    },
  });
}

export function useErrandEvents(requestId: string | null) {
  return useQuery({
    queryKey: ["mkt", "errand-events", requestId],
    enabled: !!requestId,
    staleTime: 10_000,
    queryFn: async (): Promise<ErrandEvent[]> => {
      const { data, error } = await supabase
        .from("mkt_errand_events")
        .select("id, request_id, from_status, to_status, note, created_at")
        .eq("request_id", requestId!)
        .order("created_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as ErrandEvent[];
    },
  });
}

/** أسماء الكباتن الظاهرة مع العروض — الاسم والتقييم فقط، بلا هاتف. */
export function useErrandCaptainCards(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");
  return useQuery({
    queryKey: ["mkt", "errand-captain-cards", key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, ErrandCaptain>> => {
      const { data, error } = await supabase
        .from("mkt_errand_captains")
        .select(CAPTAIN_COLUMNS)
        .in("id", [...new Set(ids)]);
      if (error) throw error;
      const map: Record<string, ErrandCaptain> = {};
      for (const row of (data ?? []) as ErrandCaptain[]) map[row.id] = row;
      return map;
    },
  });
}

/** رقم الطرف الآخر — يرجع `null` قبل قبول العرض. */
export function useErrandContact(requestId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "errand-contact", requestId],
    enabled: !!requestId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ErrandContact | null> => {
      const { data, error } = await supabase.rpc("mkt_errand_contact", {
        _request_id: requestId!,
      });
      if (error) throw error;
      const rows = (data ?? []) as ErrandContact[];
      return rows[0] ?? null;
    },
  });
}

/* ── عمليات دورة الطلب ────────────────────────────────────────────────────── */

export async function decideErrandOffer(offerId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("mkt_errand_decide_offer", {
    _offer_id: offerId,
    _accept: accept,
  });
  if (error) throw error;
}

export async function cancelErrand(requestId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_errand_cancel", {
    _request_id: requestId,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw error;
}

export async function rateErrand(
  requestId: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_errand_rate", {
    _request_id: requestId,
    _rating: rating,
    ...(comment ? { _comment: comment } : {}),
  });
  if (error) throw error;
}

/* ── جهة الكابتن ──────────────────────────────────────────────────────────── */

export function useMyCaptain(userId: string | null) {
  return useQuery({
    queryKey: ["mkt", "errand-captain-me", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<ErrandCaptain | null> => {
      const { data, error } = await supabase
        .from("mkt_errand_captains")
        .select(CAPTAIN_COLUMNS)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ErrandCaptain | null;
    },
  });
}

export async function applyAsCaptain(input: {
  displayName: string;
  phone: string;
  vehicle: string;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error("AUTH_REQUIRED");
  const { error } = await supabase.from("mkt_errand_captains").insert({
    user_id: userId,
    display_name: input.displayName.trim().slice(0, 60),
    phone: input.phone.trim().slice(0, 24) || null,
    vehicle: input.vehicle.trim().slice(0, 60) || null,
  });
  if (error) throw error;
}

export async function setCaptainOnline(id: string, online: boolean): Promise<void> {
  const { error } = await supabase
    .from("mkt_errand_captains")
    .update({ is_online: online, last_seen_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** الطلبات المفتوحة المتاحة للكابتن + طلباته المكلّف بها. */
export function useCaptainQueue(captain: ErrandCaptain | null) {
  return useQuery({
    queryKey: ["mkt", "errand-captain-queue", captain?.id ?? null],
    enabled: !!captain && captain.status === "approved",
    refetchInterval: 20_000,
    queryFn: async (): Promise<{ open: ErrandRequest[]; mine: ErrandRequest[] }> => {
      const [open, mine] = await Promise.all([
        supabase
          .from("mkt_errand_requests")
          .select(REQUEST_COLUMNS)
          .in("status", ["open", "offered"])
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("mkt_errand_requests")
          .select(REQUEST_COLUMNS)
          .eq("captain_id", captain!.id)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      if (open.error) throw open.error;
      if (mine.error) throw mine.error;
      return {
        open: (open.data ?? []) as unknown as ErrandRequest[],
        mine: (mine.data ?? []) as unknown as ErrandRequest[],
      };
    },
  });
}

export async function placeErrandOffer(input: {
  requestId: string;
  fee: number;
  etaMinutes?: number | null;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("mkt_errand_place_offer", {
    _request_id: input.requestId,
    _fee: input.fee,
    ...(input.etaMinutes != null ? { _eta_minutes: input.etaMinutes } : {}),
    ...(input.note ? { _note: input.note } : {}),
  });
  if (error) throw error;
}

export async function advanceErrand(requestId: string, to: ErrandStatus): Promise<void> {
  const { error } = await supabase.rpc("mkt_errand_advance", {
    _request_id: requestId,
    _to_status: to,
  });
  if (error) throw error;
}

/** إبطال كل ما يخصّ طلبًا واحدًا بعد أي عملية. */
export function useInvalidateErrand() {
  const queryClient = useQueryClient();
  return (requestId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["mkt", "my-errands"] });
    void queryClient.invalidateQueries({ queryKey: ["mkt", "errand-captain-queue"] });
    if (requestId) {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "errand", requestId] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "errand-offers", requestId] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "errand-events", requestId] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "errand-contact", requestId] });
    }
  };
}
