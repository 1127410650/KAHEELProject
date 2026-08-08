import { supabase } from "@/integrations/supabase/client";

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

const callRpc = supabase.rpc as unknown as (
  functionName: string,
  params?: Record<string, unknown>,
) => RpcResult;

async function rpc<T>(functionName: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await callRpc(functionName, params);
  if (error) throw error;
  return data as T;
}

export type ProviderStatus = "draft" | "published" | "paused" | "suspended";
export type BookingMode = "scheduled" | "queue" | "both";
export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "in_service"
  | "completed"
  | "cancelled_by_customer"
  | "cancelled_by_provider"
  | "rejected"
  | "no_show";
export type QueueStatus = "waiting" | "called" | "serving" | "done" | "skipped" | "cancelled";

export interface AppointmentService {
  id: string;
  provider_id?: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  duration_minutes: number;
  price: number;
  currency_code: string;
  booking_mode: BookingMode;
  is_active?: boolean;
  sort_order?: number;
}

export interface PublicProvider {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  bio_ar: string | null;
  bio_en: string | null;
  logo_path: string | null;
  cover_path: string | null;
  city: string | null;
  district: string | null;
  address_text: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  created_at?: string;
  services: AppointmentService[];
  settings?: ProviderSettings;
}

export interface ProviderSettings {
  provider_id?: string;
  confirmation_mode: "instant" | "manual";
  min_notice_minutes: number;
  max_advance_days: number;
  cancellation_window_hours: number;
  queue_enabled: boolean;
  average_service_minutes: number;
}

export interface Slot {
  starts_at: string;
  ends_at: string;
  timezone: string;
}

export interface MyProvider {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  city: string | null;
  status: ProviderStatus;
  accepts_bookings: boolean;
  role: "owner" | "manager" | "staff";
  permissions: string[];
}

export interface CustomerAppointment {
  id: string;
  appointment_number: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  service_id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: AppointmentStatus;
  source: "web" | "mobile" | "market_link";
  customer_notes: string | null;
  provider_notes: string | null;
  created_at: string;
}

export interface CustomerQueue {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  service_id: string;
  service_name: string;
  queue_date: string;
  queue_number: number;
  status: QueueStatus;
  joined_at: string;
  waiting_ahead: number;
  estimated_wait_minutes: number;
}

export interface AppointmentProfile {
  user_id: string;
  display_name: string | null;
  phone_e164: string | null;
  locale: "ar" | "en";
  timezone: string;
}

export interface MyContext {
  profile: AppointmentProfile | null;
  provider_eligible: boolean;
  providers: MyProvider[];
  appointments: CustomerAppointment[];
  queues: CustomerQueue[];
}

export interface ProviderAppointment {
  id: string;
  appointment_number: string;
  service_id: string;
  service_name: string;
  customer_user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: AppointmentStatus;
  source: "web" | "mobile" | "market_link";
  customer_notes: string | null;
  provider_notes: string | null;
  created_at: string;
}

export interface ProviderQueue {
  id: string;
  service_id: string;
  service_name: string;
  customer_user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  queue_date: string;
  queue_number: number;
  status: QueueStatus;
  notes: string | null;
  joined_at: string;
  called_at: string | null;
  serving_at: string | null;
}

export interface AvailabilityRow {
  id?: string;
  provider_id?: string;
  service_id: string | null;
  weekday: number;
  starts_at: string;
  ends_at: string;
  slot_interval_minutes: number;
  is_active: boolean;
}

export interface MarketLink {
  provider_id: string;
  market_tenant_id: string | null;
  market_storefront_id: string | null;
  market_profile_path: string | null;
  market_url: string | null;
  status: "disconnected" | "pending" | "linked" | "disabled";
  linked_at: string | null;
}

export interface ProviderLocationSnapshot {
  provider_id: string;
  provider_type: string;
  latitude: number | null;
  longitude: number | null;
  location_confirmed_at: string | null;
  location_accuracy_meters: number | null;
}

export interface ProviderDashboard {
  provider: {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string | null;
    city: string | null;
    district: string | null;
    address_text: string | null;
    latitude: number | null;
    longitude: number | null;
    provider_type: string;
    location_confirmed_at: string | null;
    location_accuracy_meters: number | null;
    timezone: string;
    status: ProviderStatus;
    accepts_bookings: boolean;
  };
  settings: ProviderSettings;
  services: AppointmentService[];
  availability: AvailabilityRow[];
  appointments: ProviderAppointment[];
  queue: ProviderQueue[];
  stats: {
    today_total: number;
    pending: number;
    active_queue: number;
    completed: number;
  };
  market_link: MarketLink | null;
}

