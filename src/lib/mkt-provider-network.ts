import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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

export type ProviderCapability =
  | "catalog.products"
  | "catalog.services"
  | "orders.receive"
  | "bookings.receive"
  | "delivery.request"
  | "delivery.provide"
  | "jobs.receive"
  | "quotes.receive"
  | "listings.publish"
  | "relationships.manage"
  | "integrations.manage";

export interface ProviderCategory {
  code: string;
  parent_code: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string;
  default_store_type: "restaurant" | "retail" | "services" | "mixed";
  default_theme_id: string;
  capabilities: ProviderCapability[];
  requires_professional_license: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface ProviderProfileContext {
  storefront_id: string;
  store_slug: string;
  store_name: string;
  store_type: string;
  store_status: string;
  profile: {
    category_code: string;
    headline_ar: string | null;
    headline_en: string | null;
    accepts_partner_requests: boolean;
    status: string;
  } | null;
  category: {
    code: string;
    name_ar: string;
    name_en: string;
    capabilities: ProviderCapability[];
    requires_professional_license: boolean;
  } | null;
}

export interface ProviderDirectoryItem {
  storefront_id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  logo_path: string | null;
  verification_status: string;
  city_name_ar: string | null;
  city_name_en: string | null;
  category_code: string;
  category_name_ar: string;
  category_name_en: string;
  headline_ar: string | null;
  headline_en: string | null;
  capabilities: ProviderCapability[];
  accepts_partner_requests: boolean;
}

export type ProviderRelationType =
  | "delivery_partner"
  | "supplier"
  | "subcontractor"
  | "service_partner"
  | "referral_partner"
  | "integration_partner";

export interface ProviderRelation {
  id: string;
  direction: "incoming" | "outgoing";
  relation_type: ProviderRelationType;
  status: "pending" | "active" | "rejected" | "paused" | "ended";
  scopes: string[];
  request_message: string | null;
  response_note: string | null;
  other_storefront_id: string;
  other_store_slug: string;
  other_store_name: string;
  other_category_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCatalogItem {
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  integration_kind: string;
  supported_directions: ("inbound" | "outbound" | "bidirectional")[];
  is_active: boolean;
  sort_order: number;
}

export interface ExternalIntegration {
  id: string;
  storefront_id: string;
  integration_code: string;
  display_name: string;
  direction: "inbound" | "outbound" | "bidirectional";
  status: "draft" | "active" | "paused" | "error" | "revoked";
  config_public: Record<string, unknown>;
  credentials_state: "missing" | "ready" | "rotation_required" | "revoked";
  last_connected_at: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingCommerceAction {
  action_kind: "book" | "open_store";
  storefront_id: string;
  store_slug: string;
  store_name_ar: string;
  store_name_en: string | null;
  item_id: string;
  item_type: string;
  item_name_ar: string;
  item_name_en: string | null;
  target_path: string;
}

export function useProviderCategories() {
  return useQuery({
    queryKey: ["mkt", "provider-categories"],
    staleTime: 15 * 60_000,
    queryFn: () => rpc<ProviderCategory[]>("mkt_provider_categories_public"),
  });
}

export function useProviderProfile(accountKey: string | null) {
  return useQuery({
    queryKey: ["mkt", "provider-profile", accountKey],
    enabled: !!accountKey,
    staleTime: 10_000,
    queryFn: () =>
      rpc<ProviderProfileContext | null>("mkt_provider_profile_context", {
        _account_key: accountKey!,
      }),
  });
}

export function saveProviderProfile(input: {
  accountKey: string;
  categoryCode: string;
  headlineAr?: string;
  headlineEn?: string;
  acceptsPartnerRequests?: boolean;
}) {
  return rpc<ProviderProfileContext>("mkt_provider_profile_save", {
    _account_key: input.accountKey,
    _category_code: input.categoryCode,
    _headline_ar: input.headlineAr?.trim() || null,
    _headline_en: input.headlineEn?.trim() || null,
    _accepts_partner_requests: input.acceptsPartnerRequests ?? true,
  });
}

export function useProviderDirectory(query: string, categoryCode: string | null) {
  return useQuery({
    queryKey: ["mkt", "provider-directory", query, categoryCode],
    staleTime: 20_000,
    queryFn: () =>
      rpc<ProviderDirectoryItem[]>("mkt_provider_directory", {
        _q: query.trim() || null,
        _category_code: categoryCode || null,
        _limit: 50,
      }),
  });
}

export function useProviderRelations(accountKey: string | null, enabled = true) {
  return useQuery({
    queryKey: ["mkt", "provider-relations", accountKey],
    enabled: !!accountKey && enabled,
    staleTime: 10_000,
    queryFn: () =>
      rpc<ProviderRelation[]>("mkt_provider_relations_list", {
        _account_key: accountKey!,
      }),
  });
}

export function requestProviderRelation(input: {
  accountKey: string;
  targetStorefrontId: string;
  relationType: ProviderRelationType;
  message?: string;
  scopes?: string[];
}) {
  return rpc<string>("mkt_provider_relation_request", {
    _account_key: input.accountKey,
    _target_storefront_id: input.targetStorefrontId,
    _relation_type: input.relationType,
    _message: input.message?.trim() || null,
    _scopes: input.scopes ?? [],
  });
}

export function respondProviderRelation(input: {
  accountKey: string;
  relationId: string;
  action: "accept" | "reject" | "pause" | "resume" | "end";
  note?: string;
}) {
  return rpc<null>("mkt_provider_relation_respond", {
    _account_key: input.accountKey,
    _relation_id: input.relationId,
    _action: input.action,
    _note: input.note?.trim() || null,
  });
}

export function useIntegrationCatalog(enabled = true) {
  return useQuery({
    queryKey: ["mkt", "integration-catalog"],
    enabled,
    staleTime: 15 * 60_000,
    queryFn: () => rpc<IntegrationCatalogItem[]>("mkt_integration_catalog_public"),
  });
}

export function useExternalIntegrations(accountKey: string | null, enabled = true) {
  return useQuery({
    queryKey: ["mkt", "external-integrations", accountKey],
    enabled: !!accountKey && enabled,
    staleTime: 10_000,
    queryFn: () =>
      rpc<ExternalIntegration[]>("mkt_external_integrations_list", {
        _account_key: accountKey!,
      }),
  });
}

export function saveExternalIntegration(input: {
  accountKey: string;
  integrationId?: string | null;
  integrationCode: string;
  displayName: string;
  direction: "inbound" | "outbound" | "bidirectional";
  configPublic?: Record<string, unknown>;
}) {
  return rpc<string>("mkt_external_integration_save", {
    _account_key: input.accountKey,
    _integration_id: input.integrationId ?? null,
    _integration_code: input.integrationCode,
    _display_name: input.displayName.trim(),
    _direction: input.direction,
    _config_public: input.configPublic ?? {},
  });
}

export function useListingCommerceAction(listingId: string | null) {
  return useQuery({
    queryKey: ["mkt", "listing-commerce-action", listingId],
    enabled: !!listingId,
    staleTime: 30_000,
    queryFn: () =>
      rpc<ListingCommerceAction | null>("mkt_listing_commerce_action", {
        _listing_id: listingId!,
      }),
  });
}

export function providerNetworkError(error: unknown, locale: "ar" | "en") {
  const message = String((error as { message?: string } | null)?.message ?? error ?? "");
  const known = [
    "provider_category_invalid",
    "provider_profile_required",
    "target_provider_unavailable",
    "relation_self_forbidden",
    "relation_action_forbidden",
    "relation_capability_mismatch",
    "integration_secret_forbidden",
    "integration_not_supported",
  ].find((key) => message.includes(key));
  const ar: Record<string, string> = {
    provider_category_invalid: "اختر فئة حساب صحيحة.",
    provider_profile_required: "أكمل نوع حساب المتجر أولًا.",
    target_provider_unavailable: "مقدم الخدمة لا يستقبل طلبات ربط حاليًا.",
    relation_self_forbidden: "لا يمكن ربط المتجر بنفسه.",
    relation_action_forbidden: "هذا الإجراء غير مسموح لهذا الحساب.",
    relation_capability_mismatch: "فئة هذا المتجر لا تدعم طلب ناقلين.",
    integration_secret_forbidden: "لا تضع كلمات مرور أو مفاتيح سرية في الإعدادات العامة.",
    integration_not_supported: "نوع أو اتجاه التكامل غير مدعوم.",
  };
  const en: Record<string, string> = {
    provider_category_invalid: "Choose a valid account category.",
    provider_profile_required: "Complete the store account type first.",
    target_provider_unavailable: "This provider is not accepting link requests.",
    relation_self_forbidden: "A store cannot link to itself.",
    relation_action_forbidden: "This action is not allowed for the active account.",
    relation_capability_mismatch: "This store category cannot request carriers.",
    integration_secret_forbidden: "Do not place passwords or secret keys in public settings.",
    integration_not_supported: "This integration type or direction is not supported.",
  };
  return known
    ? locale === "ar"
      ? ar[known]
      : en[known]
    : locale === "ar"
      ? "تعذّر إكمال العملية. حاول مرة أخرى."
      : "The action could not be completed.";
}
