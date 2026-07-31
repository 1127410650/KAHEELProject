import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "attachments";
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

export function isAllowedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXT.includes(ext);
}

export function isAllowedSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

function safeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-\u0600-\u06FF]/g, "");
  return (cleaned || "file").slice(-120);
}

async function sha256(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export interface UploadTarget {
  /** Project scope when the entity belongs to one; null for project-less general requests. */
  projectId?: string | null;
  /** Always pass the owning request id so project-less files still get a scoped storage path. */
  requestId?: string | null;
  entityType: string;
  entityId: string;
  stageId?: string | null;
  note?: string | null;
  /** e.g. "stage_doc" | "payment_receipt" | "message" | "supervisor_reply" */
  kind?: string;
  uploaderRole?: string | null;
  userId?: string | null;
}

/**
 * Uploads files as new original copies — never replaces or overwrites an existing object.
 * Re-uploading the same name creates a new version; identical content is rejected as duplicate.
 */
export async function uploadAttachments(files: File[], target: UploadTarget): Promise<string[]> {
  const scope = target.projectId
    ? `projects/${target.projectId}`
    : target.requestId
      ? `requests/${target.requestId}`
      : null;
  if (!scope) throw new Error("NO_SCOPE");

  const ids: string[] = [];
  for (const file of files) {
    if (!isAllowedFile(file)) throw new Error("FILE_TYPE");
    if (!isAllowedSize(file)) throw new Error("FILE_SIZE");

    const hash = await sha256(file);

    // Duplicate guard: same content already attached to this entity.
    if (hash) {
      const { data: dup } = await supabase
        .from("attachments")
        .select("id")
        .eq("entity_type", target.entityType)
        .eq("entity_id", target.entityId)
        .eq("file_hash", hash)
        .is("deleted_at", null)
        .limit(1);
      if (dup && dup.length > 0) throw new Error("DUPLICATE_FILE");
    }

    // Version number for the same original file name under this entity.
    const { count } = await supabase
      .from("attachments")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", target.entityType)
      .eq("entity_id", target.entityId)
      .eq("file_name", file.name);

    const id = crypto.randomUUID();
    const path = `${scope}/${id}/${safeName(file.name)}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      ...(file.type ? { contentType: file.type } : {}),
    });

    if (upload.error) throw upload.error;
    const { error } = await supabase.from("attachments").insert({
      id,
      entity_type: target.entityType,
      entity_id: target.entityId,
      project_id: target.projectId ?? null,
      stage_id: target.stageId ?? null,
      note: target.note?.trim() || null,
      kind: target.kind ?? null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      file_hash: hash,
      version: (count ?? 0) + 1,
      uploader_role: target.uploaderRole ?? null,
      storage_path: path,
      created_by: target.userId ?? null,
    });
    if (error) throw error;
    ids.push(id);
  }
  return ids;
}

/** Short-lived signed URL for authorized preview/download. */
export async function signedUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error("SIGNED_URL");
  return data.signedUrl;
}

export async function openAttachment(path: string) {
  const url = await signedUrl(path);
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function downloadAttachment(path: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300, { download: fileName });
  if (error || !data?.signedUrl) throw error ?? new Error("SIGNED_URL");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
