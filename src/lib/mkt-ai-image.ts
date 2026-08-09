/**
 * Client side of the campaign image studio.
 *
 * The model returns a PNG that is comfortably over the 1 MB campaign image
 * ceiling, so the browser re-encodes it to WebP before anything is uploaded —
 * the same ceiling that applies to a hand-picked file still applies here, and an
 * over-budget result is refused instead of quietly shipped to the home page.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { applyKaheelWatermark } from "@/lib/kaheel-watermark";
import { CAMPAIGN_LIMITS, campaignAssetPath, uploadCampaignAsset } from "@/lib/mkt-campaigns";
import type { AiImageSizeKey } from "@/lib/mkt-ai-image.functions";

export type { AiImageSizeKey };

export const AI_SIZES: { key: AiImageSizeKey; ar: string; en: string; hint: string }[] = [
  { key: "banner", ar: "بانر عريض", en: "Wide banner", hint: "1536×1024" },
  { key: "square", ar: "مربع للنافذة", en: "Square popup", hint: "1024×1024" },
  { key: "character", ar: "شخصية بخلفية بيضاء", en: "Character on white", hint: "1024×1024" },
];

export interface AiPreset {
  key: string;
  ar: string;
  en: string;
  sizeKey: AiImageSizeKey;
  prompt: string;
}

export const AI_PRESETS: AiPreset[] = [
  {
    key: "kaheelan",
    ar: "شخصية كَحيلان",
    en: "Kaheelan character",
    sizeKey: "character",
    prompt:
      "رجل شامي مرح، شارب مفتول، طاقية سوداء، صدرية مطرّزة حمراء، كوفية على الكتفين، يرفع عصاية خشبية، أسلوب ثلاثي الأبعاد، خلفية شفافة",
  },
  {
    key: "kaheel",
    ar: "شخصية كَحيل",
    en: "Kaheel character",
    sizeKey: "character",
    prompt: "شاب عربي أنيق مبتسم، قميص بنفسجي، وضعية ترحيب، نفس الأسلوب الثلاثي الأبعاد",
  },
  {
    key: "sale_banner",
    ar: "بانر عرض",
    en: "Sale banner",
    sizeKey: "banner",
    prompt: "بانر تخفيضات بألوان بنفسجية، أسلوب عصري",
  },
];

export interface GeneratedAsset {
  /** Object URL for preview. */
  previewUrl: string;
  blob: Blob;
  width: number;
  height: number;
  jobId?: string | undefined;
}

/** Re-encode the model PNG to WebP and read its natural size. */
export async function toCampaignWebp(b64: string, mime: string): Promise<GeneratedAsset> {
  const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let blob: Blob | null = null;
  for (const quality of [0.86, 0.72, 0.6]) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((out) => resolve(out), "image/webp", quality),
    );
    if (blob && blob.size <= CAMPAIGN_LIMITS.webp) break;
  }
  if (!blob) throw new Error("ENCODE_FAILED");
  // كل صورة يولّدها الاستوديو ملك المنصة → تحمل العلامة والحقوق قبل المعاينة.
  blob = await applyKaheelWatermark(blob);
  if (blob.size > CAMPAIGN_LIMITS.webp) throw new Error("TOO_LARGE");

  return {
    previewUrl: URL.createObjectURL(blob),
    blob,
    width: canvas.width,
    height: canvas.height,
  };
}

export interface UploadedAiAsset {
  path: string;
  width: number;
  height: number;
}

/** Upload the accepted candidate under `public/campaigns/…` and close its log row. */
export async function approveAiAsset(asset: GeneratedAsset): Promise<UploadedAiAsset> {
  const path = campaignAssetPath("webp");
  await uploadCampaignAsset(path, asset.blob);
  if (asset.jobId) {
    await supabase.rpc("mkt_ai_image_finish", {
      _job_id: asset.jobId,
      _status: "approved",
      _bytes: asset.blob.size,
      _asset_path: path,
    });
  }
  return { path, width: asset.width, height: asset.height };
}

export interface AiImageJob {
  id: string;
  prompt: string;
  size_key: string;
  model: string;
  status: string;
  bytes: number;
  cost_credits: number;
  asset_path: string | null;
  created_at: string;
}

/** Recent generations — the audit trail the studio shows under the form. */
export function useAiImageJobs(enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "admin", "ai-image-jobs"],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AiImageJob[]> => {
      const { data, error } = await supabase
        .from("mkt_ai_image_jobs")
        .select("id, prompt, size_key, model, status, bytes, cost_credits, asset_path, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as AiImageJob[];
    },
  });
}
