-- 1) Removal / correction requests for guide entities
CREATE TABLE public.mkt_guide_removal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid REFERENCES public.mkt_guide_places(id) ON DELETE SET NULL,
  entity_name text NOT NULL,
  reporter_role text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('correction','removal')),
  description text NOT NULL,
  contact text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','done','rejected')),
  decision_note text,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mkt_guide_removal_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_guide_removal_requests TO authenticated;
GRANT ALL ON public.mkt_guide_removal_requests TO service_role;

ALTER TABLE public.mkt_guide_removal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_guide_removal_insert ON public.mkt_guide_removal_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND decision_note IS NULL
    AND (created_by IS NULL OR created_by = auth.uid())
    AND length(btrim(entity_name)) BETWEEN 2 AND 200
    AND length(btrim(description)) BETWEEN 10 AND 2000
    AND length(btrim(contact)) BETWEEN 5 AND 200
    AND length(btrim(reporter_role)) BETWEEN 2 AND 100
  );

CREATE POLICY mkt_guide_removal_own_read ON public.mkt_guide_removal_requests
  FOR SELECT TO authenticated
  USING ((created_by IS NOT NULL AND created_by = auth.uid()) OR public.mkt_is_platform_admin());

CREATE POLICY mkt_guide_removal_staff_write ON public.mkt_guide_removal_requests
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_guide_removal_touch
  BEFORE UPDATE ON public.mkt_guide_removal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX mkt_guide_removal_status_idx
  ON public.mkt_guide_removal_requests (status, created_at DESC);

-- 2) Soft delete on guide places (no hard deletes, ever)
ALTER TABLE public.mkt_guide_places
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_by uuid;

CREATE INDEX IF NOT EXISTS mkt_guide_places_removed_idx
  ON public.mkt_guide_places (removed_at);

-- 3) Claim applicant identity + document retention marker
ALTER TABLE public.mkt_guide_place_claims
  ADD COLUMN IF NOT EXISTS applicant_name text,
  ADD COLUMN IF NOT EXISTS applicant_role text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS documents_purged_at timestamptz;

-- 4) Claim documents (metadata only; files live in a private bucket)
CREATE TABLE public.mkt_guide_claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.mkt_guide_place_claims(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  doc_kind text NOT NULL CHECK (doc_kind IN ('commercial_register','license','authorization','other')),
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.mkt_guide_claim_documents TO authenticated;
GRANT ALL ON public.mkt_guide_claim_documents TO service_role;

ALTER TABLE public.mkt_guide_claim_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_guide_claim_docs_insert ON public.mkt_guide_claim_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.mkt_guide_place_claims c
      WHERE c.id = claim_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY mkt_guide_claim_docs_read ON public.mkt_guide_claim_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin());

CREATE POLICY mkt_guide_claim_docs_delete ON public.mkt_guide_claim_documents
  FOR DELETE TO authenticated
  USING (
    public.mkt_is_platform_admin()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.mkt_guide_place_claims c
        WHERE c.id = claim_id AND c.user_id = auth.uid() AND c.status = 'pending'
      )
    )
  );

CREATE INDEX mkt_guide_claim_docs_claim_idx
  ON public.mkt_guide_claim_documents (claim_id);

-- 5) Private bucket access: owner-only paths, admins may read and clean up
CREATE POLICY mkt_guide_claims_bucket_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mkt-guide-claims'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY mkt_guide_claims_bucket_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mkt-guide-claims'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.mkt_is_platform_admin()
    )
  );

CREATE POLICY mkt_guide_claims_bucket_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mkt-guide-claims'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.mkt_is_platform_admin()
    )
  );

-- 6) Retention: purge claim documents 90 days after the decision
CREATE OR REPLACE FUNCTION public.mkt_guide_purge_claim_documents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  purged integer := 0;
BEGIN
  WITH expired AS (
    SELECT d.id, d.storage_path, d.claim_id
    FROM public.mkt_guide_claim_documents d
    JOIN public.mkt_guide_place_claims c ON c.id = d.claim_id
    WHERE c.reviewed_at IS NOT NULL
      AND c.reviewed_at < now() - interval '90 days'
  ), gone AS (
    DELETE FROM storage.objects o
    USING expired e
    WHERE o.bucket_id = 'mkt-guide-claims' AND o.name = e.storage_path
    RETURNING o.name
  ), meta AS (
    DELETE FROM public.mkt_guide_claim_documents d
    USING expired e
    WHERE d.id = e.id
    RETURNING d.claim_id
  )
  SELECT count(*) INTO purged FROM meta;

  UPDATE public.mkt_guide_place_claims c
  SET documents_purged_at = now()
  WHERE c.reviewed_at IS NOT NULL
    AND c.reviewed_at < now() - interval '90 days'
    AND c.documents_purged_at IS NULL;

  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_guide_purge_claim_documents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_guide_purge_claim_documents() TO service_role;