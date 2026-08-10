/**
 * «نظام حضور الشخصيتين» — ظهور دوري بمداخل ومواضع وعبارات متنوّعة، بلا أي أثر
 * على التخطيط وبلا حجب أي عنصر تفاعلي.
 *
 * القواعد المعتمدة:
 *  • الطبقة `fixed` فوق الصفحة (pointer-events: none) ⇒ صفر هزّة تخطيط (CLS = 0).
 *  • هوامش أمان: 96px من الأسفل (شريط التنقل) و160px من الأعلى (الهيدر).
 *  • الفاصل الزمني ومدة البقاء والتشغيل/الإيقاف من `mkt_platform_settings`
 *    (المفتاح `mascot.presence`)، يعدّلها المدير من `/admin/appearance`.
 *  • العبارات من جدول `mkt_mascot_phrases` (لكل شخصية مجموعتها)، ولا تتكرّر عبارة
 *    حتى تنتهي المجموعة (تتبّع بـ `sessionStorage`).
 *  • لا يتكرّر مدخل ولا موضع ولا شخصية مرّتين متتاليتين.
 *  • كتم ٢٤ ساعة بضغطة واحدة («لا تُظهرها اليوم») — نفس مفتاح الكتم القديم.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { MascotName } from "@/lib/mascot-assets";

// ── الإعدادات ───────────────────────────────────────────────────────────────

export const MASCOT_PRESENCE_KEY = "mascot.presence";

export interface MascotPresenceSettings {
  /** `mascot_enabled` — مفتاح تشغيل النظام كليًا. */
  enabled: boolean;
  /** `mascot_interval_seconds` — الفاصل بين ظهورين (بزمن التصفح النشط). */
  intervalSeconds: number;
  /** `mascot_visible_seconds` — الاختفاء التلقائي بعد هذه المدة. */
  visibleSeconds: number;
}

export const DEFAULT_PRESENCE: MascotPresenceSettings = {
  enabled: true,
  intervalSeconds: 20,
  visibleSeconds: 6,
};

/** يحمي من أي رقم خاطئ في لوحة الإدارة. */
export function normalisePresence(
  raw: Record<string, unknown> | null | undefined,
): MascotPresenceSettings {
  const num = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(raw?.[key]);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  return {
    enabled: raw?.["mascot_enabled"] !== false,
    intervalSeconds: num("mascot_interval_seconds", DEFAULT_PRESENCE.intervalSeconds, 8, 3600),
    visibleSeconds: num("mascot_visible_seconds", DEFAULT_PRESENCE.visibleSeconds, 3, 20),
  };
}

export async function loadPresenceSettings(): Promise<MascotPresenceSettings> {
  const { data } = await supabase
    .from("mkt_platform_settings")
    .select("value")
    .eq("key", MASCOT_PRESENCE_KEY)
    .maybeSingle();
  return normalisePresence((data as { value?: Record<string, unknown> } | null)?.value);
}

export function useMascotPresenceSettings() {
  const query = useQuery({
    queryKey: ["mkt", "mascot-presence-settings"],
    staleTime: 300_000,
    queryFn: loadPresenceSettings,
  });
  return query.data ?? DEFAULT_PRESENCE;
}

/** حفظ الإعدادات — القاعدة تعيد التحقق من صفة المدير عبر سياسات الجدول. */
export async function savePresenceSettings(next: MascotPresenceSettings): Promise<void> {
  const { error } = await supabase.from("mkt_platform_settings").upsert(
    {
      key: MASCOT_PRESENCE_KEY,
      section: "mascots",
      value: {
        mascot_enabled: next.enabled,
        mascot_interval_seconds: next.intervalSeconds,
        mascot_visible_seconds: next.visibleSeconds,
      },
      description_ar: "ظهور الشخصيتين الدوري: التشغيل، الفاصل بالثواني، ومدة البقاء",
    },
    { onConflict: "key" },
  );
  if (error) throw error;
}

// ── العبارات ────────────────────────────────────────────────────────────────

export interface MascotPhrase {
  id: string;
  character: MascotName;
  text_ar: string;
  link_path: string | null;
  is_active: boolean;
  sort: number;
}

export async function loadMascotPhrases(includeHidden = false): Promise<MascotPhrase[]> {
  let query = supabase
    .from("mkt_mascot_phrases")
    .select("id, character, text_ar, link_path, is_active, sort")
    .order("character", { ascending: true })
    .order("sort", { ascending: true });
  if (!includeHidden) query = query.eq("is_active", true);
  const { data } = await query;
  return ((data ?? []) as MascotPhrase[]).filter(
    (row) => row.character === "kaheel" || row.character === "kaheelan",
  );
}

