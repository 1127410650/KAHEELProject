/**
 * مكتبة خلفيات كَحيل — «شاشة اليوم».
 *
 * كل خلفية ملف WebP واحد على شبكة التوصيل (CDN) بأبعاد صريحة 1600×906، وأكبر
 * ملف في المكتبة ١٠١ كيلوبايت. الزيارة الواحدة **لا تحمّل المكتبة**: يُحسب
 * معرّف خلفية اليوم أولًا ثم يُطلب ملفها وحده، لذا التكلفة الشبكية ثابتة مهما
 * كبرت المكتبة.
 *
 * الاختيار محسوب من التاريخ لا عشوائيًا، فالخلفية نفسها لكل الزوار في اليوم
 * نفسه، وتتغيّر تلقائيًا عند منتصف الليل بتوقيت الرياض دون أي عمل خادمي.
 *
 * الإعدادات كلها في `mkt_platform_settings` تحت المفتاح `home.backdrops`:
 * يقرأها الجميع ويكتبها مدير النظام فقط عبر `mkt_admin_set_setting`.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import amethystMist from "@/assets/backdrops/amethyst-mist.webp.asset.json";
import backToSchool from "@/assets/backdrops/back-to-school.webp.asset.json";
import cleanIndigo from "@/assets/backdrops/clean-indigo.webp.asset.json";
import eidGlow from "@/assets/backdrops/eid-glow.webp.asset.json";
import geometryOrbs from "@/assets/backdrops/geometry-orbs.webp.asset.json";
import grandOpening from "@/assets/backdrops/grand-opening.webp.asset.json";
import nightSouq from "@/assets/backdrops/night-souq.webp.asset.json";
import particlesGlow from "@/assets/backdrops/particles-glow.webp.asset.json";
import ramadanLanterns from "@/assets/backdrops/ramadan-lanterns.webp.asset.json";
import royalViolet from "@/assets/backdrops/royal-violet.webp.asset.json";
import springBloom from "@/assets/backdrops/spring-bloom.webp.asset.json";
import winterFrost from "@/assets/backdrops/winter-frost.webp.asset.json";

export const BACKDROP_WIDTH = 1600;
export const BACKDROP_HEIGHT = 906;

export type BackdropSeason =
  | "everyday"
  | "ramadan"
  | "eid"
  | "school"
  | "winter"
  | "spring"
  | "celebration";

export interface BackdropItem {
  id: string;
  url: string;
  /** فاتحة/غامقة: تحدّد قوة طبقة التدرّج فوقها لتبقى النصوص مقروءة. */
  tone: "light" | "dark";
  season: BackdropSeason;
  label: [string, string];
  bytes: number;
}

const pointer = (asset: { url: string; size: number }) => ({
  url: asset.url,
  bytes: asset.size,
});

/** المكتبة الجاهزة. الترتيب هو ترتيب العرض في لوحة الإدارة. */
export const BACKDROP_LIBRARY: BackdropItem[] = [
  {
    id: "royal-violet",
    ...pointer(royalViolet),
    tone: "dark",
    season: "everyday",
    label: ["بنفسجي ملكي", "Royal violet"],
  },
  {
    id: "amethyst-mist",
    ...pointer(amethystMist),
    tone: "light",
    season: "everyday",
    label: ["ضباب الجمشت", "Amethyst mist"],
  },
  {
    id: "clean-indigo",
    ...pointer(cleanIndigo),
    tone: "dark",
    season: "everyday",
    label: ["نيلي نظيف", "Clean indigo"],
  },
  {
    id: "geometry-orbs",
    ...pointer(geometryOrbs),
    tone: "light",
    season: "everyday",
    label: ["كرات هندسية", "Soft 3D orbs"],
  },
  {
    id: "particles-glow",
    ...pointer(particlesGlow),
    tone: "dark",
    season: "everyday",
    label: ["جسيمات لامعة", "Glowing particles"],
  },
  {
    id: "night-souq",
    ...pointer(nightSouq),
    tone: "dark",
    season: "everyday",
    label: ["سوق الليل", "Night souq"],
  },
  {
    id: "ramadan-lanterns",
    ...pointer(ramadanLanterns),
    tone: "dark",
    season: "ramadan",
    label: ["رمضان — فوانيس", "Ramadan lanterns"],
  },
  {
    id: "eid-glow",
    ...pointer(eidGlow),
    tone: "dark",
    season: "eid",
    label: ["العيد — هلال ونجوم", "Eid glow"],
  },
  {
    id: "back-to-school",
    ...pointer(backToSchool),
    tone: "light",
    season: "school",
    label: ["العودة للمدارس", "Back to school"],
  },
  {
    id: "winter-frost",
    ...pointer(winterFrost),
    tone: "dark",
    season: "winter",
    label: ["الشتاء", "Winter frost"],
  },
  {
    id: "spring-bloom",
    ...pointer(springBloom),
    tone: "light",
    season: "spring",
    label: ["الربيع", "Spring bloom"],
  },
  {
    id: "grand-opening",
    ...pointer(grandOpening),
    tone: "dark",
    season: "celebration",
    label: ["افتتاح واحتفال", "Grand opening"],
  },
];

