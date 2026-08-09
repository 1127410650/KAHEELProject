// Saved delivery / browsing addresses for the signed-in user. Every read and
// write goes through RLS: the table only ever exposes `user_id = auth.uid()`.
import { supabase } from "@/integrations/supabase/client";

export interface MktUserAddress {
  id: string;
  label: string;
  country_id: string | null;
  city_id: string | null;
  district: string | null;
  details: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  is_default: boolean;
  created_at: string;
}

export const ADDRESS_COLUMNS =
  "id, label, country_id, city_id, district, details, lat, lng, source, is_default, created_at";

export async function loadMyAddresses(): Promise<MktUserAddress[]> {
  const { data, error } = await supabase
    .from("mkt_user_addresses")
    .select(ADDRESS_COLUMNS)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MktUserAddress[];
}

export interface NewAddressInput {
  label: string;
  countryId: string | null;
  cityId: string | null;
  district?: string;
  details?: string;
  lat?: number | null;
  lng?: number | null;
  source?: "manual" | "device";
  isDefault?: boolean;
}

/** Clear Arabic validation messages; the UI shows them as-is. */
export function addressInputError(input: NewAddressInput): string | null {
  if (input.label.trim().length < 2) return "اكتب اسمًا مختصرًا للعنوان (مثل: البيت).";
  if (input.label.trim().length > 40) return "اسم العنوان طويل — 40 حرفًا كحد أقصى.";
  if (!input.cityId) return "اختر المدينة.";
  if ((input.district ?? "").length > 60) return "اسم الحي طويل — 60 حرفًا كحد أقصى.";
  if ((input.details ?? "").length > 300) return "الوصف طويل — 300 حرف كحد أقصى.";
  return null;
}

export async function saveMyAddress(input: NewAddressInput): Promise<MktUserAddress> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error("AUTH_REQUIRED");

  const { data, error } = await supabase
    .from("mkt_user_addresses")
    .insert({
      user_id: userId,
      label: input.label.trim(),
      country_id: input.countryId,
      city_id: input.cityId,
      district: input.district?.trim() || null,
      details: input.details?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      source: input.source ?? "manual",
      is_default: input.isDefault ?? false,
    })
    .select(ADDRESS_COLUMNS)
    .single();
  if (error) throw error;
  return data as MktUserAddress;
}

export async function setDefaultAddress(id: string): Promise<void> {
  const { error } = await supabase
    .from("mkt_user_addresses")
    .update({ is_default: true })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMyAddress(id: string): Promise<void> {
  const { error } = await supabase.from("mkt_user_addresses").delete().eq("id", id);
  if (error) throw error;
}

export interface DeviceCoords {
  lat: number;
  lng: number;
}

/** GPS lookup with an Arabic reason when the browser or the user declines. */
export function requestDeviceLocation(): Promise<DeviceCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("الجهاز لا يدعم تحديد الموقع."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("تعذّر تحديد الموقع — تأكد من السماح بالوصول للموقع.")),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
