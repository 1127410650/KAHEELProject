import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";
import type { ProviderCapability } from "@/lib/mkt-provider-network";

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message?: string; code?: string } | null;
}>;

const callRpc = supabase.rpc as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResult;

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await callRpc(name, params);
  if (error) throw error;
  return data as T;
}

export type JoinApplicationKind = "seller" | "service_provider" | "delivery_team" | "platform_team";

export type JoinApplicationStatus =
  "pending" | "in_review" | "needs_more" | "approved" | "rejected" | "withdrawn";

export interface JoinApplication {
  id: string;
  application_number: string;
  application_kind: JoinApplicationKind;
  tenant_id: string | null;
  tenant_name: string | null;
  provider_category_code: string | null;
  provider_category_name_ar: string | null;
  provider_category_name_en: string | null;
  status: JoinApplicationStatus;
  payload: Record<string, unknown>;
  decision_reason: string | null;
  documents_count: number;
  account_key: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface OperationalAccess {
  allowed: boolean;
  account_kind: "individual" | "business";
  operational_kind: "customer" | "seller" | "service_provider" | "delivery_team" | "platform_team";
  application_status: string;
  storefront_id: string | null;
  store_slug?: string | null;
  store_status?: string | null;
  category_code: string | null;
  category_name_ar: string | null;
  category_name_en: string | null;
  capabilities: (ProviderCapability | "platform.work")[];
}

export interface OperationsOverview extends OperationalAccess {
  orders_pending: number;
  orders_active: number;
  orders_completed: number;
  bookings_pending: number;
  bookings_today: number;
  catalog_items: number;
  published_listings: number;
  active_promotions: number;
  active_integrations: number;
}

export interface MerchantOrder {
  id: string;
  order_number: string;
  order_status:
    | "submitted"
    | "accepted"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "completed"
    | "rejected"
    | "cancelled";
  fulfillment_type: "pickup" | "merchant_delivery" | "platform_delivery";
  payment_method: string;
  payment_status: string;
  total: number;
  currency_code: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_district: string | null;
  delivery_address_text: string | null;
  customer_notes: string | null;
  merchant_notes: string | null;
  items_count: number;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
}

export interface AdminJoinApplication {
  id: string;
  application_number: string;
  application_kind: JoinApplicationKind;
  applicant_user_id: string;
  applicant_name: string;
  tenant_id: string | null;
  tenant_name: string | null;
  provider_category_code: string | null;
  provider_category_name: string | null;
  status: JoinApplicationStatus;
  payload: Record<string, unknown>;
  decision_reason: string | null;
  documents_count: number;
  created_at: string;
  reviewed_at: string | null;
}

export interface AdminJoinDocument {
  id: string;
  document_kind: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export function useMyJoinApplications(enabled = true) {
  return useQuery({
    queryKey: ["mkt", "join-applications", "mine"],
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: () => rpc<JoinApplication[]>("mkt_my_join_applications"),
  });
}

export function submitJoinApplication(input: {
  kind: JoinApplicationKind;
  tenantId?: string | null;
  providerCategoryCode?: string | null;
  payload: Record<string, unknown>;
}) {
  return rpc<string>("mkt_join_application_submit", {
    _application_kind: input.kind,
    _tenant_id: input.tenantId ?? null,
    _provider_category_code: input.providerCategoryCode ?? null,
    _payload: input.payload,
  });
}

export function prepareJoinWorkspace(input: {
  kind: "seller" | "service_provider";
  providerCategoryCode: string;
  nameAr: string;
  nameEn?: string | null;
  legalName: string;
  crNumber?: string | null;
  unifiedNumber?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  activity?: string | null;
}) {
  return rpc<string>("mkt_join_workspace_prepare", {
    _application_kind: input.kind,
    _provider_category_code: input.providerCategoryCode,
    _name_ar: input.nameAr,
    _name_en: input.nameEn ?? null,
    _legal_name: input.legalName,
    _cr_number: input.crNumber ?? null,
    _unified_number: input.unifiedNumber ?? null,
    _city: input.city ?? null,
    _phone: input.phone ?? null,
    _email: input.email ?? null,
    _activity: input.activity ?? null,
  });
}

export function finalizeJoinApplication(input: {
  applicationId: string;
  providerCategoryCode?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  return rpc<string>("mkt_join_application_finalize", {
    _application_id: input.applicationId,
    _provider_category_code: input.providerCategoryCode ?? null,
    _payload: input.payload ?? null,
  });
}

export function markJoinApplicationIncomplete(applicationId: string) {
  return rpc<null>("mkt_join_application_mark_incomplete", {
    _application_id: applicationId,
  });
}

const DOCUMENT_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function uploadJoinDocument(input: {
  applicationId: string;
  userId: string;
  kind:
    | "identity"
    | "license"
    | "vehicle"
    | "resume"
    | "authorization"
    | "commercial_registration"
    | "other";
  file: File;
}) {
  if (!DOCUMENT_MIME.has(input.file.type)) throw new Error("join_document_type_invalid");
  if (input.file.size <= 0 || input.file.size > 10 * 1024 * 1024)
    throw new Error("join_document_size_invalid");

  const fallback = input.file.type === "application/pdf" ? "pdf" : "jpg";
  const extension =
    input.file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || fallback;
  const path = `join-applications/${input.userId}/${input.applicationId}/${input.kind}-${crypto.randomUUID()}.${extension}`;
  const uploaded = await supabase.storage.from(MKT_BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploaded.error) throw uploaded.error;
  try {
    await rpc<string>("mkt_join_application_document_add", {
      _application_id: input.applicationId,
      _document_kind: input.kind,
      _storage_path: path,
      _file_name: input.file.name,
      _mime_type: input.file.type,
      _size_bytes: input.file.size,
    });
  } catch (error) {
    await supabase.storage.from(MKT_BUCKET).remove([path]);
    throw error;
  }
  return path;
}

export function useOperationalAccess(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "operational-access", accountKey],
    enabled: !!accountKey,
    staleTime: 10_000,
    queryFn: () => rpc<OperationalAccess>("mkt_operational_access", { _account_key: accountKey! }),
  });
}