export const SEASON_LABEL: Record<BackdropSeason, [string, string]> = {
  everyday: ["كل يوم", "Everyday"],
  ramadan: ["رمضان", "Ramadan"],
  eid: ["العيد", "Eid"],
  school: ["المدارس", "School"],
  winter: ["الشتاء", "Winter"],
  spring: ["الربيع", "Spring"],
  celebration: ["احتفال", "Celebration"],
};

/** خلفية مرفوعة من المدير: تُخزَّن كمسار في الحاوية ويُوقَّع رابطها عند العرض. */
export interface CustomBackdrop {
  id: string;
  path: string;
  label: string;
  tone: "light" | "dark";
}

export interface BackdropWindow {
  /** YYYY-MM-DD */
  from: string;
  to: string;
}

export interface BackdropSettings {
  /** off = بلا خلفيات، daily = تبديل يومي، fixed = خلفية ثابتة واحدة. */
  mode: "off" | "daily" | "fixed";
  fixedId: string | null;
  /** الخلفيات المفعّلة (الجاهزة والمخصصة معًا). */
  enabled: string[];
  /** محجوزة لموسمها: لا تدخل التبديل اليومي إلا داخل نافذتها. */
  holdback: string[];
  /** جدولة موسمية بتواريخ صريحة لكل خلفية. */
  windows: Record<string, BackdropWindow>;
  custom: CustomBackdrop[];
}

const SEASONAL: BackdropSeason[] = ["ramadan", "eid", "school", "winter", "spring", "celebration"];

export const DEFAULT_BACKDROP_SETTINGS: BackdropSettings = {
  mode: "daily",
  fixedId: null,
  enabled: BACKDROP_LIBRARY.map((item) => item.id),
  // الافتراضي: كل خلفية موسمية محجوزة لموسمها، والعادية تتبدّل يوميًا.
  holdback: BACKDROP_LIBRARY.filter((item) => SEASONAL.includes(item.season)).map((item) => item.id),
  windows: {},
  custom: [],
};

export const BACKDROP_SETTINGS_KEY = "home.backdrops";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function normaliseBackdropSettings(
  raw: Record<string, unknown> | null | undefined,
): BackdropSettings {
  if (!raw) return DEFAULT_BACKDROP_SETTINGS;
  const mode = raw["mode"];
  const custom = Array.isArray(raw["custom"])
    ? (raw["custom"] as Record<string, unknown>[])
        .filter((entry) => typeof entry?.["id"] === "string" && typeof entry["path"] === "string")
        .map((entry) => ({
          id: String(entry["id"]),
          path: String(entry["path"]),
          label: String(entry["label"] ?? "خلفية مخصصة"),
          tone: entry["tone"] === "light" ? ("light" as const) : ("dark" as const),
        }))
    : [];
  const windows: Record<string, BackdropWindow> = {};
  const rawWindows = (raw["windows"] ?? {}) as Record<string, unknown>;
  for (const [id, value] of Object.entries(rawWindows)) {
    const from = (value as Record<string, unknown>)?.["from"];
    const to = (value as Record<string, unknown>)?.["to"];
    if (typeof from === "string" && typeof to === "string" && from && to) windows[id] = { from, to };
  }
  return {
    mode: mode === "off" || mode === "fixed" ? mode : "daily",
    fixedId: typeof raw["fixed_id"] === "string" ? (raw["fixed_id"] as string) : null,
    enabled: raw["enabled"] ? asStringArray(raw["enabled"]) : DEFAULT_BACKDROP_SETTINGS.enabled,
    holdback: raw["holdback"] ? asStringArray(raw["holdback"]) : DEFAULT_BACKDROP_SETTINGS.holdback,
    windows,
    custom,
  };
}

