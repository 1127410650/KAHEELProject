/**
 * كَحيل عقار — إعداد الصور القابل للتعديل.
 *
 * كل مسارات الصور (بطاقات أنواع العقار، دوائر المدن، صورة المعلم في الهيرو)
 * تُقرأ من هنا، والقيم الافتراضية أصول CDN داخل المشروع. يمكن للإدارة تجاوز أي
 * مسار من `mkt_platform_settings` تحت المفتاح `aqar.imagery` بلا تعديل كود:
 *
 *   {
 *     "types":  { "villa": "/__l5e/…/x.webp", … },
 *     "cities": { "دمشق": "/__l5e/…/y.webp", … },
 *     "hero":   { "image": "/__l5e/…/z.webp", "name": "قلعة حلب", "city": "حلب" }
 *   }
 *
 * لا منطق خلفي هنا: مجرد قراءة إعداد + دمجه فوق الافتراضي.
 */

import { supabase } from "@/integrations/supabase/client";

import cityAleppo from "@/assets/aqar/city-aleppo.webp.asset.json";
import cityDamascus from "@/assets/aqar/city-damascus.webp.asset.json";
import cityHama from "@/assets/aqar/city-hama.webp.asset.json";
import cityHoms from "@/assets/aqar/city-homs.webp.asset.json";
import cityLatakia from "@/assets/aqar/city-latakia.webp.asset.json";
import cityTartus from "@/assets/aqar/city-tartus.webp.asset.json";
import heroPalmyra from "@/assets/aqar/hero-palmyra.webp.asset.json";
import typeApartment from "@/assets/aqar/type-apartment.webp.asset.json";
import typeBuilding from "@/assets/aqar/type-building.webp.asset.json";
import typeFarm from "@/assets/aqar/type-farm.webp.asset.json";
import typeLand from "@/assets/aqar/type-land.webp.asset.json";
import typeShop from "@/assets/aqar/type-shop.webp.asset.json";
import typeVilla from "@/assets/aqar/type-villa.webp.asset.json";

export const AQAR_SETTINGS_KEY = "aqar.imagery";

/** مجموعة أنواع العقار المعروضة في الصفحة، بنفس ترتيب البطاقات. */
export interface AqarTypeCard {
  /** المفتاح المرسل للفلترة — يقابل `property_type` في الجدول. */
  key: string;
  /** أنواع إضافية تُضم لنفس البطاقة عند الفلترة (مزارع وشاليهات مثلًا). */
  also?: string[];
  label: string;
  image: string;
  /** بطاقة عريضة (تأخذ عمودين) — تُستخدم لأهم نوعين. */
  wide?: boolean;
}

export interface AqarCityCircle {
  name: string;
  landmark: string;
  image: string;
}

export interface AqarHeroConfig {
  image: string;
  /** اسم المعلم كما يظهر فوق الصورة. */
  name: string;
  city: string;
}

export interface AqarImagery {
  types: AqarTypeCard[];
  cities: AqarCityCircle[];
  hero: AqarHeroConfig;
}

/** الافتراضي المدمج — يعمل بلا اتصال بقاعدة البيانات. */
export const DEFAULT_AQAR_IMAGERY: AqarImagery = {
  types: [
    { key: "villa", label: "فلل", image: typeVilla.url, wide: true },
    { key: "apartment", label: "شقق", image: typeApartment.url, wide: true },
    { key: "building", label: "عمائر", image: typeBuilding.url },
    { key: "land", label: "أراضٍ", image: typeLand.url },
    { key: "shop", also: ["office", "warehouse"], label: "محلات", image: typeShop.url },
    { key: "farm", also: ["chalet"], label: "مزارع وشاليهات", image: typeFarm.url },
  ],
  cities: [
    { name: "دمشق", landmark: "الجامع الأموي", image: cityDamascus.url },
    { name: "حلب", landmark: "قلعة حلب", image: cityAleppo.url },
    { name: "حمص", landmark: "قلعة الحصن", image: cityHoms.url },
    { name: "حماة", landmark: "نواعير حماة", image: cityHama.url },
    { name: "اللاذقية", landmark: "كورنيش اللاذقية", image: cityLatakia.url },
    { name: "طرطوس", landmark: "ميناء طرطوس", image: cityTartus.url },
  ],
  hero: { image: heroPalmyra.url, name: "أعمدة تدمر", city: "تدمر — حمص" },
};