export function useOperationsOverview(accountKey: string | null, enabled = true) {
  return useQuery({
    queryKey: ["mkt", "operations-overview", accountKey],
    enabled: !!accountKey && enabled,
    staleTime: 10_000,
    queryFn: () =>
      rpc<OperationsOverview>("mkt_provider_operations_overview", {
        _account_key: accountKey!,
      }),
  });
}

export function useMerchantOrders(
  accountKey: string | null,
  status: MerchantOrder["order_status"] | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["mkt", "merchant-orders", accountKey, status],
    enabled: !!accountKey && enabled,
    staleTime: 5_000,
    queryFn: () =>
      rpc<MerchantOrder[]>("mkt_merchant_orders_list", {
        _account_key: accountKey!,
        _status: status,
        _limit: 100,
      }),
  });
}

export function merchantOrderAction(input: {
  accountKey: string;
  orderId: string;
  action: "accept" | "reject" | "prepare" | "ready" | "dispatch" | "complete" | "cancel";
  note?: string;
}) {
  return rpc<string>("mkt_merchant_order_action", {
    _account_key: input.accountKey,
    _order_id: input.orderId,
    _action: input.action,
    _note: input.note?.trim() || null,
  });
}

export function useAdminJoinApplications(
  status: string | null,
  kind: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["mkt", "admin", "join-applications", status, kind],
    enabled,
    staleTime: 5_000,
    queryFn: () =>
      rpc<AdminJoinApplication[]>("mkt_admin_join_applications", {
        _status: status,
        _kind: kind,
        _limit: 100,
      }),
  });
}

export function loadAdminJoinDocuments(applicationId: string) {
  return rpc<AdminJoinDocument[]>("mkt_admin_join_documents", {
    _application_id: applicationId,
  });
}

