/**
 * فتحات الوسائط (Media Slots) — مصدر كل عنصر بصري قابل للإدارة في المنصة.
 *
 * كل «فتحة» سجل في `mkt_media_slots` بمعرّف ثابت (مثل `aqar.hero`). الواجهة
 * العامة تقرأ الفتحات مرة واحدة للزيارة، وإن كانت الفتحة فارغة أو مخفية تعود
 * الشاشة إلى صورتها الاحتياطية المدمجة بلا فراغ أبيض.
 *
 * الملفات تُخزَّن في حاوية `mkt-media` تحت `public/media-slots/...`: القراءة
 * للجميع عبر روابط موقّعة، والكتابة لمدير المنصة فقط (سياسة تخزين + دوال
 * SECURITY DEFINER: `mkt_admin_save_media_slot` وأخواتها).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { compressToWebp } from "@/lib/media-compress";

export const MEDIA_SLOT_BUCKET = "mkt-media";
export const MEDIA_SLOT_PREFIX = "public/media-slots";
export const MEDIA_SLOTS_QUERY_KEY = ["mkt", "media-slots"] as const;

export type MediaSlotKind = "image" | "video_url";

export interface MediaSlotRow {
  slot_key: string;
  section: string;
  group_key: string | null;
  kind: string;
  path: string | null;
  external_url: string | null;
  title_ar: string | null;
  subtitle_ar: string | null;
  alt_text: string | null;
  sort_order: number;
  hidden: boolean;
  is_demo: boolean;
}

export interface MediaSlot extends MediaSlotRow {
  /** الرابط الجاهز للعرض — `null` يعني «استخدم الاحتياطي». */
  url: string | null;
}

/** أقسام الفتحات كما تظهر في شاشة الإدارة. */
export const MEDIA_SECTION_LABELS: Record<string, string> = {
  home: "الصفحة الرئيسية",
  home_tiles: "البلاطات السريعة",
  campaigns: "بانرات الحملات",
  aqar: "كَحيل عقار",
  aqar_types: "أنواع العقار",
  cities: "دوائر المدن",
};

export async function fetchMediaSlots(): Promise<MediaSlot[]> {
  const { data, error } = await supabase
    .from("mkt_media_slots")
    .select(
      "slot_key, section, group_key, kind, path, external_url, title_ar, subtitle_ar, alt_text, sort_order, hidden, is_demo",
    )
    .order("sort_order", { ascending: true })
    .order("slot_key", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as MediaSlotRow[];
  const paths = rows.map((row) => row.path).filter((path): path is string => !!path);

  const signed: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from(MEDIA_SLOT_BUCKET)
      .createSignedUrls(paths, 3600);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
    }
  }

  return rows.map((row) => ({
    ...row,
    url: row.hidden
      ? null
      : row.external_url && /^https:\/\//i.test(row.external_url)
        ? row.external_url
        : row.path
          ? signed[row.path] ?? null
          : null,
  }));
}

/** كل الفتحات للزيارة الحالية. استعلام واحد مشترك بين كل الشاشات. */
export function useMediaSlots() {
  return useQuery({
    queryKey: MEDIA_SLOTS_QUERY_KEY,
    queryFn: fetchMediaSlots,
    staleTime: 10 * 60_000,
    gcTime: 45 * 60_000,
    retry: 1,
  });
}

export function slotUrl(slots: MediaSlot[] | undefined, key: string, fallback: string): string {
  const slot = slots?.find((item) => item.slot_key === key);
  return slot?.url ?? fallback;
}

export function slotAlt(slots: MediaSlot[] | undefined, key: string, fallback: string): string {
  const slot = slots?.find((item) => item.slot_key === key);
  return slot?.alt_text || fallback;
}

export function slotsInSection(slots: MediaSlot[] | undefined, section: string): MediaSlot[] {
  return (slots ?? []).filter((slot) => slot.section === section);
}

/** الأقسام بترتيب العرض مع فتحاتها — تُستخدم في شاشة الإدارة. */
export function groupSlotsBySection(slots: MediaSlot[]): { section: string; label: string; slots: MediaSlot[] }[] {
  const order = Object.keys(MEDIA_SECTION_LABELS);
  const sections = [...new Set(slots.map((slot) => slot.section))].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
  return sections.map((section) => ({
    section,
    label: MEDIA_SECTION_LABELS[section] ?? section,
    slots: slots.filter((slot) => slot.section === section),
  }));
}

/* ───────────────────────── كتابة الإدارة ───────────────────────── */

function storagePathFor(slotKey: string): string {
  const safe = slotKey.replace(/[^a-z0-9._-]/gi, "-");
  return `${MEDIA_SLOT_PREFIX}/${safe}/${crypto.randomUUID()}.webp`;
}

/**
 * يضغط الصورة (١٦٠٠px / WebP / ≤٣٠٠KB) ثم يرفعها ويربطها بالفتحة.
 * الملف القديم يُحذف بعد نجاح الربط فقط، فلا تفقد الفتحة صورتها عند أي خطأ.
 */
export async function uploadMediaSlotImage(
  slot: MediaSlotRow,
  file: File,
): Promise<{ bytes: number; width: number; height: number }> {
  const { blob, width, height } = await compressToWebp(file);
  const path = storagePathFor(slot.slot_key);

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_SLOT_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase.rpc("mkt_admin_save_media_slot", {
    _slot_key: slot.slot_key,
    _path: path,
    _kind: "image",
  });
  if (error) {
    await supabase.storage.from(MEDIA_SLOT_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }

  if (slot.path && slot.path !== path) {
    await supabase.storage.from(MEDIA_SLOT_BUCKET).remove([slot.path]).catch(() => undefined);
  }
  return { bytes: blob.size, width, height };
}

export async function saveMediaSlotMeta(
  slotKey: string,
  patch: { alt_text?: string; title_ar?: string; subtitle_ar?: string; external_url?: string; kind?: MediaSlotKind },
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_save_media_slot", {
    _slot_key: slotKey,
    ...(patch.alt_text !== undefined ? { _alt_text: patch.alt_text } : {}),
    ...(patch.title_ar !== undefined ? { _title_ar: patch.title_ar } : {}),
    ...(patch.subtitle_ar !== undefined ? { _subtitle_ar: patch.subtitle_ar } : {}),
    ...(patch.external_url !== undefined ? { _external_url: patch.external_url } : {}),
    ...(patch.kind !== undefined ? { _kind: patch.kind } : {}),
  });
  if (error) throw error;
}

/** يفرّغ الفتحة (تعود الواجهة للاحتياطي) ويحذف الملف من التخزين. */
export async function clearMediaSlot(slot: MediaSlotRow): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_clear_media_slot", { _slot_key: slot.slot_key });
  if (error) throw error;
  if (slot.path) {
    await supabase.storage.from(MEDIA_SLOT_BUCKET).remove([slot.path]).catch(() => undefined);
  }
}

export async function setMediaSlotHidden(slotKey: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_set_media_slot_hidden", {
    _slot_key: slotKey,
    _hidden: hidden,
  });
  if (error) throw error;
}

/** يُبطل كاش الفتحات فورًا بعد أي تعديل ⇒ الصورة تظهر في مكانها بلا إعادة تحميل. */
export function useRefreshMediaSlots() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: MEDIA_SLOTS_QUERY_KEY });
    void client.invalidateQueries({ queryKey: ["aqar"] });
  };
}
