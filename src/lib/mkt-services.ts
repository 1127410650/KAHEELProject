/**
 * Service marketplace client.
 *
 * The browser never writes booking tables directly. Every mutation goes through
 * a SECURITY DEFINER RPC that derives the user and storefront server-side, while
 * the active account key is revalidated against `mkt_account_context`.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { resolveMedia } from "@/lib/mkt";

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

const callRpc = supabase.rpc as unknown as (
  functionName: string,
  params?: Record<string, unknown>,
) => RpcResult;

async function rpcJson<T>(functionName: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await callRpc(functionName, params);
  if (error) throw error;
  return data as T;
}

export type ServiceMode = "at_provider" | "at_customer" | "remote";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "en_route"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled_by_customer"
  | "cancelled_by_provider"
  | "no_show";

export interface ServiceCategory {
  code: string;
  name_ar: string;
  name_en: string;
  icon: string;
  color: string;
}

export interface ServiceDirectoryItem {
  storefront_id: string;
  slug: string;
  store_name_ar: string;
  store_name_en: string | null;
  logo_path: string | null;
  cover_path: string | null;
  verification_status: string;
  city_id: string | null;
  city_name_ar: string | null;
  city_name_en: string | null;
  category_code: string;
  service_modes: ServiceMode[];
  confirmation_mode: "instant" | "manual";
  item_id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  base_price: number;
  compare_at_price: number | null;
  currency_code: string;
  image_path: string | null;
  duration_minutes: number;
  is_featured: boolean;
  rating: number;
  reviews_count: number;
  completed_count: number;
  media: Record<string, string>;
}

export interface ServiceProfessional {
  id: string;
  display_name: string;
  title: string | null;
  bio: string | null;
  avatar_path: string | null;
  is_primary: boolean;
}

export interface ServiceBookingContext {
  store: {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string | null;
    logo_path: string | null;
    cover_path: string | null;
    city_id: string | null;
    district: string | null;
    verification_status: string;
  };
  service: {
    id: string;
    name_ar: string;
    name_en: string | null;
    description_ar: string | null;
    description_en: string | null;
    base_price: number;
    compare_at_price: number | null;
    currency_code: string;
    image_path: string | null;
    duration_minutes: number;
  };
  settings: {
    timezone: string;
    confirmation_mode: "instant" | "manual";
    service_modes: ServiceMode[];
    visit_fee: number;
    min_notice_minutes: number;
    max_advance_days: number;
    cancellation_window_hours: number;
  };
  professionals: ServiceProfessional[];
  rating: number;
  reviews_count: number;
  media: Record<string, string>;
}

export interface ServiceSlot {
  professional_id: string;
  professional_name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
}

export interface ServiceBooking {
  id: string;
  booking_number: string;
  storefront_id: string;
  store_slug: string;
  store_name: string;
  store_logo_path: string | null;
  service_item_id: string;
  service_name: string;
  professional_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  service_mode: ServiceMode;
  status: BookingStatus;
  cancellation_window_hours: number;
  total: number;
  currency_code: string;
  address_text: string | null;
  district: string | null;
  customer_notes: string | null;
  provider_notes: string | null;
  created_at: string;
}

export interface ProviderSetup {
  storefront_id: string;
  store_slug: string;
  store_name: string;
  store_status: string;
  settings: {
    storefront_id: string;
    category_code: string;
    timezone: string;
    confirmation_mode: "instant" | "manual";
    min_notice_minutes: number;
    max_advance_days: number;
    slot_interval_minutes: number;
    buffer_minutes: number;
    cancellation_window_hours: number;
    service_modes: ServiceMode[];
    visit_fee: number;
    accepts_bookings: boolean;
  };
  professionals: (ServiceProfessional & { accepts_bookings: boolean })[];
  availability: {
    id: string;
    professional_id: string;
    weekday: number;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
  }[];
  stats: { pending: number; today: number; upcoming: number; completed: number };
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["mkt", "service-categories"],
    staleTime: 15 * 60_000,
    queryFn: () => rpcJson<ServiceCategory[]>("mkt_service_categories_public"),
  });
}

export function useServiceDirectory(filters: {
  q?: string;
  categoryCode?: string | null;
  cityId?: string | null;
}) {
  return useQuery({
    queryKey: ["mkt", "service-directory", filters.q ?? "", filters.categoryCode, filters.cityId],
    staleTime: 30_000,
    queryFn: async (): Promise<ServiceDirectoryItem[]> => {
      const rows = await rpcJson<ServiceDirectoryItem[]>("mkt_service_directory", {
        _q: filters.q?.trim() || null,
        _category_code: filters.categoryCode || null,
        _city_id: filters.cityId || null,
        _limit: 40,
      });
      const paths = rows.flatMap((row) => [row.image_path, row.logo_path, row.cover_path]);
      const media = await resolveMedia(paths);
      return rows.map((row) => ({ ...row, media }));
    },
  });
}

export function useServiceBookingContext(slug: string, itemId: string) {
  return useQuery({
    queryKey: ["mkt", "service-booking-context", slug, itemId],
    enabled: !!slug && !!itemId,
    staleTime: 30_000,
    queryFn: async (): Promise<ServiceBookingContext | null> => {
      const context = await rpcJson<Omit<ServiceBookingContext, "media"> | null>(
        "mkt_service_booking_context",
        { _store_slug: slug, _service_item_id: itemId },
      );
      if (!context) return null;
      const media = await resolveMedia([
        context.store.logo_path,
        context.store.cover_path,
        context.service.image_path,
        ...context.professionals.map((professional) => professional.avatar_path),
      ]);
      return { ...context, media };
    },
  });
}

export function useServiceSlots(itemId: string, date: string, professionalId: string | null) {
  return useQuery({
    queryKey: ["mkt", "service-slots", itemId, date, professionalId],
    enabled: !!itemId && /^\d{4}-\d{2}-\d{2}$/.test(date),
    staleTime: 15_000,
    queryFn: () =>
      rpcJson<ServiceSlot[]>("mkt_service_slots", {
        _service_item_id: itemId,
        _date: date,
        _professional_id: professionalId,
      }),
  });
}

export interface CreateServiceBookingInput {
  accountKey: string;
  serviceItemId: string;
  startsAt: string;
  professionalId: string | null;
  serviceMode: ServiceMode;
  customerPhone?: string;
  addressText?: string;
  district?: string;
  notes?: string;
  idempotencyKey: string;
}

export function createServiceBooking(input: CreateServiceBookingInput) {
  return rpcJson<Record<string, unknown>>("mkt_service_create_booking", {
    _account_key: input.accountKey,
    _service_item_id: input.serviceItemId,
    _starts_at: input.startsAt,
    _professional_id: input.professionalId,
    _service_mode: input.serviceMode,
    _customer_phone: input.customerPhone?.trim() || null,
    _address_text: input.addressText?.trim() || null,
    _district: input.district?.trim() || null,
    _latitude: null,
    _longitude: null,
    _notes: input.notes?.trim() || null,
    _idempotency_key: input.idempotencyKey,
  });
}

export function useServiceBookings(
  accountKey: string | null,
  side: "customer" | "provider",
  status?: BookingStatus | null,
) {
  return useQuery({
    queryKey: ["mkt", "service-bookings", accountKey, side, status ?? null],
    enabled: !!accountKey,
    staleTime: 10_000,
    queryFn: () =>
      rpcJson<ServiceBooking[]>("mkt_service_bookings_list", {
        _account_key: accountKey,
        _side: side,
        _status: status || null,
        _limit: 100,
      }),
  });
}

export function serviceBookingAction(
  bookingId: string,
  accountKey: string,
  action: BookingStatus,
  note?: string,
) {
  return rpcJson<Record<string, unknown>>("mkt_service_booking_action", {
    _booking_id: bookingId,
    _account_key: accountKey,
    _action: action,
    _note: note?.trim() || null,
  });
}

export function useProviderSetup(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "service-provider-setup", accountKey],
    enabled: !!accountKey,
    staleTime: 10_000,
    queryFn: () =>
      rpcJson<ProviderSetup | null>("mkt_service_provider_setup", { _account_key: accountKey }),
  });
}

export function saveProviderSetup(
  accountKey: string,
  patch: Record<string, unknown>,
  availability?: { weekday: number; starts_at: string; ends_at: string; is_active: boolean }[],
) {
  return rpcJson<ProviderSetup>("mkt_service_provider_save", {
    _account_key: accountKey,
    _patch: patch,
    _availability: availability ?? null,
  });
}

export function serviceErrorMessage(error: unknown, locale: "ar" | "en"): string {
  const message = String((error as { message?: string })?.message ?? error ?? "");
  const key = [
    "slot_unavailable",
    "service_unavailable",
    "bookings_paused",
    "invalid_service_mode",
    "address_required",
    "auth_required",
    "invalid_transition",
    "cancellation_window_closed",
  ].find((candidate) => message.includes(candidate));
  const ar: Record<string, string> = {
    slot_unavailable: "هذا الموعد لم يعد متاحًا. اختر موعدًا آخر.",
    service_unavailable: "الخدمة غير متاحة للحجز حاليًا.",
    bookings_paused: "مقدم الخدمة أوقف استقبال الحجوزات مؤقتًا.",
    invalid_service_mode: "طريقة تقديم الخدمة غير متاحة.",
    address_required: "أدخل عنوان تنفيذ الخدمة.",
    auth_required: "سجّل الدخول لإكمال الحجز.",
    invalid_transition: "لا يمكن تنفيذ هذا الإجراء في حالة الحجز الحالية.",
    cancellation_window_closed: "انتهت مهلة الإلغاء الإلكتروني. تواصل مع مقدم الخدمة.",
  };
  const en: Record<string, string> = {
    slot_unavailable: "This slot is no longer available. Choose another time.",
    service_unavailable: "This service is not currently bookable.",
    bookings_paused: "The provider has temporarily paused bookings.",
    invalid_service_mode: "This service mode is unavailable.",
    address_required: "Enter the service address.",
    auth_required: "Sign in to complete the booking.",
    invalid_transition: "This action is not available for the current booking status.",
    cancellation_window_closed: "Online cancellation has closed. Contact the provider.",
  };
  const fallback =
    locale === "ar" ? "تعذّر إكمال العملية. حاول مرة أخرى." : "The action could not be completed.";
  return key ? ((locale === "ar" ? ar[key] : en[key]) ?? fallback) : fallback;
}