export function getPublicDirectory(filters: { q?: string; city?: string; limit?: number }) {
  return rpc<PublicProvider[]>("appt_public_directory", {
    _q: filters.q?.trim() || null,
    _city: filters.city?.trim() || null,
    _limit: filters.limit ?? 30,
  });
}

export function getPublicProvider(slug: string) {
  return rpc<PublicProvider | null>("appt_public_provider", { _slug: slug });
}

export function getAvailableSlots(providerId: string, serviceId: string, date: string) {
  return rpc<Slot[]>("appt_available_slots", {
    _provider_id: providerId,
    _service_id: serviceId,
    _date: date,
  });
}

export async function getMyContext(): Promise<MyContext> {
  const [context, profile, providerEligible] = await Promise.all([
    rpc<Omit<MyContext, "profile" | "provider_eligible"> & { profile: AppointmentProfile | null }>(
      "appt_my_context",
    ),
    rpc<AppointmentProfile | null>("appt_verified_profile"),
    rpc<boolean>("appt_has_market_account"),
  ]);

  return {
    ...context,
    profile,
    provider_eligible: providerEligible,
  };
}

export function completeAppointmentProfile(displayName: string) {
  return rpc<AppointmentProfile>("appt_complete_phone_profile", {
    _display_name: displayName.trim(),
  });
}

export function createProvider(input: {
  nameAr: string;
  nameEn?: string;
  slug?: string;
  city?: string;
  timezone?: string;
}) {
  return rpc<string>("appt_create_provider", {
    _name_ar: input.nameAr.trim(),
    _name_en: input.nameEn?.trim() || null,
    _slug: input.slug?.trim() || null,
    _city: input.city?.trim() || null,
    _timezone: input.timezone?.trim() || "Asia/Riyadh",
  });
}

export async function getProviderDashboard(
  providerId: string,
  date?: string,
): Promise<ProviderDashboard> {
  const [dashboard, location] = await Promise.all([
    rpc<ProviderDashboard>("appt_provider_dashboard", {
      _provider_id: providerId,
      _date: date || null,
    }),
    rpc<ProviderLocationSnapshot>("appt_provider_location_context", {
      _provider_id: providerId,
    }),
  ]);

  return {
    ...dashboard,
    provider: {
      ...dashboard.provider,
      latitude: location.latitude,
      longitude: location.longitude,
      provider_type: location.provider_type,
      location_confirmed_at: location.location_confirmed_at,
      location_accuracy_meters: location.location_accuracy_meters,
    },
  };
}

export function saveProvider(
  providerId: string,
  patch: Record<string, unknown>,
  settings?: Partial<ProviderSettings>,
) {
  return rpc<ProviderDashboard>("appt_save_provider", {
    _provider_id: providerId,
    _patch: patch,
    _settings: settings ?? null,
  });
}

export function saveService(
  providerId: string,
  serviceId: string | null,
  patch: Record<string, unknown>,
) {
  return rpc<string>("appt_save_service", {
    _provider_id: providerId,
    _service_id: serviceId,
    _patch: patch,
  });
}

export function replaceAvailability(providerId: string, rows: AvailabilityRow[]) {
  return rpc<number>("appt_replace_availability", {
    _provider_id: providerId,
    _rows: rows,
  });
}

export function createAppointment(input: {
  providerId: string;
  serviceId: string;
  startsAt: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  source?: "web" | "mobile" | "market_link";
  idempotencyKey: string;
}) {
  return rpc<Record<string, unknown>>("appt_create_appointment", {
    _provider_id: input.providerId,
    _service_id: input.serviceId,
    _starts_at: input.startsAt,
    _customer_name: input.customerName?.trim() || null,
    _customer_phone: input.customerPhone?.trim() || null,
    _notes: input.notes?.trim() || null,
    _source: input.source ?? "web",
    _idempotency_key: input.idempotencyKey,
  });
}

export function appointmentAction(appointmentId: string, action: AppointmentStatus, note?: string) {
  return rpc<Record<string, unknown>>("appt_appointment_action", {
    _appointment_id: appointmentId,
    _action: action,
    _note: note?.trim() || null,
  });
}

export function joinQueue(input: {
  providerId: string;
  serviceId: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}) {
  return rpc<CustomerQueue>("appt_join_queue", {
    _provider_id: input.providerId,
    _service_id: input.serviceId,
    _customer_name: input.customerName?.trim() || null,
    _customer_phone: input.customerPhone?.trim() || null,
    _notes: input.notes?.trim() || null,
  });
}

export function queueAction(queueEntryId: string, action: QueueStatus, note?: string) {
  return rpc<Record<string, unknown>>("appt_queue_action", {
    _queue_entry_id: queueEntryId,
    _action: action,
    _note: note?.trim() || null,
  });
}

