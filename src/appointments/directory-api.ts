import { supabase } from "@/integrations/supabase/client";

import type { PublicProvider } from "./api";

export type ProviderType =
  | "medical_center"
  | "clinic"
  | "pharmacy"
  | "laboratory"
  | "dental"
  | "radiology"
  | "physiotherapy"
  | "home_care"
  | "veterinary"
  | "beauty_wellness"
  | "consulting"
  | "other";

export interface DirectoryProvider extends PublicProvider {
  provider_type: ProviderType;
  accepts_bookings: boolean;
  distance_km?: number | null;
  market_profile_path?: string | null;
}

export interface ProviderLocationFields {
  provider_type: ProviderType;
  latitude: number | null;
  longitude: number | null;
  location_confirmed_at: string | null;
  location_accuracy_meters: number | null;
}

const callRpc = supabase.rpc as unknown as (
  functionName: string,
  params?: Record<string, unknown>,
) => PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

async function rpc<T>(functionName: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await callRpc(functionName, params);
  if (error) throw error;
  return data as T;
}

export function getNearbyDirectory(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  providerType?: ProviderType | null;
  query?: string;
  limit?: number;
}) {
  return rpc<DirectoryProvider[]>("appt_nearby_directory", {
    _latitude: input.latitude,
    _longitude: input.longitude,
    _radius_km: input.radiusKm,
    _provider_type: input.providerType ?? null,
    _q: input.query?.trim() || null,
    _limit: input.limit ?? 30,
  });
}

export function saveProviderLocation(input: {
  providerId: string;
  providerType: ProviderType;
  city?: string;
  district?: string;
  addressText?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  clearLocation?: boolean;
}) {
  return rpc<ProviderLocationFields>("appt_save_provider_location", {
    _provider_id: input.providerId,
    _provider_type: input.providerType,
    _city: input.city?.trim() || null,
    _district: input.district?.trim() || null,
    _address_text: input.addressText?.trim() || null,
    _latitude: input.latitude ?? null,
    _longitude: input.longitude ?? null,
    _accuracy_meters:
      input.accuracyMeters == null ? null : Math.max(0, Math.round(input.accuracyMeters)),
    _clear_location: input.clearLocation === true,
  });
}

export const providerTypes: ProviderType[] = [
  "medical_center",
  "clinic",
  "pharmacy",
  "laboratory",
  "dental",
  "radiology",
  "physiotherapy",
  "home_care",
  "veterinary",
  "beauty_wellness",
  "consulting",
  "other",
];

export function providerTypeLabel(type: ProviderType, locale: "ar" | "en") {
  const labels: Record<ProviderType, [string, string]> = {
    medical_center: ["مركز طبي", "Medical center"],
    clinic: ["عيادة", "Clinic"],
    pharmacy: ["صيدلية", "Pharmacy"],
    laboratory: ["مختبر", "Laboratory"],
    dental: ["أسنان", "Dental"],
    radiology: ["أشعة", "Radiology"],
    physiotherapy: ["علاج طبيعي", "Physiotherapy"],
    home_care: ["رعاية منزلية", "Home care"],
    veterinary: ["بيطري", "Veterinary"],
    beauty_wellness: ["عناية وجمال", "Beauty & wellness"],
    consulting: ["استشارات", "Consulting"],
    other: ["خدمات أخرى", "Other services"],
  };
  return labels[type][locale === "ar" ? 0 : 1];
}

export function marketProfileUrl(baseUrl: string, path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return baseUrl;
  if (baseUrl === "/") return path;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
