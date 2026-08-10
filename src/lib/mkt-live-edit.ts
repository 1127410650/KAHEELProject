/**
 * وضع التحرير البصري (Live Edit) — منطق البيانات فقط.
 *
 * هذا الملف يُستورد من حزمة وضع التحرير المؤجّلة (lazy) ومن لوحة الإدارة فقط،
 * فلا يصل إلى الزائر العادي. كل كتابة تمرّ بدوال SECURITY DEFINER تفحص
 * `mkt_is_platform_admin` وتُنقّي القيم في القاعدة (لون سداسي، زاوية 0–360،
 * معرّف حملة موجود، مسار تخزين داخل مجلد الفتحات) — ولا تقبل أي CSS أو HTML حر.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { compressToWebp } from "@/lib/media-compress";
import {
  MEDIA_SLOT_BUCKET,
  MEDIA_SLOT_PREFIX,
  MEDIA_SLOTS_QUERY_KEY,
  type MediaSlot,
} from "@/lib/mkt-media-slots";

export const LIVE_EDIT_FLAG = "kaheel.liveEdit";
export const SLOT_DRAFTS_QUERY_KEY = ["mkt", "slot-drafts"] as const;

/** الحقول المسموح تعديلها — نفس القائمة المسموح بها في القاعدة. */
export interface SlotPatch {
  bg_color?: string | null;
  grad_from?: string | null;
  grad_to?: string | null;
  grad_angle?: number | null;
  campaign_id?: string | null;
  campaign_from?: string | null;
  campaign_to?: string | null;
  path?: string | null;
  alt_text?: string | null;
  hidden?: boolean;
  /** الشكل الزخرفي والحركة — مفاتيح من مكتبة التصميم لا قيم حرة. */
  shape_key?: string | null;
  shape_color?: string | null;
  shape_opacity?: number | null;
  shape_size?: string | null;
  shape_pos?: string | null;
  motion_key?: string | null;
  motion_state?: string | null;
  motion_speed?: string | null;
  /** حجم البلاطة ووجهتها المسجّلة وقالب «تصاميمي» المربوط. */
  tile_size?: string | null;
  link_path?: string | null;
  template_id?: string | null;
  /** النسخة الأصلية غير المختومة للصورة المرفوعة. */
  path_original?: string | null;
  /** التدوير الزمني بين تصاميم المكتبة. */
  rotate_enabled?: boolean | null;
  rotate_period?: string | null;
  rotate_template_ids?: string[] | null;
}


export interface SlotDraft {
  slot_key: string;
  patch: SlotPatch;
  updated_at: string;
}

export interface SlotHistoryRow {
  id: string;
  slot_key: string;
  before_value: SlotPatch;
  after_value: SlotPatch;
  created_at: string;
}

/* ───────────────────────── التفعيل ───────────────────────── */

export function isLiveEditRequested(): boolean {
  try {
    return sessionStorage.getItem(LIVE_EDIT_FLAG) === "1";
  } catch {
    return false;
  }
}

export function requestLiveEdit(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(LIVE_EDIT_FLAG, "1");
    else sessionStorage.removeItem(LIVE_EDIT_FLAG);
  } catch {
    /* التخزين معطّل — الوضع يبقى مقصورًا على هذه الصفحة */
  }
}

/** تحقق خادمي من صفة مدير المنصة — معامل الرابط أو العلم المحلي لا يكفي. */
export async function verifyPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("mkt_is_platform_admin");
  if (error) return false;
  return data === true;
}

/* ───────────────────────── المسوّدات ───────────────────────── */

export async function fetchSlotDrafts(): Promise<SlotDraft[]> {
  const { data, error } = await supabase
    .from("mkt_media_slot_drafts")
    .select("slot_key, patch, updated_at");
  if (error) throw error;
  return (data ?? []) as unknown as SlotDraft[];
}

export function useSlotDrafts(enabled: boolean) {
  return useQuery({
    queryKey: SLOT_DRAFTS_QUERY_KEY,
    queryFn: fetchSlotDrafts,
    enabled,
    staleTime: 15_000,
    retry: 1,
  });
}

export async function saveSlotDraft(slotKey: string, patch: SlotPatch): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_slot_set_draft", {
    _slot_key: slotKey,
    _patch: patch as never,
  });

  if (error) throw error;
}

export async function publishSlotDraft(slotKey: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_slot_publish", { _slot_key: slotKey });
  if (error) throw error;
}

export async function discardSlotDraft(slotKey: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_slot_discard_draft", { _slot_key: slotKey });
  if (error) throw error;
}

export async function undoSlotChange(slotKey: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_slot_undo", { _slot_key: slotKey });
  if (error) throw error;
}

export async function fetchSlotHistory(slotKey: string, limit = 5): Promise<SlotHistoryRow[]> {
  const { data, error } = await supabase
    .from("mkt_media_slot_history")
    .select("id, slot_key, before_value, after_value, created_at")
    .eq("slot_key", slotKey)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SlotHistoryRow[];
}

/** يرفع صورة مضغوطة إلى مجلد الفتحات ويعيد مسارها — بلا نشر: تُحفظ كمسوّدة. */
export async function uploadSlotDraftImage(
  slotKey: string,
  file: File,
): Promise<{ path: string; bytes: number; width: number; height: number }> {
  const { blob, width, height } = await compressToWebp(file);
  const safe = slotKey.replace(/[^a-z0-9._-]/gi, "-");
  const path = `${MEDIA_SLOT_PREFIX}/${safe}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(MEDIA_SLOT_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "3600", upsert: false });
  if (error) throw error;
  return { path, bytes: blob.size, width, height };
}

/* ───────────────────────── فحص التباين ───────────────────────── */

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** نسبة تباين لونين (1 إلى 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * أدنى تباين للنص فوق الخلفية المقترحة. للتدرّج يُفحص الطرفان معًا، فلا يمرّ
 * تدرّج طرفه الفاتح غير مقروء.
 */
export function worstContrast(text: string, colors: (string | null | undefined)[]): number {
  const valid = colors.filter((color): color is string => !!color && /^#[0-9a-f]{6}$/i.test(color));
  if (valid.length === 0) return 21;
  return Math.min(...valid.map((color) => contrastRatio(text, color)));
}

export const CONTRAST_MIN = 4.5;

/* ───────────────────────── تحديث الكاش ───────────────────────── */

export function useRefreshLiveEdit() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: MEDIA_SLOTS_QUERY_KEY });
    void client.invalidateQueries({ queryKey: SLOT_DRAFTS_QUERY_KEY });
    void client.invalidateQueries({ queryKey: ["aqar"] });
  };
}

/** الفتحة المطلوبة من قائمة الفتحات المحمّلة. */
export function findSlot(slots: MediaSlot[] | undefined, key: string): MediaSlot | undefined {
  return slots?.find((slot) => slot.slot_key === key);
}
