/**
 * Guide community layer: customer photos, ratings, ownership claims and paid
 * promotion for `mkt_guide_places`.
 *
 * Three rules are structural, not cosmetic:
 * 1) Nothing a customer sends is visible before an admin approves it. The
 *    database forces `status = 'pending'` on insert (`mkt_guide_force_pending`)
 *    and the public read policy only exposes `approved` rows, so this module
 *    cannot publish anything even if it tried.
 * 2) Every uploaded photo is compressed in the browser first — max 1600px on
 *    the long edge, WebP, and re-encoded until it fits 300KB. A file that still
 *    does not fit is rejected client-side instead of being uploaded.
 * 3) Promotion never writes credit: `mkt_guide_promote_place` is a definer
 *    function that spends the wallet and records the promotion in one step.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { MKT_BUCKET } from "@/lib/mkt";
import { fingerprint, sniffImageMime, uploadWithProgress } from "@/lib/mkt-listing-media";

/* ── constants ────────────────────────────────────────────────────────────── */

/** Long-edge cap for a customer photo. */
export const GUIDE_PHOTO_MAX_DIMENSION = 1600;
/** Hard ceiling per uploaded object, after compression. */
export const GUIDE_PHOTO_MAX_BYTES = 300 * 1024;
/** Largest accepted source file before compression. */
export const GUIDE_PHOTO_SOURCE_MAX_BYTES = 15 * 1024 * 1024;
export const GUIDE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
/** Photos one visitor may add to a single place in one go. */
export const GUIDE_PHOTO_BATCH_LIMIT = 6;
/** Credit price of one promotion day. Mirrors `mkt_guide_promote_place`. */
export const GUIDE_PROMOTION_CREDITS_PER_DAY = 10;

export type GuideContributionStatus = "pending" | "approved" | "rejected";

export interface GuidePhoto {
  id: string;
  place_id: string;
  storage_path: string;
  kind: "official" | "customer";
  caption: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  sort_order: number;
  status: GuideContributionStatus;
  uploaded_by: string;
  reject_reason: string | null;
  created_at: string;
}

export interface GuideReview {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  status: GuideContributionStatus;
  reject_reason: string | null;
  created_at: string;
}

export interface GuideClaim {
  id: string;
  place_id: string;
  user_id: string;
  status: GuideContributionStatus;
  evidence: string | null;
  contact: string | null;
  reject_reason: string | null;
  created_at: string;
}

const PHOTO_COLUMNS =
  "id, place_id, storage_path, kind, caption, width, height, bytes, sort_order, status, uploaded_by, reject_reason, created_at";
const REVIEW_COLUMNS =
  "id, place_id, user_id, rating, comment, display_name, status, reject_reason, created_at";
const CLAIM_COLUMNS =
  "id, place_id, user_id, status, evidence, contact, reject_reason, created_at";

/* ── browser-side compression ─────────────────────────────────────────────── */

export type GuidePhotoError = "type" | "tooLarge" | "corrupt" | "upload";

export interface PreparedGuidePhoto {
  blob: Blob;
  width: number;
  height: number;
  hash: string;
}

/**
 * Decode → downscale to 1600px → encode WebP, lowering quality until the object
 * fits `GUIDE_PHOTO_MAX_BYTES`. Never returns something larger than the cap.
 */
export async function prepareGuidePhoto(file: File): Promise<PreparedGuidePhoto> {
  if (file.size > GUIDE_PHOTO_SOURCE_MAX_BYTES) throw new Error("tooLarge");
  const buffer = await file.arrayBuffer();
  const mime = sniffImageMime(buffer);
  if (!mime) throw new Error("type");
  const hash = await fingerprint(buffer);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([buffer], { type: mime }));
  } catch {
    throw new Error("corrupt");
  }

  const scale = Math.min(1, GUIDE_PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("corrupt");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.82, 0.72, 0.62, 0.5, 0.4]) {
    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (encoded && encoded.size <= GUIDE_PHOTO_MAX_BYTES) {
      return { blob: encoded, width, height, hash };
    }
  }
  throw new Error("tooLarge");
}

/**
 * Approved guide photos must be readable by signed-out visitors, so they live
 * under the bucket's `public/` prefix with an unguessable random name. Nothing
 * links to an object until its row is approved.
 */
function guidePhotoPath(placeId: string): string {
  return `public/guide/${placeId}/${crypto.randomUUID()}.webp`;
}

