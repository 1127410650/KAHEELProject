/**
 * «خدمات الذكاء» — طبقة البيانات المشتركة بين شاشة الخدمات (/admin/ai) وأدوات
 * الوسائط: سجل الاستخدام الموحّد (`mkt_ai_usage`)، وأرشفة النسخة الأصلية قبل
 * أي تحسين (الأصل لا يُستبدل أبدًا)، ورفع النسخة المحسّنة إلى مكتبة الوسائط.
 *
 * كل نداء يمرّ بدوال القاعدة التي تفحص صفة مسؤول المنصة، والحوكمة المالية
 * (السقف الشهري لكل قدرة + الإيقاف التلقائي) تُطبَّق قبل أي عملية تحسين.
 */
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_SLOT_BUCKET } from "@/lib/mkt-media-slots";

/** مسار أرشيف النسخ الأصلية — يحفظ الأصل قبل اعتماد أي نسخة محسّنة. */
export const ORIGINAL_ARCHIVE_PREFIX = "public/enhanced-originals";
/** مسار النسخ المحسّنة المعتمدة في مكتبة الوسائط. */
export const ENHANCED_PREFIX = "public/enhanced";

export type AiService = "generation" | "enhancement";

export interface AiUsageEntry {
  id: string;
  service: string;
  actor: string | null;
  actor_name: string | null;
  action: string | null;
  prompt: string | null;
  status: string;
  cost_estimate: number;
  created_at: string;
}

/** آخر عمليات الخدمة من السجل الموحّد (مسؤول المنصة فقط). */
export async function loadAiUsage(service: AiService, limit = 20): Promise<AiUsageEntry[]> {
  const { data, error } = await supabase.rpc("mkt_ai_usage_recent", {
    _service: service,
    _limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as AiUsageEntry[]).map((row) => ({
    ...row,
    cost_estimate: Number(row.cost_estimate ?? 0),
  }));
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9._-]/gi, "-").slice(-48) || "image";
}

async function put(path: string, body: Blob, contentType: string): Promise<string> {
  const { error } = await supabase.storage
    .from(MEDIA_SLOT_BUCKET)
    .upload(path, body, { contentType, cacheControl: "3600", upsert: false });
  if (error) throw error;
  return supabase.storage.from(MEDIA_SLOT_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** يحفظ نسخة من الأصل قبل اعتماد التحسين، فلا يُفقد الأصل إطلاقًا. */
export async function archiveOriginal(
  blob: Blob,
  label: string,
): Promise<{ path: string; url: string }> {
  const path = `${ORIGINAL_ARCHIVE_PREFIX}/${safeName(label)}-${crypto.randomUUID()}.webp`;
  const url = await put(path, blob, blob.type || "image/webp");
  return { path, url };
}

/** يرفع النسخة المحسّنة إلى المكتبة كنسخة مستقلة بعلامة ✨. */
export async function saveEnhancedCopy(
  blob: Blob,
  label: string,
): Promise<{ path: string; url: string }> {
  const path = `${ENHANCED_PREFIX}/${safeName(label)}-${crypto.randomUUID()}.webp`;
  const url = await put(path, blob, "image/webp");
  return { path, url };
}

/** يجلب صورة موجودة (فتحة أو مكتبة) كـ Blob لتحسينها. */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("FETCH_FAILED");
  return response.blob();
}

/** تحويل Blob إلى base64 للمسار الخارجي (دالة الخادم). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}