/** أسماء الأنواع بالعربية — تُستخدم في البطاقات وصفحة الإعلان. */
export const AQAR_TYPE_LABELS: Record<string, string> = {
  apartment: "شقة",
  house: "منزل",
  villa: "فيلا",
  land: "أرض",
  shop: "محل",
  warehouse: "مستودع",
  office: "مكتب",
  farm: "مزرعة",
  chalet: "شاليه",
  building: "عمارة",
  hotel_room: "غرفة فندقية",
  other: "أخرى",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** المسارات المقبولة: أصل CDN داخلي أو رابط https — لا شيء غير ذلك. */
function safeImage(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (raw.startsWith("/__l5e/") || /^https:\/\//i.test(raw)) return raw;
  return fallback;
}

/** يدمج تجاوزات الإدارة فوق الافتراضي؛ أي حقل ناقص أو غير صالح يبقى على الافتراضي. */
export function mergeAqarImagery(value: unknown): AqarImagery {
  if (!isRecord(value)) return DEFAULT_AQAR_IMAGERY;
  const types = isRecord(value["types"]) ? value["types"] : {};
  const cities = isRecord(value["cities"]) ? value["cities"] : {};
  const hero = isRecord(value["hero"]) ? value["hero"] : {};
  const heroName = hero["name"];
  const heroCity = hero["city"];

  return {
    types: DEFAULT_AQAR_IMAGERY.types.map((card) => ({
      ...card,
      image: safeImage(types[card.key], card.image),
    })),
    cities: DEFAULT_AQAR_IMAGERY.cities.map((city) => ({
      ...city,
      image: safeImage(cities[city.name], city.image),
    })),
    hero: {
      image: safeImage(hero["image"], DEFAULT_AQAR_IMAGERY.hero.image),
      name: typeof heroName === "string" && heroName ? heroName : DEFAULT_AQAR_IMAGERY.hero.name,
      city: typeof heroCity === "string" && heroCity ? heroCity : DEFAULT_AQAR_IMAGERY.hero.city,
    },
  };
}

/** يقرأ الإعداد من قاعدة البيانات؛ أي خطأ أو غياب يعيد الافتراضي بلا شاشة فارغة. */
export async function loadAqarImagery(): Promise<AqarImagery> {
  const { data } = await supabase
    .from("mkt_platform_settings")
    .select("value")
    .eq("key", AQAR_SETTINGS_KEY)
    .maybeSingle();
  return mergeAqarImagery(data?.value);
}

/**
 * يطبّق فتحات المظهر (`/admin/appearance`) فوق الصور الحالية.
 *
 * الفتحة الفارغة أو المخفية لا تغيّر شيئًا ⇒ يبقى الافتراضي، فلا يظهر فراغ عند
 * عدم رفع صورة. دوائر المدن تُبنى من الفتحات فقط إذا رُفعت صورة واحدة على
 * الأقل، وإلا تبقى المدن الست الافتراضية.
 */
export function applyMediaSlotsToAqar(
  imagery: AqarImagery,
  slots: { slot_key: string; group_key: string | null; subtitle_ar: string | null; url: string | null }[] | undefined,
): AqarImagery {
  if (!slots || slots.length === 0) return imagery;
  const byKey = new Map(slots.map((slot) => [slot.slot_key, slot]));

  const citySlots = slots.filter(
    (slot) => slot.slot_key.startsWith("city.") && slot.group_key && slot.url,
  );
  const cities: AqarCityCircle[] = [];
  for (const slot of citySlots) {
    if (cities.some((city) => city.name === slot.group_key)) continue;
    cities.push({
      name: slot.group_key!,
      landmark: slot.subtitle_ar ?? "",
      image: slot.url!,
    });
  }

  return {
    types: imagery.types.map((card) => ({
      ...card,
      image: byKey.get(`aqar.type.${card.key}`)?.url ?? card.image,
    })),
    cities: cities.length > 0 ? cities : imagery.cities,
    hero: { ...imagery.hero, image: byKey.get("aqar.hero")?.url ?? imagery.hero.image },
  };
}

