/**
 * Administrative detail files (user / business / listing / verification).
 *
 * Every read here is a single `SECURITY DEFINER` RPC that re-checks the caller
 * server-side through `mkt_admin_can(...)`. The client never assembles an
 * administrative file from raw tables, so a missing permission means "no data"
 * rather than "a hidden button": the request simply fails.
 *
 * Sensitive material (registration numbers, verification documents) is only
 * present in the payload when the server decided the caller may see it, and
 * opening a document is logged before the signed URL is handed over.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Shared row shapes ────────────────────────────────────────────────────────

export interface AdminListingBrief {
  id: string;
  ref_no: string | null;
  title: string | null;
  status: string;
  city: string | null;
  price?: number | string | null;
  currency?: string | null;
  created_at: string;
  published_at?: string | null;
  expires_at?: string | null;
  deleted_at?: string | null;
  reports_count?: number | null;
  views_count?: number | null;
}

export interface AdminReportBrief {
  id: string;
  ref_no: string | null;
  listing_id: string | null;
  status: string;
  decision: string | null;
  reason_code?: string | null;
  severity?: string | null;
  created_at: string;
  closed_at?: string | null;
}

export interface AdminRestrictionRow {
  id: string;
  restriction: string;
  reason: string | null;
  starts_at: string | null;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_reason: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface AdminAuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  reason: string | null;
  created_at: string;
  actor_name: string | null;
  old_value?: unknown;
  new_value?: unknown;
}

export interface AdminVerificationBrief {
  id: string;
  tenant_id?: string | null;
  status: string;
  note: string | null;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  files?: number | null;
}

// ── User file ────────────────────────────────────────────────────────────────

export interface AdminUserDetail {
  header: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean | null;
    locale: string | null;
    created_at: string;
    country: string | null;
    platform_role: string | null;
  };
  counts: {
    listings: number;
    businesses: number;
    reports_against: number;
    reports_filed: number;
    restrictions: number;
    restrictions_active: number;
  };
  listings: AdminListingBrief[];
  businesses: {
    tenant_id: string;
    name: string | null;
    role: string;
    slug: string | null;
    verification_status: string | null;
    status: string | null;
    joined_at: string;
  }[];
  reports_against: AdminReportBrief[];
  reports_filed: AdminReportBrief[];
  verifications: AdminVerificationBrief[];
  restrictions: AdminRestrictionRow[];
  notifications: {
    id: string;
    event: string;
    title: string | null;
    created_at: string;
    read_at: string | null;
  }[];
  audit: AdminAuditRow[];
}

export async function loadAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data, error } = await supabase.rpc("mkt_admin_user_detail", { _user_id: userId });
  if (error) throw error;
  return data as unknown as AdminUserDetail;
}

// ── Business file ────────────────────────────────────────────────────────────

export interface AdminBusinessDetail {
  header: {
    tenant_id: string;
    name: string | null;
    name_en: string | null;
    slug: string | null;
    tenant_type: string | null;
    usage_type: string | null;
    status: string | null;
    created_at: string;
    verification_status: string | null;
    verified_at: string | null;
    city: string | null;
    region: string | null;
    main_activity: string | null;
    sub_activities: string[] | null;
    is_published: boolean | null;
    headline: string | null;
    about: string | null;
    public_phone: string | null;
    public_email: string | null;
    public_website: string | null;
    country: string | null;
    officer: string | null;
    officer_id: string | null;
    /** Only present when the caller may read sensitive documents. */
    registration: string | null;
    vat_number: string | null;
  };
  counts: { listings: number; members: number; reports: number; restrictions_active: number };
  listings: AdminListingBrief[];
  members: {
    user_id: string;
    role: string;
    name: string | null;
    email: string | null;
    joined_at: string;
  }[];
  verifications: AdminVerificationBrief[];
  reports: AdminReportBrief[];
  restrictions: AdminRestrictionRow[];
  audit: AdminAuditRow[];
}

export async function loadAdminBusinessDetail(tenantId: string): Promise<AdminBusinessDetail> {
  const { data, error } = await supabase.rpc("mkt_admin_business_detail", { _tenant_id: tenantId });
  if (error) throw error;
  return data as unknown as AdminBusinessDetail;
}

