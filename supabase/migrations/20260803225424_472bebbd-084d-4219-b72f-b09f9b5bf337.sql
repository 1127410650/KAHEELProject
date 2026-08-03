-- Enforcement guards: the platform-role table is `mkt_platform_admins`.
CREATE OR REPLACE FUNCTION public.mkt_admin_subject_action(_subject_type text, _subject_id uuid, _action text, _reason text, _days integer DEFAULT NULL::integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE rid uuid; restriction text;
BEGIN
  IF NOT public.mkt_admin_can('restrictions.manage') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _subject_type NOT IN ('user','business') THEN RAISE EXCEPTION 'Invalid subject'; END IF;

  IF _subject_type = 'user' THEN
    IF _subject_id = auth.uid() THEN
      RAISE EXCEPTION 'An administrator cannot run enforcement on their own account';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.mkt_platform_admins a
       WHERE a.user_id = _subject_id AND a.platform_role = 'system_owner'
    ) AND _action <> 'lift' THEN
      RAISE EXCEPTION 'A system owner cannot be restricted from the console';
    END IF;
  END IF;

  IF _action = 'lift' THEN
    FOR rid IN
      SELECT id FROM public.mkt_account_restrictions
      WHERE subject_type = _subject_type AND subject_id = _subject_id AND lifted_at IS NULL
    LOOP
      PERFORM public.mkt_lift_restriction(rid, _reason);
    END LOOP;
    RETURN;
  END IF;

  restriction := CASE _action
    WHEN 'restrict' THEN CASE WHEN _subject_type = 'business' THEN 'suspend_business_publishing' ELSE 'no_new_listings' END
    WHEN 'suspend' THEN 'suspend_account'
    WHEN 'ban' THEN 'permanent_ban'
    WHEN 'revoke_verification' THEN 'revoke_verification'
    ELSE NULL END;
  IF restriction IS NULL THEN RAISE EXCEPTION 'Unknown action'; END IF;

  PERFORM public.mkt_restrict_subject(NULL, _subject_type, _subject_id, restriction, _reason, _days);
END $function$;

