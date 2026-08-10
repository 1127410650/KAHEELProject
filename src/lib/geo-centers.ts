// مراكز افتراضية لبدء الخريطة عند عدم توفر إحداثيات (بلا أي تخزين للموقع).
// تُستخدم فقط كنقطة عرض أولى، والمستخدم يحرّك الدبوس للنقطة الصحيحة.
const COUNTRY_CENTERS: Record<string, { lat: number; lng: number }> = {
  SY: { lat: 33.5138, lng: 36.2765 },
  LB: { lat: 33.8886, lng: 35.4955 },
};

export const WORLD_FALLBACK_CENTER = { lat: 33.5138, lng: 36.2765 };

export function countryCenter(iso2: string | null | undefined) {
  if (!iso2) return WORLD_FALLBACK_CENTER;
  return COUNTRY_CENTERS[iso2.toUpperCase()] ?? WORLD_FALLBACK_CENTER;
}

export function isKnownMarketCountry(iso2: string | null | undefined) {
  return !!iso2 && iso2.toUpperCase() in COUNTRY_CENTERS;
}
