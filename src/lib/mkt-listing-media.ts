/**
 * Ad photos: validation, compression and staged upload.
 *
 * Files are checked by their real magic bytes (never by extension), compressed
 * in the browser, fingerprinted so the same photo cannot be added twice, and
 * uploaded to a *private* staging folder while the ad is being edited. Only on
 * save are the objects moved under `listings/…`, the single prefix the public
 * read policy allows, so a draft photo is never reachable by visitors.
 */

import { supabase } from "@/integrations/supabase/client";
import { supabasePublicConfig } from "@/integrations/supabase/public-config";
import { MKT_BUCKET } from "@/lib/mkt";

/** Actual policy limit shown in the UI — keep the texts in sync with this. */
export const MAX_LISTING_IMAGES = 20;
/** Largest accepted source file, before compression. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.82;

export type ImageMime = (typeof ACCEPTED_IMAGE_MIME)[number];
export type MediaError = "type" | "tooLarge" | "corrupt" | "duplicate" | "limit" | "upload";

export interface StagedImage {
  /** Local id, stable across reorders. */
  id: string;
  kind: "staged" | "stored";
  /** Row id when the photo already belongs to a saved ad. */
  storedId?: string | undefined;
  /** Storage object path (staging/… while editing, listings/… once attached). */
  path: string | null;
  name: string;
  bytes: number;
  fingerprint: string;
  status: "uploading" | "ready" | "failed";
  progress: number;
  error?: MediaError | undefined;
  /** Blob kept only in memory so a failed upload can be retried. */
  blob?: Blob | undefined;
  /** Real pixel size after compression, stored with the row. */
  width?: number | undefined;
  height?: number | undefined;
  mime?: string | undefined;
  /** SHA-256 of the source bytes, stored as `file_hash`. */
  hash?: string | undefined;
  /** Object URL for instant preview; signed URL after a refresh. */
  preview?: string | undefined;
}

/** Draft-safe subset persisted in sessionStorage. */
export interface StagedImageMeta {
  id: string;
  kind: "staged" | "stored";
  storedId?: string | undefined;
  path: string;
  name: string;
  bytes: number;
  fingerprint: string;
}

export function toMeta(item: StagedImage): StagedImageMeta | null {
  if (item.status !== "ready" || !item.path) return null;
  return {
    id: item.id,
    kind: item.kind,
    ...(item.storedId ? { storedId: item.storedId } : {}),
    path: item.path,
    name: item.name,
    bytes: item.bytes,
    fingerprint: item.fingerprint,
  };
}

/** Detect the real type from the leading bytes; extensions are not trusted. */
export function sniffImageMime(buffer: ArrayBuffer): ImageMime | null {
  const b = new Uint8Array(buffer);
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!);
  const webp = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

export async function fingerprint(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode + downscale + re-encode. Throws when the bytes are not a real image. */
export async function compressImage(
  buffer: ArrayBuffer,
  mime: ImageMime,
): Promise<{ blob: Blob; width: number; height: number }> {
  const source = new Blob([buffer], { type: mime });
  const bitmap = await createImageBitmap(source); // throws on corrupt data
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: source, width: bitmap.width, height: bitmap.height };
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const encoded = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  // Never grow the file: keep the original when re-encoding does not help.
  if (!encoded || encoded.size >= source.size) return { blob: source, width, height };
  return { blob: encoded, width, height };
}

export interface PreparedFile {
  blob: Blob;
  fingerprint: string;
  mime: string;
  width?: number | undefined;
  height?: number | undefined;
  error?: MediaError | undefined;
}

/** Validate one picked file and return the blob that should be uploaded. */
export async function prepareFile(file: File): Promise<PreparedFile> {
  if (file.size > MAX_IMAGE_BYTES)
    return { blob: file, fingerprint: "", mime: file.type, error: "tooLarge" };
  const buffer = await file.arrayBuffer();
  const mime = sniffImageMime(buffer);
  if (!mime) return { blob: file, fingerprint: "", mime: file.type, error: "type" };
  const print = await fingerprint(buffer);
  try {
    const { blob, width, height } = await compressImage(buffer, mime);
    return { blob, fingerprint: print, mime: blob.type || mime, width, height };
  } catch {
    return { blob: file, fingerprint: print, mime, error: "corrupt" };
  }
}

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function stagingPath(userId: string, draftId: string, mime: string): string {
  return `staging/${userId}/${draftId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
}

export function attachedPath(userId: string, listingId: string, mime: string): string {
  return `listings/${userId}/${listingId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
}

/**
 * Upload one object with real progress. `supabase-js` gives no progress events,
 * so the storage REST endpoint is called directly with the user's own token.
 */
export async function uploadWithProgress(
  path: string,
  blob: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("NO_SESSION");
  const { url: base, publishableKey: apiKey } = supabasePublicConfig;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${MKT_BUCKET}/${path}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");
    if (blob.type) xhr.setRequestHeader("content-type", blob.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP_${xhr.status}`));
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.onabort = () => reject(new Error("ABORTED"));
    xhr.send(blob);
  });
}

/** Short-lived links; the bucket itself stays private. */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const { data } = await supabase.storage.from(MKT_BUCKET).createSignedUrls(paths, 900);
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

/** Best-effort removal of objects that never made it into an ad. */
export async function removeObjects(paths: string[]): Promise<void> {
  const staged = paths.filter((p) => !!p);
  if (staged.length === 0) return;
  try {
    await supabase.storage.from(MKT_BUCKET).remove(staged);
  } catch {
    /* the nightly storage sweep picks up whatever the browser could not delete */
  }
}

/** Delete every leftover object of a draft folder (orphan cleanup). */
export async function cleanupDraftFolder(userId: string, draftId: string): Promise<void> {
  try {
    const prefix = `staging/${userId}/${draftId}`;
    const { data } = await supabase.storage.from(MKT_BUCKET).list(prefix, { limit: 100 });
    const paths = (data ?? []).map((entry) => `${prefix}/${entry.name}`);
    await removeObjects(paths);
  } catch {
    /* ignore */
  }
}

/** Move a staged object under the public-readable ad prefix. */
export async function attachObject(from: string, to: string): Promise<string> {
  const { error } = await supabase.storage.from(MKT_BUCKET).move(from, to);
  if (error) throw error;
  return to;
}

/** Categories whose ads are meaningless without a photo. */
const IMAGE_REQUIRED_ROOTS = new Set([
  "real-estate",
  "equipment",
  "building-materials",
  "factories",
]);

export function imagesRequired(rootSlug: string | null, isWanted: boolean): boolean {
  if (isWanted) return false;
  return !!rootSlug && IMAGE_REQUIRED_ROOTS.has(rootSlug);
}