export function saveMarketLink(input: {
  providerId: string;
  marketTenantId?: string;
  marketStorefrontId?: string;
  marketProfilePath?: string;
  marketUrl?: string;
  status: MarketLink["status"];
}) {
  return rpc<MarketLink>("appt_save_market_link", {
    _provider_id: input.providerId,
    _market_tenant_id: input.marketTenantId?.trim() || null,
    _market_storefront_id: input.marketStorefrontId?.trim() || null,
    _market_profile_path: input.marketProfilePath?.trim() || null,
    _market_url: input.marketUrl?.trim() || null,
    _status: input.status,
  });
}

export function appointmentErrorMessage(error: unknown, locale: "ar" | "en") {
  const message = String((error as { message?: string })?.message ?? error ?? "");
  const key = [
    "auth_required",
    "appointment_profile_required",
    "phone_not_verified",
    "phone_already_linked",
    "profile_name_required",
    "provider_registration_required",
    "provider_unavailable",
    "provider_not_found",
    "service_unavailable",
    "service_not_found",
    "slot_unavailable",
    "notice_too_short",
    "advance_limit_exceeded",
    "queue_disabled",
    "queue_service_unavailable",
    "invalid_provider_type",
    "invalid_location",
    "invalid_transition",
    "cancellation_window_closed",
    "forbidden",
  ].find((candidate) => message.includes(candidate));

  const ar: Record<string, string> = {
    auth_required: "سجّل الدخول لإكمال العملية.",
    appointment_profile_required: "تحقق من رقم جوالك أولًا لإكمال الحجز.",
    phone_not_verified: "لم يكتمل توثيق رقم الجوال.",
    phone_already_linked: "رقم الجوال مرتبط بحساب مواعيد آخر.",
    profile_name_required: "أدخل الاسم الكامل بشكل صحيح.",
    provider_registration_required: "تسجيل مقدم الخدمة يبدأ من حساب سوق كَحيل.",
    provider_unavailable: "مقدم الخدمة غير متاح حاليًا.",
    provider_not_found: "لم يتم العثور على مقدم الخدمة.",
    service_unavailable: "الخدمة غير متاحة للحجز حاليًا.",
    service_not_found: "لم يتم العثور على الخدمة.",
    slot_unavailable: "هذا الموعد لم يعد متاحًا. اختر وقتًا آخر.",
    notice_too_short: "الموعد قريب جدًا وفق إعدادات مقدم الخدمة.",
    advance_limit_exceeded: "الموعد يتجاوز أقصى مدة للحجز المسبق.",
    queue_disabled: "قائمة الانتظار متوقفة حاليًا.",
    queue_service_unavailable: "هذه الخدمة لا تدعم الانتظار المباشر.",
    invalid_provider_type: "نوع الجهة غير صالح.",
    invalid_location: "بيانات موقع المنشأة غير صحيحة.",
    invalid_transition: "لا يمكن تنفيذ هذا الإجراء في الحالة الحالية.",
    cancellation_window_closed: "انتهت مهلة الإلغاء الإلكتروني.",
    forbidden: "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
  };
  const en: Record<string, string> = {
    auth_required: "Sign in to continue.",
    appointment_profile_required: "Verify your mobile number before booking.",
    phone_not_verified: "The mobile number has not been verified.",
    phone_already_linked: "This mobile number is linked to another appointments account.",
    profile_name_required: "Enter a valid full name.",
    provider_registration_required: "Provider registration starts with a KAHEEL Market account.",
    provider_unavailable: "The provider is currently unavailable.",
    provider_not_found: "Provider not found.",
    service_unavailable: "The service is not currently bookable.",
    service_not_found: "Service not found.",
    slot_unavailable: "This time is no longer available. Choose another slot.",
    notice_too_short: "This appointment is too soon for the provider's notice settings.",
    advance_limit_exceeded: "This date exceeds the provider's advance booking limit.",
    queue_disabled: "The live queue is currently paused.",
    queue_service_unavailable: "This service does not support the live queue.",
    invalid_provider_type: "The provider type is invalid.",
    invalid_location: "The provider location is invalid.",
    invalid_transition: "This action is unavailable in the current state.",
    cancellation_window_closed: "The online cancellation window has closed.",
    forbidden: "You do not have permission to perform this action.",
  };
  const fallback =
    locale === "ar" ? "تعذّر إكمال العملية. حاول مرة أخرى." : "The action could not be completed.";
  return key ? ((locale === "ar" ? ar[key] : en[key]) ?? fallback) : fallback;
}