export function backdropSettingsPayload(settings: BackdropSettings): Record<string, unknown> {
  return {
    mode: settings.mode,
    fixed_id: settings.fixedId,
    enabled: settings.enabled,
    holdback: settings.holdback,
    windows: settings.windows,
    custom: settings.custom,
  };
}

/** اليوم بتوقيت الرياض بصيغة YYYY-MM-DD — حتى يتبدّل الشكل عند منتصف ليلنا. */
export function riyadhDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayIndex(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
}

function windowCovers(window: BackdropWindow | undefined, dayKey: string): boolean {
  if (!window) return false;
  return window.from <= dayKey && dayKey <= window.to;
}

export interface ResolvedBackdrop {
  id: string;
  /** رابط جاهز للعرض، أو مسار حاوية يحتاج توقيعًا. */
  url?: string;
  path?: string;
  tone: "light" | "dark";
  label: string;
}

/**
 * خلفية اليوم. الترتيب: نافذة موسمية مفعّلة تسبق كل شيء، ثم الخلفية الثابتة،
 * ثم التبديل اليومي من المفعّلة غير المحجوزة.
 */
export function resolveBackdrop(
  settings: BackdropSettings,
  dayKey: string = riyadhDayKey(),
): ResolvedBackdrop | null {
  if (settings.mode === "off") return null;

  const catalog = new Map<string, ResolvedBackdrop>();
  for (const item of BACKDROP_LIBRARY) {
    catalog.set(item.id, { id: item.id, url: item.url, tone: item.tone, label: item.label[0] });
  }
  for (const item of settings.custom) {
    catalog.set(item.id, { id: item.id, path: item.path, tone: item.tone, label: item.label });
  }

  const enabled = settings.enabled.filter((id) => catalog.has(id));

  // ١) موسم مفتوح الآن.
  const seasonal = enabled.filter((id) => windowCovers(settings.windows[id], dayKey));
  if (seasonal.length > 0) {
    const pick = seasonal[dayIndex(dayKey) % seasonal.length]!;
    return catalog.get(pick) ?? null;
  }

  // ٢) خلفية ثابتة.
  if (settings.mode === "fixed") {
    const fixed = settings.fixedId && enabled.includes(settings.fixedId) ? settings.fixedId : null;
    return fixed ? (catalog.get(fixed) ?? null) : null;
  }

  // ٣) تبديل يومي: المحجوزة لمواسمها خارج الدورة.
  const rotation = enabled.filter((id) => !settings.holdback.includes(id));
  if (rotation.length === 0) return null;
  const pick = rotation[dayIndex(dayKey) % rotation.length]!;
  return catalog.get(pick) ?? null;
}

export async function loadBackdropSettings(): Promise<BackdropSettings> {
  const { data } = await supabase
    .from("mkt_platform_settings")
    .select("value")
    .eq("key", BACKDROP_SETTINGS_KEY)
    .maybeSingle();
  return normaliseBackdropSettings((data as { value?: Record<string, unknown> } | null)?.value);
}

/**
 * خلفية اليوم جاهزة للعرض. تُطلب الإعدادات مرة واحدة للزيارة، ولا يُوقَّع إلا
 * مسار الخلفية المختارة إن كانت مرفوعة من المدير.
 */
export function useDailyBackdrop() {
  const settings = useQuery({
    queryKey: ["mkt", "backdrops", "settings"],
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: loadBackdropSettings,
  });

  const dayKey = riyadhDayKey();
  const resolved = settings.data ? resolveBackdrop(settings.data, dayKey) : null;

  const signed = useQuery({
    queryKey: ["mkt", "backdrops", "signed", resolved?.path ?? null],
    enabled: !!resolved?.path,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("mkt")
        .createSignedUrl(resolved!.path!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const url = resolved?.url ?? signed.data ?? null;
  return { backdrop: resolved && url ? { ...resolved, url } : null, dayKey };
}
