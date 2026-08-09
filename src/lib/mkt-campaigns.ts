/**
 * Animated ad campaigns (Keeta-style).
 *
 * Three placements only — the home banner rail, the compact home strip between
 * the main field cards, and a once-a-day welcome takeover.
 * A campaign is a row in `mkt_ad_campaigns` plus one object in the public media
 * folder (`public/campaigns/…`). The browser never writes performance data
 * directly: `mkt_ad_campaign_track` is the single definer that validates the
 * campaign is live, records the event and bumps the counter, so a stale or
 * forged client cannot inflate a campaign.
 *
 * Asset budgets are enforced here *and* by sniffing the real magic bytes, so an
 * `.json` that is really a video, or a 6 MB "banner", never reaches storage.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";

export type CampaignPlacement = "home_banner" | "home_strip" | "welcome_takeover";
export type CampaignAssetKind = "lottie" | "webp" | "mp4" | "image";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface Campaign {
  id: string;
  slug: string;
  placement: CampaignPlacement;
  asset_kind: CampaignAssetKind;
  asset_path: string;
  poster_path: string | null;
  asset_width: number;
  asset_height: number;
  title_ar: string;
  title_en: string;
  subtitle_ar: string;
  subtitle_en: string;
  badge_ar: string;
  badge_en: string;
  cta_ar: string;
  cta_en: string;
  click_url: string;
  /** Entry side of the compact popup: 'auto' | bottom | top | left | right. */
  popup_side: string;
  /** Mascot drawn in the popup: 'auto' | moto | lounge | wave | peek. */
  popup_mascot: string;
  priority: number;
  status: CampaignStatus;
  starts_at: string;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
}

const COLUMNS =
  "id, slug, placement, asset_kind, asset_path, poster_path, asset_width, asset_height, " +
  "title_ar, title_en, subtitle_ar, subtitle_en, badge_ar, badge_en, cta_ar, cta_en, " +
  "click_url, popup_side, popup_mascot, priority, status, starts_at, ends_at, impressions, clicks, created_at";

/** Per-kind ceilings, in bytes. Kept small on purpose: these load on first paint. */
export const CAMPAIGN_LIMITS: Record<CampaignAssetKind, number> = {
  lottie: 300 * 1024,
  webp: 1024 * 1024,
  image: 1024 * 1024,
  mp4: 2 * 1024 * 1024,
};

export const CAMPAIGN_ACCEPT = "application/json,.json,image/webp,image/jpeg,image/png,video/mp4";

/** Real type from the leading bytes; the file extension is never trusted. */
export function sniffCampaignKind(buffer: ArrayBuffer): CampaignAssetKind | null {
  const b = new Uint8Array(buffer);
  if (b.length < 12) return null;
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...Array.from(b.slice(start, end)));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image";
  if (ascii(4, 8) === "ftyp") return "mp4";
  // Lottie is plain JSON: allow leading whitespace before the object.
  const head = ascii(0, 12).trimStart();
  if (head.startsWith("{")) return "lottie";
  return null;
}

export function extensionFor(kind: CampaignAssetKind): string {
  if (kind === "lottie") return "json";
  if (kind === "webp") return "webp";
  if (kind === "mp4") return "mp4";
  return "jpg";
}

export interface PreparedCampaignAsset {
  blob: Blob;
  kind: CampaignAssetKind;
  width: number;
  height: number;
  error?: "type" | "tooLarge" | "corrupt";
}

/** Validate a picked file and read its natural size (needed for zero-CLS boxes). */
export async function prepareCampaignAsset(file: File): Promise<PreparedCampaignAsset> {
  const buffer = await file.arrayBuffer();
  const kind = sniffCampaignKind(buffer);
  if (!kind) return { blob: file, kind: "image", width: 0, height: 0, error: "type" };
  if (file.size > CAMPAIGN_LIMITS[kind])
    return { blob: file, kind, width: 0, height: 0, error: "tooLarge" };

  if (kind === "lottie") {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(buffer)) as { w?: number; h?: number };
      const width = Number(parsed.w) || 1000;
      const height = Number(parsed.h) || 1000;
      return { blob: new Blob([buffer], { type: "application/json" }), kind, width, height };
    } catch {
      return { blob: file, kind, width: 0, height: 0, error: "corrupt" };
    }
  }

  if (kind === "mp4") {
    const size = await videoSize(file).catch(() => null);
    if (!size) return { blob: file, kind, width: 0, height: 0, error: "corrupt" };
    return { blob: file, kind, ...size };
  }

  try {
    const bitmap = await createImageBitmap(new Blob([buffer], { type: file.type || "image/webp" }));
    const out = { blob: file, kind, width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return out;
  } catch {
    return { blob: file, kind, width: 0, height: 0, error: "corrupt" };
  }
}

function videoSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const out = { width: video.videoWidth, height: video.videoHeight };
      URL.revokeObjectURL(url);
      out.width && out.height ? resolve(out) : reject(new Error("NO_SIZE"));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("DECODE"));
    };
    video.src = url;
  });
}

export function campaignAssetPath(kind: CampaignAssetKind): string {
  return `public/campaigns/${crypto.randomUUID()}.${extensionFor(kind)}`;
}

/** Upload one campaign object. Only platform admins pass the storage policy. */
export async function uploadCampaignAsset(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage
    .from(MKT_BUCKET)
    .upload(path, blob, { cacheControl: "3600", upsert: false });
  if (error) throw error;
}

/** The bucket stays private, so even public assets are read through short links. */
export async function signCampaignPaths(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const wanted = paths.filter(Boolean);
  if (wanted.length === 0) return out;
  const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrls(wanted, 3600);
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

export interface LiveCampaign extends Campaign {
  assetUrl: string | null;
  posterUrl: string | null;
}

/** Live campaigns for one placement, with playable URLs resolved. */
export function useLiveCampaigns(placement: CampaignPlacement) {
  return useQuery({
    queryKey: ["mkt", "campaigns", placement],
    staleTime: 300_000,
    queryFn: async (): Promise<LiveCampaign[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_campaigns")
        .select(COLUMNS)
        .eq("placement", placement)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .limit(8);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Campaign[];
      if (rows.length === 0) return [];
      const signed = await signCampaignPaths([
        ...rows.map((row) => row.asset_path),
        ...rows.map((row) => row.poster_path ?? ""),
      ]);
      return rows.map((row) => ({
        ...row,
        assetUrl: signed[row.asset_path] ?? null,
        posterUrl: row.poster_path ? (signed[row.poster_path] ?? null) : null,
      }));
    },
  });
}

const SESSION_KEY_STORE = "kaheel.campaign.session";
const seen = new Set<string>();

function sessionKey(): string {
  if (typeof window === "undefined") return "";
  let key = window.sessionStorage.getItem(SESSION_KEY_STORE);
  if (!key) {
    key = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY_STORE, key);
  }
  return key;
}

/** Fire-and-forget tracking. Impressions are counted once per session per card. */
export function trackCampaign(campaignId: string, kind: "impression" | "click"): void {
  if (typeof window === "undefined") return;
  const guard = `${kind}:${campaignId}`;
  if (kind === "impression") {
    if (seen.has(guard)) return;
    seen.add(guard);
  }
  void supabase
    .rpc("mkt_ad_campaign_track", {
      _campaign_id: campaignId,
      _kind: kind,
      _session_key: sessionKey(),
    })
    .then(() => undefined);
}

// ── Welcome takeover frequency ──────────────────────────────────────────────
const TAKEOVER_KEY = "kaheel.takeover.lastSeen";
const TAKEOVER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function takeoverAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(TAKEOVER_KEY);
    if (!raw) return true;
    return Date.now() - Number(raw) > TAKEOVER_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function markTakeoverSeen(): void {
  try {
    window.localStorage.setItem(TAKEOVER_KEY, String(Date.now()));
  } catch {
    /* private mode: the takeover simply shows again next visit */
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────
export function useAdminCampaigns(enabled: boolean) {
  return useQuery({
    queryKey: ["mkt", "admin", "campaigns"],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<Campaign[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_campaigns")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
}

export type CampaignDraft = Omit<
  Campaign,
  "id" | "impressions" | "clicks" | "created_at" | "poster_path"
> & { poster_path?: string | null };

export function useSaveCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<CampaignDraft> }) => {
      if (id) {
        const { error } = await supabase.from("mkt_ad_campaigns").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("mkt_ad_campaigns")
        .insert(values as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "campaigns"] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mkt_ad_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "campaigns"] });
    },
  });
}
