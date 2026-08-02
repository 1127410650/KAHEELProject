-- 1) Business management helper
CREATE OR REPLACE FUNCTION public.mkt_can_manage_business(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (_tenant_id IS NOT NULL AND public.is_tenant_member(_tenant_id))
      OR public.mkt_is_platform_admin()
$$;
REVOKE ALL ON FUNCTION public.mkt_can_manage_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_can_manage_business(uuid) TO authenticated;

-- 2) Verification requests
CREATE TABLE public.mkt_verification_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','needs_more')),
  note text,
  decision_reason text,
  submitted_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_verification_requests_tenant_idx ON public.mkt_verification_requests(tenant_id);
CREATE INDEX mkt_verification_requests_status_idx ON public.mkt_verification_requests(status);

GRANT SELECT, INSERT ON public.mkt_verification_requests TO authenticated;
GRANT ALL ON public.mkt_verification_requests TO service_role;
ALTER TABLE public.mkt_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_verification_requests_read ON public.mkt_verification_requests
  FOR SELECT TO authenticated USING (public.mkt_can_manage_business(tenant_id));
CREATE POLICY mkt_verification_requests_insert ON public.mkt_verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(tenant_id)
    AND submitted_by = auth.uid()
    AND status = 'pending'
    AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL
  );

CREATE TRIGGER mkt_verification_requests_updated_at
  BEFORE UPDATE ON public.mkt_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Verification files
CREATE TABLE public.mkt_verification_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.mkt_verification_requests(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_verification_files_request_idx ON public.mkt_verification_files(request_id);

GRANT SELECT, INSERT ON public.mkt_verification_files TO authenticated;
GRANT ALL ON public.mkt_verification_files TO service_role;
ALTER TABLE public.mkt_verification_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_verification_files_read ON public.mkt_verification_files
  FOR SELECT TO authenticated USING (public.mkt_can_manage_business(tenant_id));
CREATE POLICY mkt_verification_files_insert ON public.mkt_verification_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(tenant_id)
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.mkt_verification_requests r
      WHERE r.id = request_id AND r.tenant_id = mkt_verification_files.tenant_id
    )
  );

-- 4) Verification decision timeline
CREATE TABLE public.mkt_verification_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES public.mkt_verification_requests(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_verification_events_request_idx ON public.mkt_verification_events(request_id);

GRANT SELECT ON public.mkt_verification_events TO authenticated;
GRANT ALL ON public.mkt_verification_events TO service_role;
ALTER TABLE public.mkt_verification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_verification_events_read ON public.mkt_verification_events
  FOR SELECT TO authenticated USING (public.mkt_can_manage_business(tenant_id));

-- 5) Business profile: verification fields are admin-only
CREATE OR REPLACE FUNCTION public.mkt_guard_business_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.mkt_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.verification_status := OLD.verification_status;
  NEW.verified_at := OLD.verified_at;
  NEW.verified_by := OLD.verified_by;
  NEW.verification_note := OLD.verification_note;
  NEW.tenant_id := OLD.tenant_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_business_profiles_guard ON public.mkt_business_profiles;
CREATE TRIGGER mkt_business_profiles_guard
  BEFORE UPDATE ON public.mkt_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_business_verification();

CREATE OR REPLACE FUNCTION public.mkt_guard_business_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    NEW.verification_status := 'unverified';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_note := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_business_profiles_guard_insert ON public.mkt_business_profiles;
CREATE TRIGGER mkt_business_profiles_guard_insert
  BEFORE INSERT ON public.mkt_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_business_insert();

-- 6) Unverified business may keep drafts, but cannot submit/publish under the business name
DROP POLICY IF EXISTS mkt_listings_owner_insert ON public.mkt_listings;
CREATE POLICY mkt_listings_owner_insert ON public.mkt_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND status IN ('draft','pending')
    AND (
      tenant_id IS NULL
      OR (public.is_tenant_member(tenant_id)
          AND (status = 'draft' OR public.mkt_is_verified_business(tenant_id)))
    )
  );

CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Review decisions belong to platform admins only.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('published','rejected','suspended')
     AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Only marketplace administrators can approve, reject or suspend listings';
  END IF;

  IF NEW.tenant_id IS NOT NULL
     AND NEW.status IN ('pending','published')
     AND NOT public.mkt_is_verified_business(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Business must be verified before publishing under its name';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_listings_guard_status ON public.mkt_listings;
CREATE TRIGGER mkt_listings_guard_status
  BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_listing_status();

-- 7) Admin review RPCs
CREATE OR REPLACE FUNCTION public.mkt_review_listing(_listing_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  old_status text;
  new_status text;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT status INTO old_status FROM public.mkt_listings WHERE id = _listing_id;
  IF old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  new_status := CASE _action
    WHEN 'approve' THEN 'published'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
    WHEN 'return' THEN 'draft'
    ELSE NULL END;

  IF new_status IS NULL THEN
    RAISE EXCEPTION 'Unknown action';
  END IF;

  IF _action <> 'approve' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  UPDATE public.mkt_listings
     SET status = new_status,
         rejection_reason = CASE WHEN _action = 'approve' THEN NULL ELSE _reason END,
         published_at = CASE WHEN _action = 'approve' THEN COALESCE(published_at, now()) ELSE published_at END,
         updated_at = now()
   WHERE id = _listing_id;

  INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason, actor_id)
  VALUES (_listing_id, old_status, new_status, _reason, auth.uid());

  PERFORM public.log_audit('mkt_listing', _action, _listing_id,
    jsonb_build_object('status', old_status), jsonb_build_object('status', new_status), _reason);
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_review_listing(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_review_listing(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_review_verification(_request_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  req public.mkt_verification_requests;
  new_status text;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO req FROM public.mkt_verification_requests WHERE id = _request_id;
  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  new_status := CASE _action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'needs_more' THEN 'needs_more'
    ELSE NULL END;

  IF new_status IS NULL THEN
    RAISE EXCEPTION 'Unknown action';
  END IF;

  IF _action <> 'approve' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  UPDATE public.mkt_verification_requests
     SET status = new_status,
         decision_reason = _reason,
         decided_by = auth.uid(),
         decided_at = now()
   WHERE id = _request_id;

  UPDATE public.mkt_business_profiles
     SET verification_status = CASE WHEN _action = 'approve' THEN 'verified'
                                    WHEN _action = 'reject' THEN 'rejected'
                                    ELSE 'pending' END,
         verification_note = _reason,
         verified_at = CASE WHEN _action = 'approve' THEN now() ELSE NULL END,
         verified_by = CASE WHEN _action = 'approve' THEN auth.uid() ELSE NULL END,
         updated_at = now()
   WHERE tenant_id = req.tenant_id;

  INSERT INTO public.mkt_verification_events (request_id, tenant_id, from_status, to_status, reason, actor_id)
  VALUES (_request_id, req.tenant_id, req.status, new_status, _reason, auth.uid());

  PERFORM public.log_audit('mkt_business_verification', _action, _request_id,
    jsonb_build_object('status', req.status), jsonb_build_object('status', new_status), _reason);
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_review_verification(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_review_verification(uuid, text, text) TO authenticated;

-- Submitting a verification request also flags the profile as pending review
CREATE OR REPLACE FUNCTION public.mkt_verification_request_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.mkt_business_profiles
     SET verification_status = 'pending', updated_at = now()
   WHERE tenant_id = NEW.tenant_id
     AND verification_status <> 'verified';

  INSERT INTO public.mkt_verification_events (request_id, tenant_id, from_status, to_status, reason, actor_id)
  VALUES (NEW.id, NEW.tenant_id, NULL, 'pending', NEW.note, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_verification_request_submitted ON public.mkt_verification_requests;
CREATE TRIGGER mkt_verification_request_submitted
  AFTER INSERT ON public.mkt_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_verification_request_submitted();