export function reviewJoinApplication(input: {
  applicationId: string;
  action: "review" | "approve" | "needs_more" | "reject";
  reason?: string;
}) {
  return rpc<null>("mkt_admin_join_application_review", {
    _application_id: input.applicationId,
    _action: input.action,
    _reason: input.reason?.trim() || null,
  });
}

export function joinErrorMessage(error: unknown, locale: "ar" | "en") {
  const message = String((error as { message?: string } | null)?.message ?? error ?? "");
  const ar: Record<string, string> = {
    join_full_name_required: "اكتب الاسم الكامل.",
    join_phone_required: "اكتب رقم جوال صحيحًا.",
    join_vehicle_required: "اختر وسيلة التوصيل.",
    join_role_required: "حدد المجال الذي تريد الانضمام إليه.",
    join_tenant_owner_required: "يجب أن تكون مالك حساب العمل.",
    provider_category_invalid: "اختر نشاطًا صحيحًا.",
    seller_category_required: "اختر نشاطًا يبيع منتجات أو يستقبل طلبات.",
    service_category_required: "اختر نشاط خدمات مناسبًا.",
    join_document_type_invalid: "صيغة المستند غير مدعومة.",
    join_document_size_invalid: "حجم المستند يتجاوز 10 ميجابايت.",
    join_commercial_registration_required: "أرفق مستند السجل التجاري لإرسال الطلب.",
    join_delivery_license_required: "أرفق رخصة القيادة أو المستند الداعم.",
    join_application_not_editable: "لا يمكن تعديل هذا الطلب في مرحلته الحالية.",
    join_business_application_conflict: "يوجد طلب نشاط آخر مرتبط بحساب العمل.",
    DUPLICATE_REGISTRATION: "رقم السجل أو الرقم الموحد مستخدم مسبقًا.",
    WORKSPACE_LIMIT_REACHED: "لديك حساب عمل قائم بالفعل.",
    provider_access_required: "لا تتوفر صلاحية التشغيل قبل قبول طلب الانضمام.",
    orders_access_required: "إدارة الطلبات متاحة لحساب بائع مقبول فقط.",
    order_not_found: "الطلب غير موجود ضمن هذا المتجر.",
    order_transition_invalid: "لا يمكن نقل الطلب إلى هذه المرحلة.",
    order_reason_required: "اكتب سبب الرفض أو الإلغاء.",
  };
  const en: Record<string, string> = {
    join_full_name_required: "Enter the full name.",
    join_phone_required: "Enter a valid mobile number.",
    join_vehicle_required: "Choose a delivery vehicle.",
    join_role_required: "Choose the team area you want to join.",
    join_tenant_owner_required: "You must own the work account.",
    provider_category_invalid: "Choose a valid activity.",
    seller_category_required: "Choose a product-selling activity.",
    service_category_required: "Choose a service activity.",
    join_document_type_invalid: "Unsupported document format.",
    join_document_size_invalid: "The document exceeds 10 MB.",
    join_commercial_registration_required: "Attach the commercial-registration document.",
    join_delivery_license_required: "Attach a driver licence or supporting document.",
    join_application_not_editable: "This application cannot be edited at its current stage.",
    join_business_application_conflict: "Another business application is already linked.",
    DUPLICATE_REGISTRATION: "The registration or unified number is already in use.",
    WORKSPACE_LIMIT_REACHED: "You already have an existing work account.",
    provider_access_required: "Operational access is available after join approval.",
    orders_access_required: "Order management requires an approved seller account.",
    order_not_found: "This order does not belong to the active store.",
    order_transition_invalid: "The order cannot move to that stage.",
    order_reason_required: "Enter a reason for rejection or cancellation.",
  };
  const dictionary = locale === "ar" ? ar : en;
  const key = Object.keys(dictionary).find((candidate) => message.includes(candidate));
  return key
    ? dictionary[key]!
    : locale === "ar"
      ? "تعذر إكمال العملية."
      : "Could not complete the action.";
}