export function useMascotPhrases(includeHidden = false) {
  return useQuery({
    queryKey: ["mkt", "mascot-phrases", includeHidden],
    staleTime: includeHidden ? 0 : 300_000,
    queryFn: () => loadMascotPhrases(includeHidden),
  });
}

// ── التنوّع: مداخل ومواضع ───────────────────────────────────────────────────

/** المداخل المتاحة — كلها `transform`/`opacity` بمدة 350ms. */
export const MASCOT_ENTRANCES = [
  "drop", // نزول من الأعلى بطبّة صغيرة
  "slide-start", // انزلاق من حافة البداية
  "slide-end", // انزلاق من حافة النهاية
  "pop", // نبع من الزاوية السفلية
  "peek", // إطلالة نصف الجسم من الحافة
] as const;
export type MascotEntrance = (typeof MASCOT_ENTRANCES)[number];

/** المواضع الأربعة — كلها داخل هوامش الأمان. */
export const MASCOT_ANCHORS = [
  "bottom-start",
  "bottom-end",
  "mid-start",
  "mid-end",
] as const;
export type MascotAnchor = (typeof MASCOT_ANCHORS)[number];

/** هوامش الأمان: لا اقتراب من شريط التنقل ولا من الهيدر. */
export const SAFE_BOTTOM_PX = 96;
export const SAFE_TOP_PX = 160;

const SEEN_KEY = "kaheel.mascot.seenPhrases";
const LAST_KEY = "kaheel.mascot.lastAppearance";

interface LastAppearance {
  character?: MascotName;
  entrance?: MascotEntrance;
  anchor?: MascotAnchor;
  phraseId?: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: variety simply resets */
  }
}

export function lastAppearance(): LastAppearance {
  return readJson<LastAppearance>(LAST_KEY, {});
}

export interface MascotAppearance {
  character: MascotName;
  phrase: MascotPhrase;
  entrance: MascotEntrance;
  anchor: MascotAnchor;
}

/** يختار عنصرًا مختلفًا عن السابق من قائمة دوّارة. */
function rotate<T>(list: readonly T[], previous: T | undefined): T {
  const options = list.length > 1 ? list.filter((item) => item !== previous) : [...list];
  return options[Math.floor(Math.random() * options.length)] as T;
}

/**
 * يبني الظهور التالي: شخصية مختلفة عن السابقة، ومدخل وموضع مختلفان، وعبارة لم
 * تُعرض في هذه الجلسة حتى تنتهي مجموعة الشخصية فتُعاد التدوير.
 */
export function nextAppearance(phrases: MascotPhrase[]): MascotAppearance | null {
  if (typeof window === "undefined" || phrases.length === 0) return null;
  const last = lastAppearance();

  const characters: MascotName[] = ["kaheel", "kaheelan"];
  const available = characters.filter((name) =>
    phrases.some((phrase) => phrase.character === name),
  );
  if (available.length === 0) return null;
  const character = rotate(available, last.character);

  const pool = phrases.filter((phrase) => phrase.character === character);
  const seen = readJson<string[]>(SEEN_KEY, []);
  let unseen = pool.filter((phrase) => !seen.includes(phrase.id));
  if (unseen.length === 0) {
    // انتهت المجموعة ⇒ تُعاد التدوير من جديد بلا تكرار العبارة الأخيرة.
    writeJson(
      SEEN_KEY,
      seen.filter((id) => !pool.some((phrase) => phrase.id === id)),
    );
    unseen = pool.filter((phrase) => phrase.id !== last.phraseId);
    if (unseen.length === 0) unseen = pool;
  }
  const phrase = unseen[Math.floor(Math.random() * unseen.length)] as MascotPhrase;

  const entrance = rotate(MASCOT_ENTRANCES, last.entrance);
  const anchor = rotate(MASCOT_ANCHORS, last.anchor);

  writeJson(SEEN_KEY, [...readJson<string[]>(SEEN_KEY, []), phrase.id]);
  writeJson(LAST_KEY, { character, entrance, anchor, phraseId: phrase.id });

  return { character, phrase, entrance, anchor };
}

/** لاختبارات المعاينة فقط: تصفير ذاكرة التنوّع. */
export function resetPresenceMemory(): void {
  try {
    window.sessionStorage.removeItem(SEEN_KEY);
    window.sessionStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}
