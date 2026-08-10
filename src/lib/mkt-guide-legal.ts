/**
 * Legal layer for the Syria guide: correction/removal requests, the admin
 * queues that decide them, and the evidence-backed ownership claim.
 *
 * Two rules are enforced here, not just in the UI:
 * 1) Removal is always a soft delete — the record is unpublished with a reason
 *    and a date, and is never deleted from the table.
 * 2) Claim documents live in a private bucket and are only ever read through a
 *    short-lived signed URL, after the row-level policies allowed the read.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const CLAIM_DOC_BUCKET = "mkt-guide-claims";
export const CLAIM_DOC_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const CLAIM_DOC_MAX_BYTES = 8 * 1024 * 1024;
export const CLAIM_DOC_RETENTION_DAYS = 90;

/* ── removal / correction requests ───────────────────────────────────────── */

export type RemovalRequestType = "correction" | "removal";
export type RemovalRequestStatus = "new" | "reviewing" | "done" | "rejected";

export const REMOVAL_STATUS_LABEL: Record<RemovalRequestStatus, string> = {
  new: "جديد",
  reviewing: "قيد المراجعة",
  done: "منفّذ",
  rejected: "مرفوض",
};

export const REMOVAL_TYPE_LABEL: Record<RemovalRequestType, string> = {
  correction: "تصحيح",
  removal: "إزالة",
};

export interface GuideRemovalRequest {
  id: string;
  place_id: string | null;
  entity_name: string;
  reporter_role: string;
  request_type: RemovalRequestType;
  description: string;
  contact: string;
  status: RemovalRequestStatus;
  decision_note: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const REMOVAL_COLUMNS =
  "id,place_id,entity_name,reporter_role,request_type,description,contact,status,decision_note,created_by,reviewed_by,reviewed_at,created_at";

export interface RemovalRequestInput {
  placeId: string | null;
  entityName: string;
  reporterRole: string;
  requestType: RemovalRequestType;
  description: string;
  contact: string;
  userId: string | null;
}

export function useSubmitGuideRemovalRequest() {
  return useMutation({
    mutationFn: async (input: RemovalRequestInput) => {
      const { error } = await supabase.from("mkt_guide_removal_requests").insert({
        place_id: input.placeId,
        entity_name: input.entityName.trim().slice(0, 200),
        reporter_role: input.reporterRole.trim().slice(0, 100),
        request_type: input.requestType,
        description: input.description.trim().slice(0, 2000),
        contact: input.contact.trim().slice(0, 200),
        created_by: input.userId,
      });
      if (error) throw error;
    },
  });
}

export function useGuideRemovalQueue(enabled: boolean, status: RemovalRequestStatus) {
  return useQuery({
    queryKey: ["mkt", "admin", "guide-removals", status],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<GuideRemovalRequest[]> => {
      const { data, error } = await supabase
        .from("mkt_guide_removal_requests")
        .select(REMOVAL_COLUMNS)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as GuideRemovalRequest[];
    },
  });
}

/**
 * A decision never deletes anything: `done` on a removal request unpublishes
 * the linked place and stamps it with the reason, the date and the admin.
 */
export function useDecideGuideRemovalRequest(adminId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      request: GuideRemovalRequest;
      status: RemovalRequestStatus;
      note: string | null;
    }) => {
      const { error } = await supabase
        .from("mkt_guide_removal_requests")
        .update({
          status: input.status,
          decision_note: input.note,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.request.id);
      if (error) throw error;

      const softDelete =
        input.status === "done" &&
        input.request.request_type === "removal" &&
        input.request.place_id;
      if (softDelete) {
        const { error: placeError } = await supabase
          .from("mkt_guide_places")
          .update({
            is_published: false,
            removed_at: new Date().toISOString(),
            removed_reason: input.note ?? "طلب إزالة من الجهة",
            removed_by: adminId,
          })
          .eq("id", input.request.place_id!);
        if (placeError) throw placeError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-removals"] });
      void queryClient.invalidateQueries({ queryKey: ["guide-places"] });
      void queryClient.invalidateQueries({ queryKey: ["guide-place"] });
    },
  });
}

/* ── ownership claims with mandatory documents ───────────────────────────── */

export type ClaimStatus = "pending" | "approved" | "rejected";