-- User file: memberships live in `tenant_memberships`.
CREATE OR REPLACE FUNCTION public.mkt_admin_user_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE result jsonb; can_docs boolean;
BEGIN
  IF NOT public.mkt_admin_can('users.view') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  can_docs := public.mkt_admin_can('docs.view_sensitive');

  SELECT jsonb_build_object(
    'header', (
      SELECT jsonb_build_object(
        'user_id', p.user_id,
        'full_name', p.full_name,
        'email', p.email,
        'phone', p.phone,
        'is_active', p.is_active,
        'locale', p.locale,
        'created_at', p.created_at,
        'country', (SELECT c.name_ar FROM public.mkt_countries c
                     JOIN public.tenants tt ON tt.personal_user_id = p.user_id
                     JOIN public.mkt_business_profiles bp ON bp.tenant_id = tt.id AND bp.country_id = c.id
                     LIMIT 1),
        'platform_role', (SELECT a.platform_role FROM public.mkt_platform_admins a WHERE a.user_id = p.user_id LIMIT 1)
      ) FROM public.profiles p WHERE p.user_id = _user_id
    ),
    'counts', jsonb_build_object(
      'listings', (SELECT count(*) FROM public.mkt_listings l WHERE l.owner_user_id = _user_id),
      'businesses', (SELECT count(*) FROM public.tenant_memberships m JOIN public.tenants t ON t.id = m.tenant_id
                      WHERE m.user_id = _user_id AND t.deleted_at IS NULL),
      'reports_against', (SELECT count(*) FROM public.mkt_reports r WHERE r.owner_user_id = _user_id),
      'reports_filed', (SELECT count(*) FROM public.mkt_reports r WHERE r.reporter_user_id = _user_id),
      'restrictions', (SELECT count(*) FROM public.mkt_account_restrictions x
                        WHERE x.subject_type = 'user' AND x.subject_id = _user_id),
      'restrictions_active', (SELECT count(*) FROM public.mkt_account_restrictions x
                        WHERE x.subject_type = 'user' AND x.subject_id = _user_id AND x.lifted_at IS NULL
                          AND (x.expires_at IS NULL OR x.expires_at > now()))
    ),
    'listings', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', l.id, 'ref_no', l.ref_no::text, 'title', l.title,
          'status', l.status, 'city', l.city, 'price', l.price, 'currency', l.currency,
          'created_at', l.created_at, 'published_at', l.published_at, 'expires_at', l.expires_at,
          'deleted_at', l.deleted_at, 'reports_count', l.reports_count, 'views_count', l.views_count) x
          FROM public.mkt_listings l
         WHERE l.owner_user_id = _user_id AND (l.deleted_at IS NULL OR can_docs)
         ORDER BY l.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'businesses', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('tenant_id', t.id, 'name', COALESCE(bp.display_name_ar, t.name_ar),
          'role', m.role::text, 'slug', bp.slug, 'verification_status', bp.verification_status,
          'status', t.status, 'joined_at', COALESCE(m.joined_at, m.created_at)) x
          FROM public.tenant_memberships m
          JOIN public.tenants t ON t.id = m.tenant_id
          LEFT JOIN public.mkt_business_profiles bp ON bp.tenant_id = t.id
         WHERE m.user_id = _user_id AND t.deleted_at IS NULL
         ORDER BY m.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'reports_against', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'listing_id', r.listing_id,
          'status', r.status, 'decision', r.decision, 'reason_code', r.reason_code,
          'created_at', r.created_at, 'closed_at', r.closed_at) x
          FROM public.mkt_reports r WHERE r.owner_user_id = _user_id
         ORDER BY r.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'reports_filed', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'listing_id', r.listing_id,
          'status', r.status, 'decision', r.decision, 'created_at', r.created_at) x
          FROM public.mkt_reports r WHERE r.reporter_user_id = _user_id
         ORDER BY r.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'verifications', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', v.id, 'tenant_id', v.tenant_id, 'status', v.status,
          'note', v.note, 'decision_reason', v.decision_reason, 'created_at', v.created_at,
          'decided_at', v.decided_at) x
          FROM public.mkt_verification_requests v
         WHERE v.submitted_by = _user_id
            OR v.tenant_id IN (SELECT m.tenant_id FROM public.tenant_memberships m WHERE m.user_id = _user_id)
         ORDER BY v.created_at DESC LIMIT 50
      ) s), '[]'::jsonb),
    'restrictions', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', x.id, 'restriction', x.restriction, 'reason', x.reason,
          'starts_at', x.starts_at, 'expires_at', x.expires_at, 'lifted_at', x.lifted_at,
          'lifted_reason', x.lifted_reason, 'created_by', x.created_by,
          'created_by_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = x.created_by),
          'created_at', x.created_at) x
          FROM public.mkt_account_restrictions x
         WHERE x.subject_type = 'user' AND x.subject_id = _user_id
         ORDER BY x.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'notifications', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', n.id, 'event', n.event, 'title', n.title,
          'created_at', n.created_at, 'read_at', n.read_at) x
          FROM public.mkt_notifications n WHERE n.user_id = _user_id
         ORDER BY n.created_at DESC LIMIT 50
      ) s), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', a.id, 'action', a.action, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'reason', a.reason, 'created_at', a.created_at,
          'actor_id', a.actor_id,
          'actor_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = a.actor_id),
          'old_value', a.old_value, 'new_value', a.new_value) x
          FROM public.audit_log a
         WHERE a.entity_id = _user_id
            OR a.new_value->>'subject_id' = _user_id::text
            OR a.new_value->>'user_id' = _user_id::text
         ORDER BY a.created_at DESC LIMIT 100
      ) s), '[]'::jsonb)
  ) INTO result;

  IF result->'header' IS NULL OR result->'header' = 'null'::jsonb THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  RETURN result;
END $function$;

