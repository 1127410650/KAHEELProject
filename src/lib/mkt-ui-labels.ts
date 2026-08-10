/**
 * إدارة المسميات — طبقة قراءة خفيفة لكل كلمة ظاهرة للمستخدم.
 *
 * كل مسمّى له مفتاح ونص افتراضي في الكود، والإدارة تستطيع تخصيصه من
 * `/admin/labels`. القراءة تمر على خريطة واحدة مخزّنة مؤقتًا في الذاكرة
 * (TTL خمس دقائق) فلا يضرب كل عرض قاعدة البيانات، والتعديل يسري على كل
 * الزوار بعد انتهاء المهلة أو فورًا بعد تفريغ المخزن من شاشة الإدارة.
 *
 * قيد المحتوى: نص صافٍ فقط، بلا وسوم، وبحد ٨٠ حرفًا — مفروض في القاعدة أيضًا.
 */

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const LABEL_MAX_LENGTH = 80;

export interface UiLabelRow {
  id: string;
  label_key: string;
  default_text: string;
  custom_text: string | null;
  screen: string;
  context_ar: string;
  updated_at: string;
  updated_by: string | null;
}

export type LabelMap = Record<string, string>;

const TTL_MS = 5 * 60 * 1000;

let cache: LabelMap = {};
let cachedAt = 0;
let inflight: Promise<LabelMap> | null = null;

/** يبني الخريطة النهائية: المخصص إن وُجد، وإلا الافتراضي. */
function toMap(rows: UiLabelRow[]): LabelMap {
  const map: LabelMap = {};
  for (const row of rows) {
    const custom = row.custom_text?.trim();
    map[row.label_key] = custom && custom.length > 0 ? custom : row.default_text;
  }
  return map;
}

/** كل الصفوف بتفاصيلها — لشاشة الإدارة. */
export async function loadLabelRows(): Promise<UiLabelRow[]> {
  const { data, error } = await supabase
    .from("mkt_ui_labels")
    .select("id, label_key, default_text, custom_text, screen, context_ar, updated_at, updated_by")
    .order("label_key", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UiLabelRow[];
}

/** خريطة المسميات مع تخزين مؤقت في الذاكرة. */
export async function loadLabelMap(force = false): Promise<LabelMap> {
  const fresh = Date.now() - cachedAt < TTL_MS;
  if (!force && fresh && Object.keys(cache).length > 0) return cache;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("mkt_ui_labels")
      .select("label_key, default_text, custom_text")
      .limit(2000);
    if (error) return cache;
    cache = toMap((data ?? []) as UiLabelRow[]);
    cachedAt = Date.now();
    return cache;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function clearLabelCache(): void {
  cache = {};
  cachedAt = 0;
}

/** قراءة متزامنة من المخزن — تُرجع الافتراضي حتى تصل الخريطة. */
export function labelFromCache(key: string, fallback: string): string {
  return cache[key] ?? fallback;
}

/** تعديل نص مسمّى (الإدارة فقط عبر سياسات القاعدة). `null` يعيده للافتراضي. */
export async function setLabelCustom(labelKey: string, text: string | null): Promise<void> {
  const clean = text === null ? null : sanitizeLabelText(text);
  const { error } = await supabase
    .from("mkt_ui_labels")
    .update({ custom_text: clean })
    .eq("label_key", labelKey);
  if (error) throw error;
  clearLabelCache();
}

/** نص صافٍ: بلا وسوم ولا أسطر جديدة، وبحد ٨٠ حرفًا. */
export function sanitizeLabelText(text: string): string | null {
  const clean = text.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, LABEL_MAX_LENGTH);
  return clean.length > 0 ? clean : null;
}

/**
 * الاستخدام في الواجهات: `const label = useLabels();`
 * ثم `label("aqar.provider", "المزوّد")` — الافتراضي في الكود ضمانًا لعدم
 * ظهور مفاتيح فارغة لو تعذّرت القراءة.
 */
export function useLabels(): (key: string, fallback: string) => string {
  const query = useQuery({
    queryKey: ["mkt", "ui-labels"],
    queryFn: () => loadLabelMap(),
    staleTime: TTL_MS,
    gcTime: 30 * 60 * 1000,
  });
  const map = query.data ?? cache;
  return (key: string, fallback: string) => map[key] ?? fallback;
}