export function guidePhotoUrl(path: string): string {
  return supabase.storage.from(MKT_BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ── reads ────────────────────────────────────────────────────────────────── */

/** Approved gallery of a place: the official photo first, then customer photos. */
export function useGuidePlacePhotos(placeId: string | null) {
  return useQuery({
    queryKey: ["mkt", "guide-photos", placeId],
    enabled: !!placeId,
    staleTime: 30_000,
    queryFn: async (): Promise<GuidePhoto[]> => {
      const { data, error } = await supabase
        .from("mkt_guide_place_photos")
        .select(PHOTO_COLUMNS)
        .eq("place_id", placeId!)
        .eq("status", "approved")
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as GuidePhoto[];
    },
  });
}

/** The signed-in visitor's own contributions to this place, any status. */
export function useMyGuideContributions(placeId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ["mkt", "guide-mine", placeId, userId],
    enabled: !!placeId && !!userId,
    staleTime: 15_000,
    queryFn: async (): Promise<{ photos: GuidePhoto[]; review: GuideReview | null }> => {
      const [photos, review] = await Promise.all([
        supabase
          .from("mkt_guide_place_photos")
          .select(PHOTO_COLUMNS)
          .eq("place_id", placeId!)
          .eq("uploaded_by", userId!)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("mkt_guide_place_reviews")
          .select(REVIEW_COLUMNS)
          .eq("place_id", placeId!)
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);
      if (photos.error) throw photos.error;
      if (review.error) throw review.error;
      return {
        photos: (photos.data ?? []) as GuidePhoto[],
        review: (review.data as GuideReview | null) ?? null,
      };
    },
  });
}

export function useGuidePlaceReviews(placeId: string | null) {
  return useQuery({
    queryKey: ["mkt", "guide-reviews", placeId],
    enabled: !!placeId,
    staleTime: 30_000,
    queryFn: async (): Promise<GuideReview[]> => {
      const { data, error } = await supabase
        .from("mkt_guide_place_reviews")
        .select(REVIEW_COLUMNS)
        .eq("place_id", placeId!)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GuideReview[];
    },
  });
}

export interface GuideRating {
  average: number | null;
  total: number;
}

export function useGuidePlaceRating(placeId: string | null) {
  return useQuery({
    queryKey: ["mkt", "guide-rating", placeId],
    enabled: !!placeId,
    staleTime: 60_000,
    queryFn: async (): Promise<GuideRating> => {
      const { data, error } = await supabase.rpc("mkt_guide_place_rating", {
        _place_id: placeId!,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { average: number | string | null; total: number | null }
        | undefined;
      const average = row?.average == null ? null : Number(row.average);
      return { average, total: Number(row?.total ?? 0) };
    },
  });
}

/* ── writes (all land in the review queue) ────────────────────────────────── */

export function useUploadGuidePhotos(placeId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      if (!placeId || !userId) throw new Error("AUTH_REQUIRED");
      const picked = files.slice(0, GUIDE_PHOTO_BATCH_LIMIT);
      let saved = 0;
      for (const file of picked) {
        const prepared = await prepareGuidePhoto(file);
        const path = guidePhotoPath(placeId);
        await uploadWithProgress(path, prepared.blob, () => {});
        const { error } = await supabase.from("mkt_guide_place_photos").insert({
          place_id: placeId,
          storage_path: path,
          kind: "customer",
          width: prepared.width,
          height: prepared.height,
          bytes: prepared.blob.size,
          mime: "image/webp",
          uploaded_by: userId,
        });
        if (error) throw error;
        saved += 1;
      }
      return saved;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-mine"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-queue"] });
    },
  });
}

export function useSubmitGuideReview(placeId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rating,
      comment,
      displayName,
    }: {
      rating: number;
      comment: string;
      displayName?: string | null;
    }) => {
      if (!placeId || !userId) throw new Error("AUTH_REQUIRED");
      // Re-sending replaces the visitor's own row and re-enters the queue.
      const { error } = await supabase.from("mkt_guide_place_reviews").upsert(
        {
          place_id: placeId,
          user_id: userId,
          rating,
          comment: comment.trim() ? comment.trim().slice(0, 1200) : null,
          display_name: displayName?.trim() ? displayName.trim().slice(0, 60) : null,
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          reject_reason: null,
        },
        { onConflict: "place_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-mine"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-queue"] });
    },
  });
}

export function useDeleteGuidePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase.from("mkt_guide_place_photos").delete().eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-mine"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-photos"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-queue"] });
    },
  });
}

/* ── ownership claim ──────────────────────────────────────────────────────── */

export function useMyGuideClaim(placeId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ["mkt", "guide-claim", placeId, userId],
    enabled: !!placeId && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<GuideClaim | null> => {
      const { data, error } = await supabase
        .from("mkt_guide_place_claims")
        .select(CLAIM_COLUMNS)
        .eq("place_id", placeId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as GuideClaim | null) ?? null;
    },
  });
}

