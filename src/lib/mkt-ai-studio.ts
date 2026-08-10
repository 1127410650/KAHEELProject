/**
 * جانب المتصفح من «استوديو صور الهوية».
 *
 * لا مفتاح ولا نداء خارجي هنا: المتصفح يرسل الوصف إلى `generateBrandImages`
 * ويستلم بايتات PNG. كل صورة تُعاد ترميزها WebP (١٦٠٠px · ≤٣٠٠KB) ثم تُختَم
 * باسم كَحيل، فلا تُحفظ ولا تُربط بأي فتحة صورة غير مختومة. النسخة الأصلية
 * تُحفظ بجانب المختومة في المكتبة كما في الرفع اليدوي.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { compressToWebp } from "@/lib/media-compress";
import { stampImageBlob, type BrandStampOptions } from "@/lib/kaheel-brand-stamp";
import { MEDIA_SLOT_BUCKET, type MediaSlotRow } from "@/lib/mkt-media-slots";
import type { StudioSizeKey } from "@/lib/mkt-ai-studio.functions";

export type { StudioSizeKey };

export const AI_LIBRARY_PREFIX = "public/ai-library";

export const STUDIO_SIZES: { key: StudioSizeKey; label: string; hint: string }[] = [
  { key: "banner", label: "بانر عريض", hint: "1536×1024" },
  { key: "square", label: "مربع", hint: "1024×1024" },
  { key: "tile", label: "بلاطة تصنيف", hint: "1024×1024" },
  { key: "portrait", label: "طولي / ستوري", hint: "1024×1536" },
];

/** أفكار جاهزة بأسلوب الهوية — تختصر الكتابة على المدير. */
export const STUDIO_IDEAS: { label: string; prompt: string; sizeKey: StudioSizeKey }[] = [
  {
    label: "خلفية فلل فاخرة بغروب دافئ",
    prompt: "خلفية لفلل فاخرة حديثة مع نخيل وغروب دافئ، منظور واسع، أسلوب توضيحي ناعم",
    sizeKey: "banner",
  },
  {
    label: "بانر خدمات صيانة",
    prompt: "بانر لخدمات الصيانة المنزلية: أدوات مرتبة وأشكال هندسية ناعمة، بلا نصوص",
    sizeKey: "banner",
  },
  {
    label: "بلاطة تصنيف سيارات",
    prompt: "بلاطة صغيرة لتصنيف السيارات: سيارة واحدة مبسّطة بأسلوب ثلاثي الأبعاد ناعم",
    sizeKey: "tile",
  },
  {
    label: "خلفية سوق شعبي دمشقي",
    prompt: "خلفية سوق شعبي دمشقي بأقواس حجرية وفوانيس، أسلوب توضيحي عصري هادئ",
    sizeKey: "banner",
  },
];

export interface BudgetStatus {
  monthlyUsd: number;
  spentUsd: number;
  remainingUsd: number;
  count: number;
  dailyLimit: number;
  dailyUsed: number;
  blocked: boolean;
}

interface BudgetJson {
  monthly_usd?: number;
  spent_usd?: number;
  remaining_usd?: number;
  count?: number;
  daily_limit?: number;
  daily_used?: number;
  blocked?: boolean;
}

export const AI_BUDGET_QUERY_KEY = ["mkt", "admin", "ai-image-budget"] as const;

/** العدّاد الظاهر في الشاشة: التوليدات هذا الشهر، التكلفة، والمتبقي من السقف. */
export function useAiBudget(enabled = true) {
  return useQuery({
    queryKey: AI_BUDGET_QUERY_KEY,
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<BudgetStatus> => {
      const { data, error } = await supabase.rpc("mkt_ai_image_budget");
      if (error) throw error;
      const row = (data ?? {}) as BudgetJson;
      return {
        monthlyUsd: Number(row.monthly_usd ?? 0),
        spentUsd: Number(row.spent_usd ?? 0),
        remainingUsd: Number(row.remaining_usd ?? 0),
        count: Number(row.count ?? 0),
        dailyLimit: Number(row.daily_limit ?? 30),
        dailyUsed: Number(row.daily_used ?? 0),
        blocked: !!row.blocked,
      };
    },
  });
}

/** تعديل السقف الشهري من اللوحة — القاعدة تقيّده بين 0 و 5000 وتفحص صفة المدير. */
export async function setAiMonthlyBudget(usd: number): Promise<number> {
  const { data, error } = await supabase.rpc("mkt_ai_image_set_budget", { _usd: usd });
  if (error) throw error;
  return Number(data ?? usd);
}

export interface AiStudioJob {
  id: string;
  prompt: string;
  size_key: string;
  model: string;
  status: string;
  bytes: number;
  cost_usd: number;
  purpose: string | null;
  slot_key: string | null;
  created_at: string;
}

