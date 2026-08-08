-- Explicitly deny all browser roles at the RLS layer in addition to the revoked
-- table privileges. Application access remains available only through the
-- reviewed, account-scoped SECURITY DEFINER APIs.

DROP POLICY IF EXISTS mkt_join_applications_no_direct_browser_access
  ON public.mkt_join_applications;
CREATE POLICY mkt_join_applications_no_direct_browser_access
  ON public.mkt_join_applications
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS mkt_join_documents_no_direct_browser_access
  ON public.mkt_join_application_documents;
CREATE POLICY mkt_join_documents_no_direct_browser_access
  ON public.mkt_join_application_documents
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS mkt_join_events_no_direct_browser_access
  ON public.mkt_join_application_events;
CREATE POLICY mkt_join_events_no_direct_browser_access
  ON public.mkt_join_application_events
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Cover every foreign key used by approval, audit and document cleanup paths.
CREATE INDEX IF NOT EXISTS mkt_join_applications_category_idx
  ON public.mkt_join_applications (provider_category_code)
  WHERE provider_category_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS mkt_join_applications_reviewer_idx
  ON public.mkt_join_applications (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS mkt_join_application_documents_owner_idx
  ON public.mkt_join_application_documents (owner_user_id);

CREATE INDEX IF NOT EXISTS mkt_join_application_events_actor_idx
  ON public.mkt_join_application_events (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

-- Commercial-registration documents are distinct from personal identity files
-- so reviewers can enforce the correct evidence for business applications.
ALTER TABLE public.mkt_join_application_documents
  DROP CONSTRAINT IF EXISTS mkt_join_application_documents_document_kind_check;
ALTER TABLE public.mkt_join_application_documents
  ADD CONSTRAINT mkt_join_application_documents_document_kind_check CHECK (
    document_kind IN (
      'identity', 'license', 'vehicle', 'resume', 'authorization',
      'commercial_registration', 'other'
    )
  );

-- An onboarding tenant is closed by default, including the small interval
-- between workspace preparation and application submission. Legacy workspaces
-- remain available when they were not created by the reviewed join flow.
CREATE OR REPLACE FUNCTION public.mkt_tenant_operational_allowed(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_tenant_member(_tenant_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = _tenant_id
        AND coalesce(t.usage_type, '') LIKE 'onboarding:%'
        AND NOT EXISTS (
          SELECT 1
          FROM public.mkt_join_applications a
          WHERE a.tenant_id = _tenant_id
            AND a.application_kind IN ('seller', 'service_provider')
            AND a.status = 'approved'
        )
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.mkt_join_applications a
        WHERE a.tenant_id = _tenant_id
          AND a.application_kind IN ('seller', 'service_provider')
      )
      OR EXISTS (
        SELECT 1 FROM public.mkt_join_applications a
        WHERE a.tenant_id = _tenant_id
          AND a.application_kind IN ('seller', 'service_provider')
          AND a.status = 'approved'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.mkt_tenant_operational_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_tenant_operational_allowed(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_can_publish_as_business(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT public.mkt_tenant_operational_allowed(_tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = _tenant_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('owner', 'accountant', 'employee', 'service_provider')
    );
$$;

REVOKE ALL ON FUNCTION public.mkt_can_publish_as_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_can_publish_as_business(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_guard_business_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  NEW.tenant_id := OLD.tenant_id;
  IF NOT public.mkt_is_platform_admin() THEN
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.verification_note := OLD.verification_note;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = OLD.tenant_id
      AND coalesce(t.usage_type, '') LIKE 'onboarding:%'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.mkt_join_applications a
    WHERE a.tenant_id = OLD.tenant_id
      AND a.status = 'approved'
  ) THEN
    NEW.is_published := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_guard_storefront_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NOT public.mkt_store_admin() THEN
    NEW.tenant_id := OLD.tenant_id;
    NEW.owner_user_id := OLD.owner_user_id;
    NEW.idempotency_key := OLD.idempotency_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_storefronts_scope_guard ON public.mkt_storefronts;
CREATE TRIGGER mkt_storefronts_scope_guard
  BEFORE UPDATE ON public.mkt_storefronts
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_storefront_scope();

DROP POLICY IF EXISTS mkt_storefronts_owner_insert ON public.mkt_storefronts;
CREATE POLICY mkt_storefronts_owner_insert ON public.mkt_storefronts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND status IN ('draft', 'pending_review')
    AND (tenant_id IS NULL OR public.mkt_can_publish_as_business(tenant_id))
  );

DROP POLICY IF EXISTS mkt_storefronts_owner_update ON public.mkt_storefronts;
CREATE POLICY mkt_storefronts_owner_update ON public.mkt_storefronts
  FOR UPDATE TO authenticated
  USING (public.mkt_store_manage(id))
  WITH CHECK (
    (tenant_id IS NULL AND owner_user_id = auth.uid())
    OR (tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(tenant_id))
  );

-- Prepares or resumes the one hidden onboarding workspace owned by the caller.
-- It restores the personal active tenant after create_workspace so the pending
-- business never leaks into the current account context.
CREATE OR REPLACE FUNCTION public.mkt_join_workspace_prepare(
  _application_kind text,
  _provider_category_code text,
  _name_ar text,
  _name_en text DEFAULT NULL,
  _legal_name text DEFAULT NULL,
  _cr_number text DEFAULT NULL,
  _unified_number text DEFAULT NULL,
  _city text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _activity text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_previous_tenant uuid;
  v_category public.mkt_provider_categories;
  v_cr text := nullif(regexp_replace(coalesce(_cr_number, ''), '[^0-9A-Za-z]', '', 'g'), '');
  v_unified text := nullif(regexp_replace(coalesce(_unified_number, ''), '[^0-9A-Za-z]', '', 'g'), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _application_kind NOT IN ('seller', 'service_provider') THEN
    RAISE EXCEPTION 'join_business_kind_invalid';
  END IF;
  IF length(btrim(coalesce(_name_ar, ''))) < 2 THEN RAISE EXCEPTION 'join_business_name_required'; END IF;
  IF length(btrim(coalesce(_legal_name, ''))) < 3 THEN RAISE EXCEPTION 'join_legal_name_required'; END IF;
  IF v_cr IS NULL AND v_unified IS NULL THEN RAISE EXCEPTION 'join_official_number_required'; END IF;

  SELECT * INTO v_category
  FROM public.mkt_provider_categories c
  WHERE c.code = _provider_category_code AND c.is_active;
  IF v_category.code IS NULL THEN RAISE EXCEPTION 'provider_category_invalid'; END IF;
  IF _application_kind = 'seller' AND NOT (
    'catalog.products' = ANY(v_category.capabilities)
    OR 'orders.receive' = ANY(v_category.capabilities)
  ) THEN RAISE EXCEPTION 'seller_category_required'; END IF;
  IF _application_kind = 'service_provider' AND NOT (
    'catalog.services' = ANY(v_category.capabilities)
    OR 'bookings.receive' = ANY(v_category.capabilities)
    OR 'jobs.receive' = ANY(v_category.capabilities)
    OR 'quotes.receive' = ANY(v_category.capabilities)
  ) THEN RAISE EXCEPTION 'service_category_required'; END IF;

  SELECT t.id INTO v_tenant
  FROM public.tenants t
  JOIN public.tenant_memberships m ON m.tenant_id = t.id
  WHERE t.created_by = v_uid
    AND t.deleted_at IS NULL
    AND t.status <> 'archived'
    AND t.personal_user_id IS NULL
    AND t.usage_type = 'onboarding:' || _application_kind
    AND m.user_id = v_uid AND m.role = 'owner' AND m.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.mkt_join_applications a
      WHERE a.tenant_id = t.id AND a.status = 'approved'
    )
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_tenant IS NULL AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.created_by = v_uid
      AND t.deleted_at IS NULL
      AND t.status <> 'archived'
      AND t.personal_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'WORKSPACE_LIMIT_REACHED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants t
    LEFT JOIN public.mkt_business_registry r ON r.tenant_id = t.id
    WHERE t.id IS DISTINCT FROM v_tenant
      AND t.deleted_at IS NULL
      AND t.status = 'active'
      AND (
        (v_cr IS NOT NULL AND (
          regexp_replace(coalesce(t.commercial_registration_number, ''), '[^0-9A-Za-z]', '', 'g') = v_cr
          OR regexp_replace(coalesce(r.cr_number, ''), '[^0-9A-Za-z]', '', 'g') = v_cr
        ))
        OR (v_unified IS NOT NULL
          AND regexp_replace(coalesce(r.unified_number, ''), '[^0-9A-Za-z]', '', 'g') = v_unified)
      )
  ) THEN RAISE EXCEPTION 'DUPLICATE_REGISTRATION'; END IF;

  IF v_tenant IS NULL THEN
    SELECT p.active_tenant_id INTO v_previous_tenant
    FROM public.profiles p WHERE p.user_id = v_uid;
    v_tenant := public.create_workspace(
      _tenant_type => 'store', _name_ar => btrim(_name_ar),
      _name_en => nullif(btrim(coalesce(_name_en, '')), ''),
      _legal_name => btrim(_legal_name), _cr_number => v_cr,
      _city => nullif(btrim(coalesce(_city, '')), ''),
      _phone => nullif(btrim(coalesce(_phone, '')), ''),
      _email => nullif(btrim(coalesce(_email, '')), ''),
      _activity => nullif(btrim(coalesce(_activity, '')), ''),
      _usage_type => 'onboarding:' || _application_kind,
      _provider_type => v_category.code, _contact_info => '{}'::jsonb,
      _confirm_duplicate => false
    );
    UPDATE public.profiles SET active_tenant_id = v_previous_tenant
    WHERE user_id = v_uid;
  ELSE
    UPDATE public.tenants
    SET name_ar = btrim(_name_ar),
        name_en = coalesce(nullif(btrim(coalesce(_name_en, '')), ''), btrim(_name_ar)),
        legal_name = btrim(_legal_name),
        commercial_registration_number = v_cr,
        city = nullif(btrim(coalesce(_city, '')), ''),
        phone = nullif(btrim(coalesce(_phone, '')), ''),
        email = nullif(btrim(coalesce(_email, '')), ''),
        activity = nullif(btrim(coalesce(_activity, '')), ''),
        usage_type = 'onboarding:' || _application_kind,
        provider_type = v_category.code,
        updated_at = now()
    WHERE id = v_tenant;
  END IF;
  RETURN v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_join_workspace_prepare(
  text, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_join_workspace_prepare(
  text, text, text, text, text, text, text, text, text, text, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_join_application_finalize(
  _application_id uuid,
  _provider_category_code text DEFAULT NULL,
  _payload jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_app public.mkt_join_applications;
  v_category public.mkt_provider_categories;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_app FROM public.mkt_join_applications a
  WHERE a.id = _application_id
    AND a.applicant_user_id = auth.uid()
    AND a.status IN ('pending', 'needs_more')
  FOR UPDATE;
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'join_application_not_editable'; END IF;
  IF _payload IS NOT NULL AND jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'join_payload_invalid';
  END IF;

  IF v_app.application_kind IN ('seller', 'service_provider') THEN
    SELECT * INTO v_category FROM public.mkt_provider_categories c
    WHERE c.code = coalesce(_provider_category_code, v_app.provider_category_code)
      AND c.is_active;
    IF v_category.code IS NULL THEN RAISE EXCEPTION 'provider_category_invalid'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.mkt_join_application_documents d
      WHERE d.application_id = v_app.id
        AND d.document_kind = 'commercial_registration'
    ) THEN RAISE EXCEPTION 'join_commercial_registration_required'; END IF;

    UPDATE public.mkt_provider_profiles p
    SET category_code = v_category.code, status = 'draft',
        accepts_partner_requests = false, updated_at = now()
    FROM public.mkt_storefronts s
    WHERE s.id = p.storefront_id AND s.tenant_id = v_app.tenant_id;
    UPDATE public.mkt_storefronts
    SET store_type = v_category.default_store_type, status = 'draft',
        accepts_orders = false, updated_at = now()
    WHERE tenant_id = v_app.tenant_id AND deleted_at IS NULL;
    UPDATE public.tenants
    SET provider_type = v_category.code,
        usage_type = 'onboarding:' || v_app.application_kind,
        updated_at = now()
    WHERE id = v_app.tenant_id;
  ELSIF v_app.application_kind = 'delivery_team' AND NOT EXISTS (
    SELECT 1 FROM public.mkt_join_application_documents d
    WHERE d.application_id = v_app.id AND d.document_kind = 'license'
  ) THEN
    RAISE EXCEPTION 'join_delivery_license_required';
  END IF;

  UPDATE public.mkt_join_applications
  SET provider_category_code = CASE
        WHEN v_app.application_kind IN ('seller', 'service_provider')
          THEN v_category.code ELSE NULL END,
      payload = coalesce(_payload, payload),
      status = 'pending', decision_reason = NULL,
      reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
  WHERE id = v_app.id;

  IF v_app.status = 'needs_more' THEN
    INSERT INTO public.mkt_join_application_events (
      application_id, from_status, to_status, note, actor_user_id
    ) VALUES (v_app.id, 'needs_more', 'pending', 'applicant_resubmitted', auth.uid());
  END IF;
  RETURN v_app.id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_join_application_finalize(uuid, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_join_application_finalize(uuid, text, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_join_application_mark_incomplete(_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_previous text;
BEGIN
  SELECT a.status INTO v_previous FROM public.mkt_join_applications a
  WHERE a.id = _application_id AND a.applicant_user_id = auth.uid()
    AND a.status = 'pending'
  FOR UPDATE;
  IF v_previous IS NULL THEN RETURN; END IF;
  UPDATE public.mkt_join_applications
  SET status = 'needs_more', decision_reason = 'applicant_upload_incomplete',
      updated_at = now()
  WHERE id = _application_id;
  INSERT INTO public.mkt_join_application_events (
    application_id, from_status, to_status, note, actor_user_id
  ) VALUES (
    _application_id, v_previous, 'needs_more', 'applicant_upload_incomplete', auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_join_application_mark_incomplete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_join_application_mark_incomplete(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_join_application_document_add(
  _application_id uuid,
  _document_kind text,
  _storage_path text,
  _file_name text,
  _mime_type text,
  _size_bytes integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _document_kind NOT IN (
    'identity', 'license', 'vehicle', 'resume', 'authorization',
    'commercial_registration', 'other'
  ) THEN RAISE EXCEPTION 'join_document_kind_invalid'; END IF;
  IF _mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    OR _size_bytes <= 0 OR _size_bytes > 10485760 THEN
    RAISE EXCEPTION 'join_document_invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mkt_join_applications a
    WHERE a.id = _application_id AND a.applicant_user_id = auth.uid()
      AND a.status IN ('pending', 'needs_more')
  ) THEN RAISE EXCEPTION 'join_application_not_editable'; END IF;
  IF _storage_path NOT LIKE (
    'join-applications/' || auth.uid()::text || '/' || _application_id::text || '/%'
  ) THEN RAISE EXCEPTION 'join_document_path_invalid'; END IF;
  INSERT INTO public.mkt_join_application_documents (
    application_id, owner_user_id, document_kind, storage_path,
    file_name, mime_type, size_bytes
  ) VALUES (
    _application_id, auth.uid(), _document_kind, _storage_path,
    left(_file_name, 240), _mime_type, _size_bytes
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_join_application_document_add(
  uuid, text, text, text, text, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_join_application_document_add(
  uuid, text, text, text, text, integer
) TO authenticated, service_role;

-- Approval cannot be granted without the evidence required by the requested
-- role, even if a reviewer uses the RPC directly outside the admin screen.
CREATE OR REPLACE FUNCTION public.mkt_admin_join_required_documents_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.application_kind IN ('seller', 'service_provider') AND NOT EXISTS (
      SELECT 1 FROM public.mkt_join_application_documents d
      WHERE d.application_id = NEW.id
        AND d.document_kind = 'commercial_registration'
    ) THEN RAISE EXCEPTION 'join_commercial_registration_required'; END IF;
    IF NEW.application_kind = 'delivery_team' AND NOT EXISTS (
      SELECT 1 FROM public.mkt_join_application_documents d
      WHERE d.application_id = NEW.id AND d.document_kind = 'license'
    ) THEN RAISE EXCEPTION 'join_delivery_license_required'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mkt_join_required_documents_guard ON public.mkt_join_applications;
CREATE TRIGGER mkt_join_required_documents_guard
  BEFORE UPDATE OF status ON public.mkt_join_applications
  FOR EACH ROW EXECUTE FUNCTION public.mkt_admin_join_required_documents_guard();

-- Every merchant transition is auditable and updates the lifecycle timestamps.
CREATE OR REPLACE FUNCTION public.mkt_merchant_order_action(
  _account_key text,
  _order_id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_access jsonb;
  v_store uuid;
  v_order public.mkt_orders;
  v_next text;
BEGIN
  v_access := public.mkt_operational_access(_account_key);
  IF NOT coalesce((v_access ->> 'allowed')::boolean, false)
    OR NOT ('orders.receive' = ANY(ARRAY(
      SELECT jsonb_array_elements_text(v_access -> 'capabilities')
    ))) THEN RAISE EXCEPTION 'orders_access_required'; END IF;
  v_store := (v_access ->> 'storefront_id')::uuid;
  SELECT * INTO v_order FROM public.mkt_orders o
  WHERE o.id = _order_id AND o.storefront_id = v_store
  FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  v_next := CASE
    WHEN v_order.order_status = 'submitted' AND _action = 'accept' THEN 'accepted'
    WHEN v_order.order_status = 'submitted' AND _action = 'reject' THEN 'rejected'
    WHEN v_order.order_status = 'accepted' AND _action = 'prepare' THEN 'preparing'
    WHEN v_order.order_status = 'preparing' AND _action = 'ready' THEN 'ready'
    WHEN v_order.order_status = 'ready' AND _action = 'dispatch' THEN 'out_for_delivery'
    WHEN v_order.order_status = 'ready' AND _action = 'complete' THEN 'completed'
    WHEN v_order.order_status = 'out_for_delivery' AND _action = 'complete' THEN 'completed'
    WHEN v_order.order_status IN ('accepted', 'preparing', 'ready')
      AND _action = 'cancel' THEN 'cancelled'
    ELSE NULL END;
  IF v_next IS NULL THEN RAISE EXCEPTION 'order_transition_invalid'; END IF;
  IF _action IN ('reject', 'cancel') AND coalesce(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'order_reason_required';
  END IF;

  UPDATE public.mkt_orders
  SET order_status = v_next,
      merchant_user_id = auth.uid(),
      merchant_notes = CASE WHEN coalesce(btrim(_note), '') = ''
        THEN merchant_notes ELSE btrim(_note) END,
      cancellation_reason = CASE WHEN v_next IN ('rejected', 'cancelled')
        THEN btrim(_note) ELSE cancellation_reason END,
      merchant_account_id = _account_key,
      merchant_tenant_id = (
        SELECT a.tenant_id FROM public.mkt_account_context(_account_key) a LIMIT 1
      ),
      accepted_at = CASE WHEN v_next = 'accepted' THEN now() ELSE accepted_at END,
      completed_at = CASE WHEN v_next = 'completed' THEN now() ELSE completed_at END,
      cancelled_at = CASE WHEN v_next IN ('rejected', 'cancelled') THEN now() ELSE cancelled_at END,
      updated_at = now()
  WHERE id = _order_id;

  INSERT INTO public.mkt_order_status_history (
    order_id, old_status, new_status, changed_by_user_id,
    changed_by_account_id, note
  ) VALUES (
    _order_id, v_order.order_status, v_next, auth.uid(), _account_key,
    nullif(btrim(coalesce(_note, '')), '')
  );

  PERFORM public.mkt_notify(
    v_order.customer_user_id, NULL, 'order_' || v_next,
    'تحديث الطلب ' || v_order.order_number,
    CASE v_next
      WHEN 'accepted' THEN 'تم قبول طلبك.'
      WHEN 'preparing' THEN 'طلبك قيد التجهيز.'
      WHEN 'ready' THEN 'طلبك جاهز.'
      WHEN 'out_for_delivery' THEN 'طلبك خرج للتوصيل.'
      WHEN 'completed' THEN 'تم إكمال طلبك.'
      WHEN 'rejected' THEN 'تعذر قبول طلبك.'
      ELSE 'تم إلغاء الطلب.' END
  );
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_merchant_order_action(text, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_merchant_order_action(text, uuid, text, text)
  TO authenticated, service_role;

-- Trigger functions are not callable browser APIs.
REVOKE ALL ON FUNCTION public.mkt_guard_storefront_scope()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_admin_join_required_documents_guard()
  FROM PUBLIC, anon, authenticated;