export function useClaimGuidePlace(placeId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ evidence, contact }: { evidence: string; contact: string }) => {
      if (!placeId || !userId) throw new Error("AUTH_REQUIRED");
      const { error } = await supabase.from("mkt_guide_place_claims").insert({
        place_id: placeId,
        user_id: userId,
        evidence: evidence.trim().slice(0, 800) || null,
        contact: contact.trim().slice(0, 120) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-claim"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-queue"] });
    },
  });
}

/* ── promotion + featured slot ────────────────────────────────────────────── */

export interface GuideFeaturedPlace {
  promotion_id: string;
  place_id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  sector: string | null;
  category: string | null;
  city: string | null;
  governorate: string | null;
  rating: number | null;
  rating_total: number | null;
}

export function useGuideFeaturedPlaces(limit = 6) {
  return useQuery({
    queryKey: ["mkt", "guide-featured", limit],
    staleTime: 60_000,
    queryFn: async (): Promise<GuideFeaturedPlace[]> => {
      const { data, error } = await supabase.rpc("mkt_guide_featured_places", { _limit: limit });
      if (error) throw error;
      return (data ?? []) as unknown as GuideFeaturedPlace[];
    },
  });
}

/** Fire-and-forget impression/click counter; never blocks navigation. */
export function trackGuidePromo(promotionId: string, kind: "view" | "click"): void {
  void supabase.rpc("mkt_guide_promo_track", { _promotion_id: promotionId, _kind: kind });
}

export function usePromoteGuidePlace(placeId: string | null, tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (days: number) => {
      if (!placeId) throw new Error("PLACE_REQUIRED");
      const { data, error } = await supabase.rpc("mkt_guide_promote_place", {
        _place_id: placeId,
        _days: days,
        ...(tenantId ? { _tenant_id: tenantId } : {}),
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-featured"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "ad-credit-entries"] });
    },
  });
}

/* ── admin review queue ───────────────────────────────────────────────────── */

export interface GuideQueue {
  photos: (GuidePhoto & { place_name: string | null; place_slug: string | null })[];
  reviews: (GuideReview & { place_name: string | null; place_slug: string | null })[];
  claims: (GuideClaim & { place_name: string | null; place_slug: string | null })[];
}

type PlaceStub = { id: string; name_ar: string | null; slug: string | null };

async function withPlaceNames<T extends { place_id: string }>(
  rows: T[],
): Promise<(T & { place_name: string | null; place_slug: string | null })[]> {
  const ids = [...new Set(rows.map((row) => row.place_id))];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("mkt_guide_places")
    .select("id, name_ar, slug")
    .in("id", ids);
  const byId = new Map((data ?? []).map((row) => [row.id, row as PlaceStub]));
  return rows.map((row) => ({
    ...row,
    place_name: byId.get(row.place_id)?.name_ar ?? null,
    place_slug: byId.get(row.place_id)?.slug ?? null,
  }));
}

export function useGuideReviewQueue(enabled: boolean, status: GuideContributionStatus = "pending") {
  return useQuery({
    queryKey: ["mkt", "admin", "guide-queue", status],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<GuideQueue> => {
      const [photos, reviews, claims] = await Promise.all([
        supabase
          .from("mkt_guide_place_photos")
          .select(PHOTO_COLUMNS)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("mkt_guide_place_reviews")
          .select(REVIEW_COLUMNS)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("mkt_guide_place_claims")
          .select(CLAIM_COLUMNS)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (photos.error) throw photos.error;
      if (reviews.error) throw reviews.error;
      if (claims.error) throw claims.error;
      return {
        photos: await withPlaceNames((photos.data ?? []) as GuidePhoto[]),
        reviews: await withPlaceNames((reviews.data ?? []) as GuideReview[]),
        claims: await withPlaceNames((claims.data ?? []) as GuideClaim[]),
      };
    },
  });
}

export type GuideQueueTarget = "photo" | "review" | "claim";

export function useDecideGuideContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      target,
      id,
      approve,
      reason,
    }: {
      target: GuideQueueTarget;
      id: string;
      approve: boolean;
      reason?: string | null;
    }) => {
      const fn =
        target === "photo"
          ? "mkt_guide_review_photo"
          : target === "review"
            ? "mkt_guide_review_review"
            : "mkt_guide_review_claim";
      const key = target === "photo" ? "_photo_id" : target === "review" ? "_review_id" : "_claim_id";
      const { error } = await supabase.rpc(fn, {
        [key]: id,
        _approve: approve,
        ...(reason && !approve ? { _reason: reason.slice(0, 300) } : {}),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "guide-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-photos"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["mkt", "guide-rating"] });
    },
  });
}