export interface GuideClaimDocument {
  id: string;
  claim_id: string;
  doc_kind: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export const CLAIM_DOC_KIND_LABEL: Record<string, string> = {
  commercial_register: "سجل تجاري",
  license: "ترخيص",
  authorization: "تفويض رسمي",
  other: "مستند آخر",
};

export interface AdminGuideClaim {
  id: string;
  place_id: string;
  user_id: string;
  status: ClaimStatus;
  applicant_name: string | null;
  applicant_role: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  evidence: string | null;
  contact: string | null;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  documents_purged_at: string | null;
  created_at: string;
  documents: GuideClaimDocument[];
  place_name: string | null;
  place_slug: string | null;
}

const CLAIM_ADMIN_COLUMNS =
  "id,place_id,user_id,status,applicant_name,applicant_role,phone,phone_verified_at,evidence,contact,reject_reason,reviewed_by,reviewed_at,documents_purged_at,created_at";

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Documents are stored under `<user id>/<claim id>/…` because the bucket policy
 * keys ownership on the first folder segment: a direct file URL from anyone
 * else — signed-out or signed-in — is refused by storage itself.
 */
export async function uploadClaimDocuments(input: {
  claimId: string;
  userId: string;
  files: { file: File; kind: string }[];
}): Promise<void> {
  for (const entry of input.files) {
    if (entry.file.size > CLAIM_DOC_MAX_BYTES) throw new Error("DOC_TOO_LARGE");
    const path = `${input.userId}/${input.claimId}/${crypto.randomUUID()}.${fileExtension(entry.file)}`;
    const { error: uploadError } = await supabase.storage
      .from(CLAIM_DOC_BUCKET)
      .upload(path, entry.file, { contentType: entry.file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error } = await supabase.from("mkt_guide_claim_documents").insert({
      claim_id: input.claimId,
      user_id: input.userId,
      doc_kind: entry.kind,
      storage_path: path,
      mime_type: entry.file.type || null,
      size_bytes: entry.file.size,
    });
    if (error) throw error;
  }
}

/** A claim is only ever created as `pending`; approval stays manual. */
export function useSubmitGuideClaim(placeId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      applicantName: string;
      applicantRole: "owner" | "agent";
      phone: string;
      phoneVerified: boolean;
      evidence: string;
      files: { file: File; kind: string }[];
    }) => {
      if (!placeId || !userId) throw new Error("AUTH_REQUIRED");
      if (!input.phoneVerified) throw new Error("PHONE_NOT_VERIFIED");
      if (input.files.length === 0) throw new Error("DOC_REQUIRED");

      const { data, error } = await supabase
        .from("mkt_guide_place_claims")
        .insert({
          place_id: placeId,
          user_id: userId,
          status: "pending",
          applicant_name: input.applicantName.trim().slice(0, 120),
          applicant_role: input.applicantRole,
          phone: input.phone,
          phone_verified_at: new Date().toISOString(),
          evidence: input.evidence.trim().slice(0, 800) || null,
          contact: input.phone,
        })
        .select("id")
        .single();
      if (error) throw error;

      await uploadClaimDocuments({
        claimId: (data as { id: string }).id,
        userId,
        files: input.files,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-claim"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-claims"] });
    },
  });
}

export function useAdminGuideClaims(enabled: boolean, status: ClaimStatus) {
  return useQuery({
    queryKey: ["mkt", "admin", "guide-claims", status],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<AdminGuideClaim[]> => {
      const { data, error } = await supabase
        .from("mkt_guide_place_claims")
        .select(CLAIM_ADMIN_COLUMNS)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const claims = (data ?? []) as unknown as Omit<
        AdminGuideClaim,
        "documents" | "place_name" | "place_slug"
      >[];
      if (claims.length === 0) return [];

      const [docs, places] = await Promise.all([
        supabase
          .from("mkt_guide_claim_documents")
          .select("id,claim_id,doc_kind,storage_path,mime_type,size_bytes,created_at")
          .in(
            "claim_id",
            claims.map((claim) => claim.id),
          ),
        supabase
          .from("mkt_guide_places")
          .select("id,name_ar,slug")
          .in(
            "id",
            claims.map((claim) => claim.place_id),
          ),
      ]);
      if (docs.error) throw docs.error;
      if (places.error) throw places.error;

      const byClaim = new Map<string, GuideClaimDocument[]>();
      for (const row of (docs.data ?? []) as unknown as GuideClaimDocument[]) {
        byClaim.set(row.claim_id, [...(byClaim.get(row.claim_id) ?? []), row]);
      }
      const byPlace = new Map(
        ((places.data ?? []) as unknown as { id: string; name_ar: string; slug: string }[]).map(
          (row) => [row.id, row],
        ),
      );

      return claims.map((claim) => ({
        ...claim,
        documents: byClaim.get(claim.id) ?? [],
        place_name: byPlace.get(claim.place_id)?.name_ar ?? null,
        place_slug: byPlace.get(claim.place_id)?.slug ?? null,
      }));
    },
  });
}

/** Short-lived signed URL; a plain public URL for this bucket does not exist. */
export async function claimDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CLAIM_DOC_BUCKET)
    .createSignedUrl(storagePath, 120);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Approval is always a human decision, recorded with who and when. */
export function useDecideGuideClaim(adminId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { claimId: string; approve: boolean; reason: string | null }) => {
      const { error } = await supabase
        .from("mkt_guide_place_claims")
        .update({
          status: input.approve ? "approved" : "rejected",
          reject_reason: input.approve ? null : input.reason,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.claimId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-claims"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-claim"] });
    },
  });
}