-- Business file: members come from `tenant_memberships`.
CREATE OR REPLACE FUNCTION public.mkt_admin_business_detail(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE result jsonb; can_docs boolean;
BEGIN
  IF NOT public.mkt_admin_can('businesses.view') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  can_docs := public.mkt_admin_can('docs.view_sensitive');

  SELECT jsonb_build_object(
    'header', (
      SELECT jsonb_build_object(
        'tenant_id', t.id,
        'name', COALESCE(bp.display_name_ar, t.name_ar),
        'name_en', COALESCE(bp.display_name_en, t.name_en),
        'slug', bp.slug,
        'tenant_type', t.tenant_type::text,
        'usage_type', t.usage_type,
        'status', t.status,
        'created_at', t.created_at,
        'verification_status', bp.verification_status,
        'verified_at', bp.verified_at,
        'city', bp.city,
        'region', bp.region,
        'main_activity', bp.main_activity,
        'sub_activities', bp.sub_activities,
        'is_published', bp.is_published,
        'headline', bp.headline,
        'about', bp.about,
        'public_phone', bp.public_phone,
        'public_email', bp.public_email,
        'public_website', bp.public_website,
        'country', (SELECT c.name_ar FROM public.mkt_countries c WHERE c.id = bp.country_id),
        'officer', (SELECT p.full_name FROM public.tenant_memberships m
                     JOIN public.profiles p ON p.user_id = m.user_id
                    WHERE m.tenant_id = t.id ORDER BY m.created_at LIMIT 1),
        'officer_id', (SELECT m.user_id FROM public.tenant_memberships m
                        WHERE m.tenant_id = t.id ORDER BY m.created_at LIMIT 1),
        'registration', CASE WHEN can_docs THEN t.commercial_registration_number ELSE NULL END,
        'vat_number', CASE WHEN can_docs THEN t.vat_number ELSE NULL END
      ) FROM public.tenants t
        LEFT JOIN public.mkt_business_profiles bp ON bp.tenant_id = t.id
       WHERE t.id = _tenant_id
    ),
    'counts', jsonb_build_object(
      'listings', (SELECT count(*) FROM public.mkt_listings l WHERE l.tenant_id = _tenant_id),
      'members', (SELECT count(*) FROM public.tenant_memberships m WHERE m.tenant_id = _tenant_id),
      'reports', (SELECT count(*) FROM public.mkt_reports r WHERE r.tenant_id = _tenant_id),
      'restrictions_active', (SELECT count(*) FROM public.mkt_account_restrictions x
                        WHERE x.subject_type = 'business' AND x.subject_id = _tenant_id
                          AND x.lifted_at IS NULL AND (x.expires_at IS NULL OR x.expires_at > now()))
    ),
    'listings', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', l.id, 'ref_no', l.ref_no::text, 'title', l.title,
          'status', l.status, 'city', l.city, 'created_at', l.created_at,
          'published_at', l.published_at, 'expires_at', l.expires_at, 'deleted_at', l.deleted_at) x
          FROM public.mkt_listings l
         WHERE l.tenant_id = _tenant_id AND (l.deleted_at IS NULL OR can_docs)
         ORDER BY l.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('user_id', m.user_id, 'role', m.role::text,
          'name', p.full_name, 'email', p.email, 'joined_at', COALESCE(m.joined_at, m.created_at)) x
          FROM public.tenant_memberships m
          LEFT JOIN public.profiles p ON p.user_id = m.user_id
         WHERE m.tenant_id = _tenant_id ORDER BY m.created_at LIMIT 100
      ) s), '[]'::jsonb),
    'verifications', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', v.id, 'status', v.status, 'note', v.note,
          'decision_reason', v.decision_reason, 'created_at', v.created_at,
          'decided_at', v.decided_at,
          'files', (SELECT count(*) FROM public.mkt_verification_files f WHERE f.request_id = v.id)) x
          FROM public.mkt_verification_requests v
         WHERE v.tenant_id = _tenant_id ORDER BY v.created_at DESC LIMIT 50
      ) s), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'listing_id', r.listing_id,
          'status', r.status, 'decision', r.decision, 'created_at', r.created_at) x
          FROM public.mkt_reports r WHERE r.tenant_id = _tenant_id
         ORDER BY r.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'restrictions', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', x.id, 'restriction', x.restriction, 'reason', x.reason,
          'starts_at', x.starts_at, 'expires_at', x.expires_at, 'lifted_at', x.lifted_at,
          'lifted_reason', x.lifted_reason,
          'created_by_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = x.created_by),
          'created_at', x.created_at) x
          FROM public.mkt_account_restrictions x
         WHERE x.subject_type = 'business' AND x.subject_id = _tenant_id
         ORDER BY x.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', a.id, 'action', a.action, 'entity_type', a.entity_type,
          'reason', a.reason, 'created_at', a.created_at,
          'actor_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = a.actor_id),
          'new_value', a.new_value) x
          FROM public.audit_log a
         WHERE a.entity_id = _tenant_id
            OR a.tenant_id = _tenant_id
            OR a.new_value->>'subject_id' = _tenant_id::text
         ORDER BY a.created_at DESC LIMIT 100
      ) s), '[]'::jsonb)
  ) INTO result;

  IF result->'header' IS NULL OR result->'header' = 'null'::jsonb THEN
    RAISE EXCEPTION 'Business not found';
  END IF;
  RETURN result;