// ── Listing file ─────────────────────────────────────────────────────────────

export interface AdminListingDetail {
  header: {
    id: string;
    ref_no: string | null;
    slug: string | null;
    title: string | null;
    summary: string | null;
    description: string | null;
    status: string;
    advertiser_type: string | null;
    owner_user_id: string | null;
    owner_name: string | null;
    tenant_id: string | null;
    tenant_name: string | null;
    category: string | null;
    subcategory: string | null;
    price: number | string | null;
    price_on_request: boolean | null;
    currency: string | null;
    city: string | null;
    region: string | null;
    cover_image_url: string | null;
    duration_days: number | null;
    created_at: string;
    published_at: string | null;
    expires_at: string | null;
    paused_at: string | null;
    deleted_at: string | null;
    rejection_reason: string | null;
    views_count: number;
    shares_count: number;
    favorites_count: number;
    contact_requests_count: number;
    quote_requests_count: number;
    reports_count: number;
  };
  images: { id: string; url: string | null; is_cover: boolean | null; sort_order: number | null }[];
  events: {
    id: string;
    event_type: string;
    meta: Record<string, unknown> | null;
    created_at: string;
    actor_id: string | null;
    actor_name: string | null;
  }[];
  reports: AdminReportBrief[];
}

export async function loadAdminListingDetail(listingId: string): Promise<AdminListingDetail> {
  const { data, error } = await supabase.rpc("mkt_admin_listing_detail", { _listing_id: listingId });
  if (error) throw error;
  return data as unknown as AdminListingDetail;
}

// ── Verification file ────────────────────────────────────────────────────────

export interface AdminVerificationDetail {
  header: {
    id: string;
    status: string;
    note: string | null;
    decision_reason: string | null;
    created_at: string;
    updated_at: string | null;
    decided_at: string | null;
    tenant_id: string;
    tenant_name: string | null;
    tenant_type: string | null;
    country: string | null;
    submitted_by: string | null;
    submitted_by_name: string | null;
    decided_by_name: string | null;
    registration: string | null;
  };
  can_view_documents: boolean;
  files: {
    id: string;
    file_path: string;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    doc_kind: string | null;
    created_at: string;
  }[];
  events: {
    id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
    actor_name: string | null;
  }[];
}

export async function loadAdminVerificationDetail(
  requestId: string,
): Promise<AdminVerificationDetail> {
  const { data, error } = await supabase.rpc("mkt_admin_verification_detail", {
    _request_id: requestId,
  });
  if (error) throw error;
  return data as unknown as AdminVerificationDetail;
}

// ── Internal notes (unified subjects) ────────────────────────────────────────

export type NoteSubject = "user" | "business" | "listing" | "report" | "verification";

export interface AdminSubjectNote {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export async function loadSubjectNotes(
  subjectType: NoteSubject,
  subjectId: string,
): Promise<AdminSubjectNote[]> {
  const { data, error } = await supabase.rpc("mkt_admin_notes_list", {
    _subject_type: subjectType,
    _subject_id: subjectId,
  });
  if (error) throw error;
  return (data ?? []) as AdminSubjectNote[];
}

export async function addSubjectNote(
  subjectType: NoteSubject,
  subjectId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc("mkt_admin_add_note", {
    _subject_type: subjectType,
    _subject_id: subjectId,
    _body: body,
  });
  if (error) throw error;
}

// ── Sensitive documents ──────────────────────────────────────────────────────

/**
 * Opens a verification document. The access is written to the audit log first;
 * if the server refuses (no `docs.view_sensitive`), no URL is ever minted.
 */
export async function openSensitiveDocument(
  bucket: string,
  path: string,
  kind: string,
  subjectId: string,
): Promise<string> {
  const { error: logError } = await supabase.rpc("mkt_admin_log_doc_access", {
    _kind: kind,
    _subject_id: subjectId,
    _path: path,
  });
  if (logError) throw logError;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error("signed url unavailable");
  return data.signedUrl;
}
