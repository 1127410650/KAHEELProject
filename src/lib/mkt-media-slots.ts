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
import { stampImageBlob, type BrandStampOptions } from "@/lib/kaheel-brand-stamp";
import { activeRotationTemplateId } from "@/lib/mkt-slot-rotation";


export const MEDIA_SLOT_BUCKET = "mkt-media";
export const MEDIA_SLOT_PREFIX = "public/media-slots";
export const MEDIA_SLOTS_QUERY_KEY = ["mkt", "media-slots"] as const;

export type MediaSlotKind = "image" | "video_url";
/** نوع أدوات التعديل التي تظهر للفتحة في وضع التحرير البصري. */
export type MediaSlotEditKind = "media" | "background" | "ad" | "design";

export interface MediaSlotRow {
  slot_key: string;
  section: string;
  group_key: string | null;
  kind: string;
  path: string | null;
  /** النسخة الأصلية بلا ختم كَحيل — تُحفظ بجانب المختومة. */
  path_original: string | null;
  external_url: string | null;
  title_ar: string | null;
  subtitle_ar: string | null;
  alt_text: string | null;
  sort_order: number;
  hidden: boolean;
  is_demo: boolean;
  /** مظهر الفتحة المنشور: لون خلفية أو تدرّج بلونين وزاوية. */
  bg_color: string | null;
  grad_from: string | null;
  grad_to: string | null;
  grad_angle: number | null;
  /** ربط موضع إعلاني بحملة من `mkt_ad_campaigns` مع فترة عرض. */
  campaign_id: string | null;
  campaign_from: string | null;
  campaign_to: string | null;
  edit_kind: MediaSlotEditKind;
  variant_page: string | null;
  /** الشكل الزخرفي والحركة من مكتبة التصميم (`mkt_design_shapes/_motions`). */
  shape_key: string | null;
  shape_color: string | null;
  shape_opacity: number | null;
  shape_size: string | null;
  shape_pos: string | null;
  motion_key: string | null;
  motion_state: string | null;
  motion_speed: string | null;
  /** حجم البلاطة ووجهتها المسجّلة وقالب «تصاميمي» المربوط. */
  tile_size: string | null;
  link_path: string | null;
  template_id: string | null;
  /** التدوير الزمني بين عدة تصاميم من المكتبة. */
  rotate_enabled: boolean;
  rotate_period: string | null;
  rotate_template_ids: string[] | null;
  rotate_started_at: string | null;
}

export interface MediaSlot extends MediaSlotRow {
  /** الرابط الجاهز للعرض — `null` يعني «استخدم الاحتياطي». */
  url: string | null;
  /** رابط النسخة الأصلية غير المختومة، إن وُجدت. */
  originalUrl: string | null;
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

const SLOT_COLUMNS =
  "slot_key, section, group_key, kind, path, path_original, external_url, title_ar, subtitle_ar, " +
  "alt_text, sort_order, hidden, is_demo, bg_color, grad_from, grad_to, grad_angle, campaign_id, " +
  "campaign_from, campaign_to, edit_kind, variant_page, shape_key, shape_color, shape_opacity, " +
  "shape_size, shape_pos, motion_key, motion_state, motion_speed, tile_size, link_path, template_id, " +
  "rotate_enabled, rotate_period, rotate_template_ids, rotate_started_at";


export async function fetchMediaSlots(): Promise<MediaSlot[]> {
  const { data, error } = await supabase
    .from("mkt_media_slots")
    .select(SLOT_COLUMNS)

    .order("sort_order", { ascending: true })
    .order("slot_key", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as MediaSlotRow[];
  const paths = [
    ...new Set(
      rows
        .flatMap((row) => [row.path, row.path_original])
        .filter((path): path is string => !!path),
    ),
  ];

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
    originalUrl: row.path_original ? signed[row.path_original] ?? null : null,
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

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * ترجمة مظهر الفتحة إلى CSS آمن. القيم تأتي من القاعدة بعد تنقية خادمية
 * (لون سداسي أو زاوية رقمية فقط)، وتُفحص هنا مرة أخرى قبل الطباعة — فلا يمكن
 * لأي نص حر أن يصل إلى صفحة أنماط.
 */
export function slotStyleCss(slot: MediaSlotRow): string | null {
  const decls: string[] = [];
  if (slot.bg_color && HEX.test(slot.bg_color)) {
    decls.push(`background-color:${slot.bg_color}`);
  }
  if (slot.grad_from && slot.grad_to && HEX.test(slot.grad_from) && HEX.test(slot.grad_to)) {
    const angle = Number.isFinite(slot.grad_angle) ? Math.min(360, Math.max(0, slot.grad_angle!)) : 90;
    decls.push(`background-image:linear-gradient(${angle}deg,${slot.grad_from} 0%,${slot.grad_to} 100%)`);
  }
  if (decls.length === 0) return null;
  return `[data-kslot="${slot.slot_key}"]{${decls.map((d) => `${d} !important`).join(";")}}`;
}

/** حجم البلاطة المعتمد للفتحة، أو الحجم الافتراضي للشبكة. */
export function slotTileSize(
  slots: MediaSlot[] | undefined,
  key: string,
  fallback: "sm" | "md" | "lg" = "sm",
): "sm" | "md" | "lg" {
  const value = slots?.find((item) => item.slot_key === key)?.tile_size;
  return value === "sm" || value === "md" || value === "lg" ? value : fallback;
}

/** وجهة الضغط المسجّلة للفتحة، أو الوجهة المدمجة في الواجهة. */
export function slotLink(slots: MediaSlot[] | undefined, key: string, fallback: string): string {
  return slots?.find((item) => item.slot_key === key)?.link_path || fallback;
}

/**
 * قالب «تصاميمي» المعروض في الفتحة الآن. إن كان «التدوير التلقائي» مفعّلًا فالقالب
 * النشط يُحسب من قائمة التدوير وفترتها (يومي/أسبوعي/شهري) بترتيب دائري، وإلا
 * فالقالب المربوط يدويًا.
 */
export function slotTemplateId(slots: MediaSlot[] | undefined, key: string): string | null {
  const slot = slots?.find((item) => item.slot_key === key);
  if (!slot) return null;
  return activeRotationTemplateId(slot) ?? slot.template_id ?? null;
}


/** معرّف الحملة المربوطة بموضع إعلاني، إن كانت داخل فترة العرض. */
export function slotCampaignId(slots: MediaSlot[] | undefined, key: string): string | null {
  const slot = slots?.find((item) => item.slot_key === key);
  if (!slot?.campaign_id) return null;
  const now = Date.now();
  if (slot.campaign_from && new Date(slot.campaign_from).getTime() > now) return null;
  if (slot.campaign_to && new Date(slot.campaign_to).getTime() < now) return null;
  return slot.campaign_id;
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
