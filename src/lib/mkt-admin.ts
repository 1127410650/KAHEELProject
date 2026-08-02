import { supabase } from "@/integrations/supabase/client";

/** Marketplace review decisions live in the database; the client only asks. */
export type ListingReviewAction = "approve" | "reject" | "suspend" | "return";
export type VerificationAction = "approve" | "reject" | "needs_more";

export type VerificationStatus = "pending" | "approved" | "rejected" | "needs_more";

export interface MktVerificationRequest {
  id: string;
  tenant_id: string;
  status: VerificationStatus;
  note: string | null;
  decision_reason: string | null;
  submitted_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface MktVerificationFile {
  id: string;
  request_id: string;
  tenant_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface MktVerificationEvent {
  id: string;
  request_id: string | null;
  tenant_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

export const VERIFICATION_REQUEST_COLUMNS =
  "id, tenant_id, status, note, decision_reason, submitted_by, decided_by, decided_at, created_at";

export async function isPlatformAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc("mkt_is_platform_admin");
  return data === true;
}

export async function reviewListing(
  listingId: string,
  action: ListingReviewAction,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_review_listing", {
    _listing_id: listingId,
    _action: action,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw error;
}

export async function reviewVerification(
  requestId: string,
  action: VerificationAction,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_review_verification", {
    _request_id: requestId,
    _action: action,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw error;
}

export async function loadVerificationRequests(filter?: {
  tenantId?: string | undefined;
  status?: string | undefined;
}): Promise<MktVerificationRequest[]> {
  let query = supabase
    .from("mkt_verification_requests")
    .select(VERIFICATION_REQUEST_COLUMNS)
    .order("created_at", { ascending: false });
  if (filter?.tenantId) query = query.eq("tenant_id", filter.tenantId);
  if (filter?.status) query = query.eq("status", filter.status);
  const { data } = await query.limit(200);
  return (data ?? []) as MktVerificationRequest[];
}

export async function loadVerificationFiles(requestIds: string[]): Promise<MktVerificationFile[]> {
  if (requestIds.length === 0) return [];
  const { data } = await supabase
    .from("mkt_verification_files")
    .select("id, request_id, tenant_id, file_path, file_name, mime_type, size_bytes, created_at")
    .in("request_id", requestIds);
  return (data ?? []) as MktVerificationFile[];
}

export async function loadVerificationEvents(tenantId: string): Promise<MktVerificationEvent[]> {
  const { data } = await supabase
    .from("mkt_verification_events")
    .select("id, request_id, tenant_id, from_status, to_status, reason, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []) as MktVerificationEvent[];
}