END $function$;

-- Listing file: image column is `url`.
CREATE OR REPLACE FUNCTION public.mkt_admin_listing_detail(_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.mkt_admin_can('listings.view') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT jsonb_build_object(
    'header', (
      SELECT jsonb_build_object(
        'id', l.id, 'ref_no', l.ref_no::text, 'slug', l.slug, 'title', l.title,
        'summary', l.summary, 'description', l.description, 'status', l.status,
        'advertiser_type', l.advertiser_type, 'owner_user_id', l.owner_user_id,
        'owner_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = l.owner_user_id),
        'tenant_id', l.tenant_id,
        'tenant_name', (SELECT COALESCE(bp.display_name_ar, t.name_ar) FROM public.tenants t
                         LEFT JOIN public.mkt_business_profiles bp ON bp.tenant_id = t.id
                        WHERE t.id = l.tenant_id),
        'category', (SELECT c.name_ar FROM public.mkt_categories c WHERE c.id = l.category_id),
        'subcategory', (SELECT c.name_ar FROM public.mkt_categories c WHERE c.id = l.subcategory_id),
        'price', l.price, 'price_on_request', l.price_on_request, 'currency', l.currency,
        'city', l.city, 'region', l.region, 'cover_image_url', l.cover_image_url,
        'duration_days', l.duration_days, 'created_at', l.created_at,
        'published_at', l.published_at, 'expires_at', l.expires_at, 'paused_at', l.paused_at,
        'deleted_at', l.deleted_at, 'rejection_reason', l.rejection_reason,
        'views_count', l.views_count, 'shares_count', l.shares_count,
        'favorites_count', l.favorites_count, 'contact_requests_count', l.contact_requests_count,
        'quote_requests_count', l.quote_requests_count, 'reports_count', l.reports_count
      ) FROM public.mkt_listings l WHERE l.id = _listing_id
    ),
    'images', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', i.id, 'url', i.url, 'is_cover', i.is_cover,
          'sort_order', i.sort_order) x
          FROM public.mkt_listing_images i
         WHERE i.listing_id = _listing_id AND i.deleted_at IS NULL
         ORDER BY i.sort_order LIMIT 30
      ) s), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', e.id, 'event_type', e.event_type, 'meta', e.meta,
          'created_at', e.created_at, 'actor_id', e.actor_id,
          'actor_name', (SELECT p.full_name FROM public.profiles p WHERE p.user_id = e.actor_id)) x
          FROM public.mkt_listing_events e WHERE e.listing_id = _listing_id
         ORDER BY e.created_at DESC LIMIT 100
      ) s), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('id', r.id, 'ref_no', r.ref_no, 'status', r.status,
          'decision', r.decision, 'reason_code', r.reason_code, 'severity', r.severity,
          'created_at', r.created_at) x
          FROM public.mkt_reports r WHERE r.listing_id = _listing_id
         ORDER BY r.created_at DESC LIMIT 100
      ) s), '[]'::jsonb)
  ) INTO result;

  IF result->'header' IS NULL OR result->'header' = 'null'::jsonb THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  RETURN result;
END $function$;