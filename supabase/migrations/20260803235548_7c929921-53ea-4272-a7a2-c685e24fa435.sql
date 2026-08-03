-- ─────────────────────────────────────────────────────────────────────────────
-- 0) helpers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_norm_digits(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT translate(COALESCE(_t,''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_norm_digits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_norm_digits(text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) shared admin work queue: one row per (kind, subject), claim / transfer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.mkt_admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('listing_review','report','verification','activity_suggestion','account_review','business_review')),
  subject_id uuid NOT NULL,
  assignee uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  released_at timestamptz,
  released_reason text,
  transferred_from uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transfer_reason text,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mkt_admin_assignments_active
  ON public.mkt_admin_assignments (kind, subject_id)
  WHERE released_at IS NULL AND closed_at IS NULL;
CREATE INDEX mkt_admin_assignments_assignee ON public.mkt_admin_assignments (assignee)
  WHERE released_at IS NULL AND closed_at IS NULL;

GRANT SELECT ON public.mkt_admin_assignments TO authenticated;
GRANT ALL ON public.mkt_admin_assignments TO service_role;
ALTER TABLE public.mkt_admin_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_admin_assignments_read ON public.mkt_admin_assignments
  FOR SELECT TO authenticated
  USING (public.mkt_admin_can('reports.view') OR public.mkt_admin_can('listings.view')
         OR public.mkt_admin_can('verifications.view'));

CREATE TRIGGER mkt_admin_assignments_touch
  BEFORE UPDATE ON public.mkt_admin_assignments
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- perm required to act on a queue kind
CREATE OR REPLACE FUNCTION public.mkt_queue_perm(_kind text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE _kind
    WHEN 'listing_review'       THEN 'listings.review'
    WHEN 'report'               THEN 'reports.manage'
    WHEN 'verification'         THEN 'verifications.manage'
    WHEN 'activity_suggestion'  THEN 'listings.review'
    WHEN 'account_review'       THEN 'users.manage'
    WHEN 'business_review'      THEN 'businesses.manage'
    ELSE 'restrictions.manage' END
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_queue_perm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_queue_perm(text) TO authenticated, service_role;

-- claim: fails when someone else already holds the item (no conflicting decisions)
CREATE OR REPLACE FUNCTION public.mkt_admin_claim(_kind text, _subject_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;
  IF _row.id IS NOT NULL THEN
    IF _row.assignee = auth.uid() THEN RETURN _row.id; END IF;
    RAISE EXCEPTION 'already_claimed';
  END IF;
  INSERT INTO public.mkt_admin_assignments (kind, subject_id, assignee, claimed_at)
  VALUES (_kind, _subject_id, auth.uid(), now())
  RETURNING id INTO _id;
  PERFORM public.log_audit('mkt_admin_assignments','claim', _id, NULL,
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id), NULL);
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_claim(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_claim(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_transfer(_kind text, _subject_id uuid, _to uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE _row public.mkt_admin_assignments; _id uuid;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _to IS NULL OR NOT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = _to)
     AND NOT EXISTS (SELECT 1 FROM public.mkt_staff_permissions p WHERE p.user_id = _to) THEN
    RAISE EXCEPTION 'invalid_assignee';
  END IF;
  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;
  IF _row.id IS NULL THEN
    INSERT INTO public.mkt_admin_assignments (kind, subject_id, assignee, claimed_at, transferred_from, transfer_reason)
    VALUES (_kind, _subject_id, _to, now(), auth.uid(), _reason) RETURNING id INTO _id;
  ELSE
    IF NOT (public.mkt_is_platform_admin() OR _row.assignee = auth.uid()) THEN
      RAISE EXCEPTION 'not_holder';
    END IF;
    UPDATE public.mkt_admin_assignments
       SET assignee = _to, claimed_at = now(), transferred_from = _row.assignee, transfer_reason = _reason
     WHERE id = _row.id RETURNING id INTO _id;
  END IF;
  PERFORM public.log_audit('mkt_admin_assignments','transfer', _id,
    jsonb_build_object('assignee', _row.assignee),
    jsonb_build_object('kind', _kind, 'subject_id', _subject_id, 'assignee', _to), _reason);
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_transfer(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_transfer(text, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_release(_kind text, _subject_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE _row public.mkt_admin_assignments;
BEGIN
  IF NOT public.mkt_admin_can(public.mkt_queue_perm(_kind)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT * INTO _row FROM public.mkt_admin_assignments
    WHERE kind = _kind AND subject_id = _subject_id AND released_at IS NULL AND closed_at IS NULL
    FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (public.mkt_is_platform_admin() OR _row.assignee = auth.uid()) THEN RAISE EXCEPTION 'not_holder'; END IF;
  UPDATE public.mkt_admin_assignments
     SET released_at = now(), released_reason = _reason WHERE id = _row.id;
  PERFORM public.log_audit('mkt_admin_assignments','release', _row.id,
    jsonb_build_object('assignee', _row.assignee), NULL, _reason);
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_release(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_release(text, uuid, text) TO authenticated;

-- who holds each subject (label included so the console needs no extra read)
CREATE OR REPLACE FUNCTION public.mkt_admin_assignments_for(_kind text, _subject_ids uuid[])
RETURNS TABLE (subject_id uuid, assignee uuid, assignee_label text, claimed_at timestamptz, is_mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT a.subject_id, a.assignee,
         COALESCE(p.full_name, up.display_name, p.email),
         a.claimed_at, a.assignee = auth.uid()
    FROM public.mkt_admin_assignments a
    LEFT JOIN public.profiles p ON p.user_id = a.assignee
    LEFT JOIN public.mkt_user_profiles up ON up.user_id = a.assignee
   WHERE a.kind = _kind AND a.subject_id = ANY (_subject_ids)
     AND a.released_at IS NULL AND a.closed_at IS NULL
     AND public.mkt_admin_can(public.mkt_queue_perm(_kind))
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_assignments_for(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_assignments_for(text, uuid[]) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) advertiser safety summary
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_advertiser_safety(_user_id uuid, _tenant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_verified boolean := false; v_email_ok boolean := false; v_phone_ok boolean := false;
  v_confirmed int := 0; v_reviewing int := 0; v_invalid int := 0;
  v_restrictions int := 0; v_suspensions int := 0; v_banned boolean := false;
  v_notes boolean := false; v_last timestamptz; v_score int := 0; v_level text;
BEGIN
  IF NOT (public.mkt_admin_can('users.view') OR public.mkt_admin_can('listings.view')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT (u.email_confirmed_at IS NOT NULL), (u.phone_confirmed_at IS NOT NULL)
    INTO v_email_ok, v_phone_ok FROM auth.users u WHERE u.id = _user_id;

  IF _tenant_id IS NOT NULL THEN
    SELECT COALESCE(bp.verification_status = 'verified', false) INTO v_verified
      FROM public.mkt_business_profiles bp WHERE bp.tenant_id = _tenant_id;
  ELSE
    SELECT COALESCE(up.verification_status = 'verified', false) INTO v_verified
      FROM public.mkt_user_profiles up WHERE up.user_id = _user_id;
  END IF;

  SELECT
    count(*) FILTER (WHERE r.decision = 'valid' OR r.status = 'valid'),
    count(*) FILTER (WHERE r.status IN ('new','open','in_review','under_review','needs_info')),
    count(*) FILTER (WHERE r.decision = 'invalid' OR r.status = 'invalid')
  INTO v_confirmed, v_reviewing, v_invalid
  FROM public.mkt_reports r
  WHERE r.owner_user_id = _user_id
     OR (_tenant_id IS NOT NULL AND r.tenant_id = _tenant_id);

  SELECT count(*) FILTER (WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
         count(*) FILTER (WHERE restriction = 'suspend_account'),
         bool_or(restriction = 'permanent_ban' AND lifted_at IS NULL),
         max(created_at)
    INTO v_restrictions, v_suspensions, v_banned, v_last
    FROM public.mkt_account_restrictions
   WHERE (subject_type = 'user' AND subject_id = _user_id)
      OR (_tenant_id IS NOT NULL AND subject_type = 'business' AND subject_id = _tenant_id);

  SELECT EXISTS (
    SELECT 1 FROM public.mkt_admin_notes n
     WHERE (n.subject_type = 'user' AND n.subject_id = _user_id)
        OR (_tenant_id IS NOT NULL AND n.subject_type = 'business' AND n.subject_id = _tenant_id)
  ) INTO v_notes;

  v_score := (CASE WHEN COALESCE(v_banned,false) THEN 100 ELSE 0 END)
           + COALESCE(v_confirmed,0) * 20
           + COALESCE(v_restrictions,0) * 15
           + COALESCE(v_suspensions,0) * 10
           + COALESCE(v_reviewing,0) * 3
           + (CASE WHEN v_verified THEN 0 ELSE 5 END)
           + (CASE WHEN COALESCE(v_email_ok,false) THEN 0 ELSE 3 END)
           + (CASE WHEN COALESCE(v_phone_ok,false) THEN 0 ELSE 3 END);
  v_level := CASE WHEN v_score >= 60 THEN 'critical'
                  WHEN v_score >= 30 THEN 'high'
                  WHEN v_score >= 12 THEN 'medium'
                  ELSE 'low' END;

  RETURN jsonb_build_object(
    'verified', v_verified,
    'email_confirmed', COALESCE(v_email_ok,false),
    'phone_confirmed', COALESCE(v_phone_ok,false),
    'reports_confirmed', COALESCE(v_confirmed,0),
    'reports_reviewing', COALESCE(v_reviewing,0),
    'reports_invalid', COALESCE(v_invalid,0),
    'violations', COALESCE(v_confirmed,0),
    'active_restrictions', COALESCE(v_restrictions,0),
    'suspensions', COALESCE(v_suspensions,0),
    'banned', COALESCE(v_banned,false),
    'has_notes', v_notes,
    'last_violation_at', v_last,
    'risk_score', v_score,
    'risk_level', v_level
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_advertiser_safety(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_advertiser_safety(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) unified admin search
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_admin_search(_q text, _limit integer DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE
  q text; lim int := LEAST(GREATEST(COALESCE(_limit,8), 1), 25);
  can_users boolean; can_biz boolean; can_listings boolean; can_reports boolean; can_ver boolean;
  sensitive boolean;
  out_users jsonb := '[]'::jsonb; out_biz jsonb := '[]'::jsonb; out_listings jsonb := '[]'::jsonb;
  out_reports jsonb := '[]'::jsonb; out_ver jsonb := '[]'::jsonb;
BEGIN
  q := btrim(public.mkt_norm_digits(_q));
  IF length(q) < 2 THEN RETURN jsonb_build_object('query', q, 'groups', '[]'::jsonb); END IF;
  can_users    := public.mkt_admin_can('users.view');
  can_biz      := public.mkt_admin_can('businesses.view');
  can_listings := public.mkt_admin_can('listings.view');
  can_reports  := public.mkt_admin_can('reports.view');
  can_ver      := public.mkt_admin_can('verifications.view');
  IF NOT (can_users OR can_biz OR can_listings OR can_reports OR can_ver) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  sensitive := public.mkt_admin_can('docs.view_sensitive');

  IF can_users THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO out_users FROM (
      SELECT jsonb_build_object(
               'id', p.user_id,
               'title', COALESCE(p.full_name, up.display_name, p.email, 'user'),
               'subtitle', COALESCE(p.email, up.username),
               'meta', CASE WHEN sensitive THEN p.phone ELSE NULL END
             ) AS x
        FROM public.profiles p
        LEFT JOIN public.mkt_user_profiles up ON up.user_id = p.user_id
       WHERE p.full_name ILIKE '%'||q||'%'
          OR p.email ILIKE '%'||q||'%'
          OR public.mkt_norm_digits(p.phone) ILIKE '%'||q||'%'
          OR up.username ILIKE '%'||q||'%'
          OR up.display_name ILIKE '%'||q||'%'
          OR p.user_id::text = q
       ORDER BY p.created_at DESC LIMIT lim
    ) s;
  END IF;

  IF can_biz THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO out_biz FROM (
      SELECT jsonb_build_object(
               'id', t.id,
               'title', COALESCE(t.name_ar, t.name_en, t.legal_name),
               'subtitle', COALESCE(t.activity, t.city),
               'meta', CASE WHEN sensitive THEN t.commercial_registration_number ELSE NULL END
             ) AS x
        FROM public.tenants t
       WHERE t.deleted_at IS NULL AND t.personal_user_id IS NULL
         AND (t.name_ar ILIKE '%'||q||'%' OR t.name_en ILIKE '%'||q||'%'
              OR t.legal_name ILIKE '%'||q||'%' OR t.activity ILIKE '%'||q||'%'
              OR t.city ILIKE '%'||q||'%'
              OR public.mkt_norm_digits(t.commercial_registration_number) ILIKE '%'||q||'%'
              OR t.id::text = q)
       ORDER BY t.created_at DESC LIMIT lim
    ) s;
  END IF;

  IF can_listings THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO out_listings FROM (
      SELECT jsonb_build_object(
               'id', l.id,
               'title', l.title,
               'subtitle', COALESCE(c.name_ar, l.city),
               'meta', COALESCE(l.ref_no::text, l.status)
             ) AS x
        FROM public.mkt_listings l
        LEFT JOIN public.mkt_categories c ON c.id = l.category_id
       WHERE l.title ILIKE '%'||q||'%'
          OR l.city ILIKE '%'||q||'%'
          OR l.ref_no::text = q
          OR l.id::text = q
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(l.keywords, ARRAY[]::text[])) k WHERE k ILIKE '%'||q||'%')
       ORDER BY l.created_at DESC LIMIT lim
    ) s;
  END IF;

  IF can_reports THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO out_reports FROM (
      SELECT jsonb_build_object(
               'id', r.id,
               'title', COALESCE(r.ref_no, left(r.id::text, 8)),
               'subtitle', l.title,
               'meta', r.status
             ) AS x
        FROM public.mkt_reports r
        LEFT JOIN public.mkt_listings l ON l.id = r.listing_id
       WHERE r.ref_no ILIKE '%'||q||'%'
          OR l.title ILIKE '%'||q||'%'
          OR r.status ILIKE '%'||q||'%'
          OR r.id::text = q
       ORDER BY r.created_at DESC LIMIT lim
    ) s;
  END IF;

  IF can_ver THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO out_ver FROM (
      SELECT jsonb_build_object(
               'id', v.id,
               'title', COALESCE(t.name_ar, t.name_en, left(v.id::text, 8)),
               'subtitle', v.status,
               'meta', to_char(v.created_at, 'DD/MM/YYYY')
             ) AS x
        FROM public.mkt_verification_requests v
        LEFT JOIN public.tenants t ON t.id = v.tenant_id
       WHERE v.id::text = q
          OR v.status ILIKE '%'||q||'%'
          OR t.name_ar ILIKE '%'||q||'%' OR t.name_en ILIKE '%'||q||'%'
       ORDER BY v.created_at DESC LIMIT lim
    ) s;
  END IF;

  RETURN jsonb_build_object(
    'query', q,
    'groups', jsonb_build_array(
      jsonb_build_object('type','users','count', jsonb_array_length(out_users),'items', out_users),
      jsonb_build_object('type','businesses','count', jsonb_array_length(out_biz),'items', out_biz),
      jsonb_build_object('type','listings','count', jsonb_array_length(out_listings),'items', out_listings),
      jsonb_build_object('type','reports','count', jsonb_array_length(out_reports),'items', out_reports),
      jsonb_build_object('type','verifications','count', jsonb_array_length(out_ver),'items', out_ver)
    )
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_search(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_search(text, integer) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) republish a listing (same row, same slug, same stats)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_listing_republish(_listing_id uuid, _days integer, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE l public.mkt_listings; _cat_ok boolean;
BEGIN
  IF NOT public.mkt_admin_can('listings.review') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _days IS NULL OR _days NOT IN (1,3,7,14,30) THEN RAISE EXCEPTION 'invalid_duration'; END IF;

  SELECT * INTO l FROM public.mkt_listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF l.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'deleted'; END IF;
  IF l.status NOT IN ('paused','expired','suspended','archived','rejected','published') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;
  IF btrim(COALESCE(l.title,'')) = '' OR l.category_id IS NULL THEN RAISE EXCEPTION 'incomplete'; END IF;

  SELECT COALESCE(c.is_active, false) INTO _cat_ok FROM public.mkt_categories c WHERE c.id = l.category_id;
  IF NOT COALESCE(_cat_ok,false) THEN RAISE EXCEPTION 'category_inactive'; END IF;

  IF public.mkt_listing_images_required(l.id)
     AND NOT EXISTS (SELECT 1 FROM public.mkt_listing_images i WHERE i.listing_id = l.id) THEN
    RAISE EXCEPTION 'images_required';
  END IF;

  IF public.mkt_has_restriction('user', l.owner_user_id,
       ARRAY['permanent_ban','suspend_account','no_new_listings']) THEN
    RAISE EXCEPTION 'owner_blocked';
  END IF;
  IF l.tenant_id IS NOT NULL AND public.mkt_has_restriction('business', l.tenant_id,
       ARRAY['permanent_ban','suspend_account','suspend_business_publishing']) THEN
    RAISE EXCEPTION 'business_blocked';
  END IF;

  PERFORM public.mkt_set_listing_status(l.id, 'published', _reason);
  UPDATE public.mkt_listings
     SET duration_days = _days::smallint,
         published_at = now(),
         expires_at = now() + make_interval(days => _days),
         last_renewed_at = now(),
         paused_at = NULL,
         expiry_notice_stage = 0,
         rejection_reason = NULL
   WHERE id = l.id;

  PERFORM public.mkt_log_listing_event(l.id, 'admin_republished',
    jsonb_build_object('duration_days', _days, 'reason', _reason));
  PERFORM public.log_audit('mkt_listings','republish', l.id,
    jsonb_build_object('status', l.status, 'expires_at', l.expires_at),
    jsonb_build_object('status','published','duration_days', _days), _reason);
  PERFORM public.mkt_notify(l.owner_user_id, NULL, 'listing_republished',
    'أُعيد نشر إعلانك', COALESCE(l.title,''));
  RETURN 'published';
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_listing_republish(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_republish(uuid, integer, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) create a listing on behalf of an advertiser
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mkt_listings ADD COLUMN IF NOT EXISTS created_by_staff uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.mkt_admin_listing_create_for(
  _owner_user_id uuid, _tenant_id uuid, _title text, _reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE _id uuid; _owner uuid := _owner_user_id;
BEGIN
  IF NOT public.mkt_admin_can('listings.review') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF btrim(COALESCE(_title,'')) = '' THEN RAISE EXCEPTION 'title_required'; END IF;

  IF _tenant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = _tenant_id AND t.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'not_found';
    END IF;
    IF _owner IS NULL THEN
      SELECT m.user_id INTO _owner FROM public.memberships m
       WHERE m.tenant_id = _tenant_id ORDER BY m.created_at LIMIT 1;
    END IF;
    IF public.mkt_has_restriction('business', _tenant_id,
         ARRAY['permanent_ban','suspend_account','suspend_business_publishing']) THEN
      RAISE EXCEPTION 'business_blocked';
    END IF;
  END IF;
  IF _owner IS NULL THEN RAISE EXCEPTION 'owner_required'; END IF;
  IF public.mkt_has_restriction('user', _owner, ARRAY['permanent_ban','suspend_account','no_new_listings']) THEN
    RAISE EXCEPTION 'owner_blocked';
  END IF;

  INSERT INTO public.mkt_listings (owner_user_id, tenant_id, title, status,
                                   advertiser_type, created_by_staff)
  VALUES (_owner, _tenant_id, btrim(_title), 'draft',
          CASE WHEN _tenant_id IS NULL THEN 'individual' ELSE 'business' END, auth.uid())
  RETURNING id INTO _id;

  PERFORM public.mkt_log_listing_event(_id, 'created_on_behalf',
    jsonb_build_object('staff', auth.uid(), 'reason', _reason));
  PERFORM public.log_audit('mkt_listings','create_on_behalf', _id, NULL,
    jsonb_build_object('owner_user_id', _owner, 'tenant_id', _tenant_id), _reason);
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_listing_create_for(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_create_for(uuid, uuid, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) overview counters used by the console home
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_admin_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pending int; v_reports int; v_ver int; v_sugg int; v_unassigned int;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT count(*) INTO v_pending FROM public.mkt_listings
   WHERE status IN ('pending','pending_review','in_review') AND deleted_at IS NULL;
  SELECT count(*) INTO v_reports FROM public.mkt_reports WHERE status IN ('new','open');
  SELECT count(*) INTO v_ver FROM public.mkt_verification_requests WHERE status = 'pending';
  SELECT count(*) INTO v_sugg FROM public.mkt_activity_suggestions WHERE status = 'pending';

  SELECT (v_pending - (SELECT count(*) FROM public.mkt_admin_assignments a
                        JOIN public.mkt_listings l ON l.id = a.subject_id
                       WHERE a.kind = 'listing_review' AND a.released_at IS NULL AND a.closed_at IS NULL
                         AND l.status IN ('pending','pending_review','in_review') AND l.deleted_at IS NULL))
       + (v_reports - (SELECT count(*) FROM public.mkt_reports r
                        WHERE r.status IN ('new','open') AND r.assigned_to IS NOT NULL))
       + (v_ver - (SELECT count(*) FROM public.mkt_admin_assignments a
                    JOIN public.mkt_verification_requests v ON v.id = a.subject_id
                   WHERE a.kind = 'verification' AND a.released_at IS NULL AND a.closed_at IS NULL
                     AND v.status = 'pending'))
    INTO v_unassigned;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'businesses', (SELECT count(*) FROM public.tenants t
                    WHERE t.deleted_at IS NULL AND t.personal_user_id IS NULL),
    'listings_published', (SELECT count(*) FROM public.mkt_listings
                            WHERE status = 'published' AND deleted_at IS NULL),
    'listings_pending', v_pending,
    'reports_new', v_reports,
    'verifications_pending', v_ver,
    'restricted_accounts', (SELECT count(DISTINCT subject_id) FROM public.mkt_account_restrictions
                             WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())
                               AND restriction NOT IN ('permanent_ban','suspend_account')),
    'banned_accounts', (SELECT count(DISTINCT subject_id) FROM public.mkt_account_restrictions
                         WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())
                           AND restriction IN ('permanent_ban','suspend_account')),
    'activity_suggestions', v_sugg,
    'unassigned_requests', GREATEST(COALESCE(v_unassigned,0), 0),
    'assigned_to_me', (SELECT count(*) FROM public.mkt_admin_assignments a
                        WHERE a.assignee = auth.uid() AND a.released_at IS NULL AND a.closed_at IS NULL)
                      + (SELECT count(*) FROM public.mkt_reports r
                          WHERE r.assigned_to = auth.uid() AND r.status NOT IN ('closed','valid','invalid')),
    'urgent_actions', (SELECT count(*) FROM public.mkt_reports r
                        WHERE r.status IN ('new','open') AND (r.priority = 'urgent' OR r.severity = 'high'))
  );
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) verification review: idempotent + notifies the applicant
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_review_verification(_request_id uuid, _action text, _reason text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE req public.mkt_verification_requests; new_status text; biz text;
BEGIN
  IF NOT public.mkt_admin_can('verifications.manage') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO req FROM public.mkt_verification_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  new_status := CASE _action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'needs_more' THEN 'needs_more'
    ELSE NULL END;
  IF new_status IS NULL THEN RAISE EXCEPTION 'Unknown action'; END IF;
  IF req.status = new_status THEN RAISE EXCEPTION 'already_decided'; END IF;
  IF _action <> 'approve' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  UPDATE public.mkt_verification_requests
     SET status = new_status, decision_reason = _reason,
         decided_by = auth.uid(), decided_at = now()
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

  UPDATE public.mkt_admin_assignments
     SET closed_at = now(), closed_by = auth.uid()
   WHERE kind = 'verification' AND subject_id = _request_id
     AND released_at IS NULL AND closed_at IS NULL;

  SELECT COALESCE(t.name_ar, t.name_en, '') INTO biz FROM public.tenants t WHERE t.id = req.tenant_id;
  IF req.submitted_by IS NOT NULL THEN
    PERFORM public.mkt_notify(req.submitted_by, NULL, 'verification_' || new_status,
      CASE _action WHEN 'approve' THEN 'تم اعتماد التوثيق'
                   WHEN 'reject' THEN 'تم رفض طلب التوثيق'
                   ELSE 'طلب استكمال بيانات التوثيق' END,
      COALESCE(biz, '') || CASE WHEN _reason IS NULL THEN '' ELSE ' — ' || _reason END);
  END IF;

  PERFORM public.log_audit('mkt_business_verification', _action, _request_id,
    jsonb_build_object('status', req.status), jsonb_build_object('status', new_status), _reason);
END $$;