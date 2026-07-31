import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "attachments";
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];

export function isAllowedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXT.includes(ext);
}

function safeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-\u0600-\u06FF]/g, "");
  return (cleaned || "file").slice(-120);
}

export interface UploadTarget {
  projectId: string;
  entityType: string;
  entityId: string;
  stageId?: string | null;
  note?: string | null;
  /** e.g. "stage_doc" | "payment_receipt" */
  kind?: string;
  userId?: string | null;
}

/** Uploads files as new original copies (never replaces an existing object) and records them. */
export async function uploadAttachments(files: File[], target: UploadTarget): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    if (!isAllowedFile(file)) throw new Error("FILE_TYPE");
    const id = crypto.randomUUID();
    const path = `projects/${target.projectId}/${id}/${safeName(file.name)}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      ...(file.type ? { contentType: file.type } : {}),
    });

    if (upload.error) throw upload.error;
    const { error } = await supabase.from("attachments").insert({
      id,
      entity_type: target.entityType,
      entity_id: target.entityId,
      project_id: target.projectId,
      stage_id: target.stageId ?? null,
      note: target.note?.trim() || null,
      kind: target.kind ?? null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
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