/** سجل التوليد: من ولّد، الوصف، الغرض، التكلفة، ومتى. */
export function useAiStudioJobs(enabled = true) {
  return useQuery({
    queryKey: ["mkt", "admin", "ai-studio-jobs"],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AiStudioJob[]> => {
      const { data, error } = await supabase
        .from("mkt_ai_image_jobs")
        .select("id, prompt, size_key, model, status, bytes, cost_usd, purpose, slot_key, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as AiStudioJob[];
    },
  });
}

export interface StudioCandidate {
  jobId: string;
  /** النسخة المختومة — هي التي تُنشر. */
  stamped: Blob;
  /** الأصلية بلا ختم — تُحفظ بجانبها. */
  original: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

function fileFrom(b64: string, mime: string): File {
  const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
  return new File([bytes], `ai-${crypto.randomUUID()}.png`, { type: mime });
}

/** PNG المولّد → WebP مضغوط + نسخة مختومة جاهزة للعرض. */
export async function prepareCandidate(
  jobId: string,
  b64: string,
  mime: string,
  stamp: BrandStampOptions,
): Promise<StudioCandidate> {
  const { blob, width, height } = await compressToWebp(fileFrom(b64, mime));
  const stamped = await stampImageBlob(blob, stamp);
  return {
    jobId,
    stamped,
    original: blob,
    previewUrl: URL.createObjectURL(stamped),
    width,
    height,
  };
}

/** ملف مرجعي يرفعه المدير → base64 مضغوط يُرسل مع الطلب. */
export async function referenceToBase64(file: File): Promise<{ b64: string; mime: string }> {
  const { blob } = await compressToWebp(file, { maxSide: 1024, maxBytes: 400 * 1024 });
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return { b64: btoa(binary), mime: "image/webp" };
}

async function put(path: string, body: Blob): Promise<void> {
  const { error } = await supabase.storage
    .from(MEDIA_SLOT_BUCKET)
    .upload(path, body, { contentType: "image/webp", cacheControl: "3600", upsert: false });
  if (error) throw error;
}

/** حفظ المرشّح في المكتبة (مختومة + أصلية) وإغلاق سجله. */
export async function saveCandidateToLibrary(candidate: StudioCandidate): Promise<string> {
  const id = crypto.randomUUID();
  const stampedPath = `${AI_LIBRARY_PREFIX}/${id}.webp`;
  const originalPath = `${AI_LIBRARY_PREFIX}/${id}--original.webp`;
  await put(stampedPath, candidate.stamped);
  await put(originalPath, candidate.original).catch(() => undefined);
  await supabase.rpc("mkt_ai_image_finish", {
    _job_id: candidate.jobId,
    _status: "approved",
    _bytes: candidate.stamped.size,
    _asset_path: stampedPath,
  });
  return stampedPath;
}

/** ربط المرشّح بفتحة صورة: المختومة تُنشر، والأصلية تبقى محفوظة بجانبها. */
export async function attachCandidateToSlot(
  slot: MediaSlotRow,
  candidate: StudioCandidate,
): Promise<void> {
  const safe = slot.slot_key.replace(/[^a-z0-9._-]/gi, "-");
  const id = crypto.randomUUID();
  const path = `${AI_LIBRARY_PREFIX}/${safe}/${id}.webp`;
  const originalPath = `${AI_LIBRARY_PREFIX}/${safe}/${id}--original.webp`;

  await put(path, candidate.stamped);
  await put(originalPath, candidate.original).catch(() => undefined);

  const { error } = await supabase.rpc("mkt_admin_slot_set_draft", {
    _slot_key: slot.slot_key,
    _patch: { path, path_original: originalPath } as never,
  });
  if (error) throw error;
  const { error: publishError } = await supabase.rpc("mkt_admin_slot_publish", {
    _slot_key: slot.slot_key,
  });
  if (publishError) throw publishError;

  await supabase.rpc("mkt_ai_image_finish", {
    _job_id: candidate.jobId,
    _status: "approved",
    _bytes: candidate.stamped.size,
    _asset_path: path,
  });
}

export interface LibraryItem {
  path: string;
  url: string;
  createdAt: string | null;
}

/** مكتبة الصور المولّدة (النسخ المختومة فقط) مع روابط موقّعة للمعاينة. */
export function useAiLibrary(enabled = true) {
  return useQuery({
    queryKey: ["mkt", "admin", "ai-library"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase.storage
        .from(MEDIA_SLOT_BUCKET)
        .list(AI_LIBRARY_PREFIX, { limit: 60, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const files = (data ?? []).filter(
        (item) => item.name.endsWith(".webp") && !item.name.endsWith("--original.webp"),
      );
      if (files.length === 0) return [];
      const paths = files.map((item) => `${AI_LIBRARY_PREFIX}/${item.name}`);
      const { data: urls } = await supabase.storage
        .from(MEDIA_SLOT_BUCKET)
        .createSignedUrls(paths, 3600);
      return files.map((item, index) => ({
        path: paths[index]!,
        url: urls?.[index]?.signedUrl ?? "",
        createdAt: item.created_at ?? null,
      }));
    },
  });
}

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
