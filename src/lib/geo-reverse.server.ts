// عكس الإحداثيات إلى عنوان مقروء عبر Nominatim (OpenStreetMap) — مجاني وبلا مفاتيح.
// يُنفَّذ على الخادم فقط: يضبط User-Agent المطلوب من Nominatim ويخفي أي تفاصيل
// شبكة عن المتصفح. لا يُخزَّن أي موقع — الاستدعاء عابر بالكامل.

export interface ReverseGeocodeResult {
  /** أفضل وصف مختصر للنقطة (شارع/حي إن توفر). */
  label: string;
  /** الحي أو الضاحية إن توفر. */
  district: string | null;
  /** المدينة/المحافظة كما يراها OSM. */
  city: string | null;
  /** رمز الدولة ISO-3166 alpha-2 بحروف كبيرة. */
  countryIso2: string | null;
  countryName: string | null;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  village?: string;
  town?: string;
  city?: string;
  state?: string;
  county?: string;
  country?: string;
  country_code?: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

export async function reverseGeocodeImpl(
  lat: number,
  lng: number,
  locale: "ar" | "en",
): Promise<ReverseGeocodeResult> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", locale === "en" ? "en" : "ar,en");

  const response = await fetch(url, {
    headers: {
      // Nominatim يطلب معرّفًا واضحًا للتطبيق.
      "User-Agent": "Kaheel Market (support@kaheel.sa)",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`NOMINATIM_${response.status}`);

  const payload = (await response.json()) as {
    address?: NominatimAddress;
    display_name?: string;
  };
  const address = payload.address ?? {};

  const district =
    address.neighbourhood ??
    address.quarter ??
    address.suburb ??
    address.city_district ??
    null;
  const city =
    address.city ?? address.town ?? address.village ?? address.state ?? address.county ?? null;
  const street = address.road ?? address.pedestrian ?? null;

  const label =
    [street, district, city].filter(Boolean).join("، ") ||
    payload.display_name?.split(",").slice(0, 3).join("، ") ||
    "";

  return {
    label,
    district,
    city,
    countryIso2: address.country_code ? address.country_code.toUpperCase() : null,
    countryName: address.country ?? null,
  };
}
