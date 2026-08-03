-- 1. Platform role level on the existing platform-admin table -------------------
ALTER TABLE public.mkt_platform_admins
  ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'platform_admin';

ALTER TABLE public.mkt_platform_admins
  DROP CONSTRAINT IF EXISTS mkt_platform_admins_platform_role_check;
ALTER TABLE public.mkt_platform_admins
  ADD CONSTRAINT mkt_platform_admins_platform_role_check
  CHECK (platform_role IN ('system_owner', 'platform_admin'));

ALTER TABLE public.mkt_platform_admins
  ADD COLUMN IF NOT EXISTS granted_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Role predicates ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_is_system_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_platform_admins a
    WHERE a.user_id = auth.uid() AND a.platform_role = 'system_owner'
  )
$$;
REVOKE ALL ON FUNCTION public.mkt_is_system_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_is_system_owner() TO authenticated, service_role;

-- Single server-side source of truth used by the client for admin routing.
CREATE OR REPLACE FUNCTION public.mkt_my_platform_role()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'platform_role', (
      SELECT a.platform_role FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()
    ),
    'is_system_owner', public.mkt_is_system_owner(),
    'is_platform_admin', public.mkt_is_platform_admin(),
    'staff_perms', COALESCE((
      SELECT array_agg(DISTINCT p.perm) FROM public.mkt_staff_permissions p WHERE p.user_id = auth.uid()
    ), '{}'::text[]),
    'restricted', public.mkt_has_restriction('user', auth.uid(), ARRAY['suspend_account','permanent_ban'])
  )
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.mkt_my_platform_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_my_platform_role() TO authenticated, service_role;

-- 2b. Platform-scope audit rows (no tenant) ------------------------------------
ALTER TABLE public.audit_log ALTER COLUMN tenant_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_log_tenant_autofill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'tenant_id_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;

  -- Marketplace moderation is a platform-level duty: review staff and platform
  -- admins may have no workspace of their own, so attribute the entry to the
  -- workspace of the case they acted on.
  IF NEW.tenant_id IS NULL AND NEW.entity_type LIKE 'mkt_%' AND NEW.entity_id IS NOT NULL THEN
    NEW.tenant_id := COALESCE(
      (SELECT r.tenant_id FROM public.mkt_reports r WHERE r.id = NEW.entity_id),
      (SELECT l.tenant_id FROM public.mkt_listings l WHERE l.id = NEW.entity_id),
      (SELECT a.tenant_id FROM public.mkt_reports a
        JOIN public.mkt_appeals ap ON ap.report_id = a.id WHERE ap.id = NEW.entity_id),
      (SELECT rr.tenant_id FROM public.mkt_reports rr
        JOIN public.mkt_account_restrictions ar ON ar.report_id = rr.id WHERE ar.id = NEW.entity_id)
    );
  END IF;

  -- Platform-level duties (roles, staff permissions, settings, account actions)
  -- belong to no workspace: keep tenant_id NULL and rely on the restrictive
  -- policy below to hide them from every client read.
  IF NEW.tenant_id IS NULL AND NEW.entity_type IN (
    'mkt_platform_role', 'mkt_staff_permission', 'mkt_platform_setting',
    'mkt_admin_note', 'mkt_user', 'mkt_business', 'mkt_admin_session'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_required';
  END IF;
  RETURN NEW;
END
$fn$;

DROP POLICY IF EXISTS audit_log_platform_rows_hidden ON public.audit_log;
CREATE POLICY audit_log_platform_rows_hidden ON public.audit_log
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL);

-- 3. One-time, idempotent assignment by e-mail -> auth.users.id ------------------
DO $$
DECLARE target uuid; prev text;
BEGIN
  SELECT id INTO target FROM auth.users
  WHERE lower(btrim(email)) = 'o11339911@gmail.com' AND email_confirmed_at IS NOT NULL
  LIMIT 1;

  IF target IS NULL THEN
    RAISE NOTICE 'System owner e-mail not found or unconfirmed; no role assigned.';
    RETURN;
  END IF;

  SELECT platform_role INTO prev FROM public.mkt_platform_admins WHERE user_id = target;

  INSERT INTO public.mkt_platform_admins (user_id, platform_role, granted_reason)
  VALUES (target, 'system_owner', 'Initial system owner provisioning')
  ON CONFLICT (user_id) DO UPDATE
    SET platform_role = 'system_owner',
        granted_reason = 'Initial system owner provisioning',
        updated_at = now();

  IF prev IS DISTINCT FROM 'system_owner' THEN
    INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, old_value, new_value, reason)
    VALUES (target, 'mkt_platform_role', target, 'grant',
            jsonb_build_object('platform_role', prev),
            jsonb_build_object('platform_role', 'system_owner'),
            'Initial system owner provisioning (migration)');
  END IF;
END $$;

-- 4. Internal admin notes -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','business')),
  subject_id uuid NOT NULL,
  body text NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_admin_notes TO authenticated;
GRANT ALL ON public.mkt_admin_notes TO service_role;
ALTER TABLE public.mkt_admin_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read admin notes" ON public.mkt_admin_notes;
CREATE POLICY "staff read admin notes" ON public.mkt_admin_notes
  FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_staff_has('reports.add_internal_note'));
CREATE INDEX IF NOT EXISTS mkt_admin_notes_subject_idx
  ON public.mkt_admin_notes (subject_type, subject_id, created_at DESC);

-- 5. Platform settings ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_platform_settings (
  key text PRIMARY KEY,
  section text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_ar text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_platform_settings TO authenticated;
GRANT ALL ON public.mkt_platform_settings TO service_role;
ALTER TABLE public.mkt_platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read platform settings" ON public.mkt_platform_settings;
CREATE POLICY "staff read platform settings" ON public.mkt_platform_settings
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

INSERT INTO public.mkt_platform_settings (key, section, value, description_ar) VALUES
  ('market.enabled', 'market', '{"enabled": true}', 'تشغيل السوق العام'),
  ('market.maintenance', 'maintenance', '{"enabled": false, "message_ar": ""}', 'وضع الصيانة'),
  ('listings.default_duration_days', 'listings', '{"days": 30}', 'مدة الإعلان الافتراضية'),
  ('listings.max_images', 'listings', '{"max": 20}', 'حد صور الإعلان'),
  ('listings.require_review', 'publishing', '{"enabled": true}', 'مراجعة الإعلانات قبل النشر'),
  ('verification.require_documents', 'verification', '{"enabled": true}', 'إلزام مستندات التوثيق'),
  ('notifications.digest', 'notifications', '{"mode": "grouped"}', 'تجميع التنبيهات الإدارية'),
  ('security.admin_session_minutes', 'security', '{"minutes": 720}', 'مدة جلسة الإدارة'),
  ('security.mfa_required', 'security', '{"enabled": false, "implemented": false}', 'التحقق بخطوتين (غير منفَّذ بعد)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mkt_admin_set_setting(_key text, _value jsonb, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE prev jsonb;
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT value INTO prev FROM public.mkt_platform_settings WHERE key = _key;
  IF prev IS NULL THEN RAISE EXCEPTION 'Unknown setting'; END IF;
  UPDATE public.mkt_platform_settings
     SET value = _value, updated_by = auth.uid(), updated_at = now()
   WHERE key = _key;
  PERFORM public.log_audit('mkt_platform_setting', 'update', NULL,
    jsonb_build_object('key', _key, 'value', prev),
    jsonb_build_object('key', _key, 'value', _value), _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_set_setting(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_setting(text, jsonb, text) TO authenticated, service_role;

-- 6. Dashboard stats + action queue --------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.mkt_user_profiles),
    'businesses', (SELECT count(*) FROM public.mkt_business_profiles),
    'listings_published', (SELECT count(*) FROM public.mkt_listings WHERE status = 'published'),
    'listings_pending', (SELECT count(*) FROM public.mkt_listings WHERE status IN ('pending_review','in_review')),
    'reports_new', (SELECT count(*) FROM public.mkt_reports WHERE status IN ('new','open')),
    'verifications_pending', (SELECT count(*) FROM public.mkt_verification_requests WHERE status = 'pending'),
    'restricted_accounts', (SELECT count(DISTINCT subject_id) FROM public.mkt_account_restrictions
                             WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
    'activity_suggestions', (SELECT count(*) FROM public.mkt_activity_suggestions WHERE status = 'pending')
  );
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_overview() TO authenticated, service_role;

-- 7. Users directory (safe fields only) ----------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_users(
  _search text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  user_id uuid, display_name text, username text, email text, phone text,
  created_at timestamptz, last_seen_at timestamptz, verification_status text,
  listings_count bigint, businesses_count bigint, restriction text, restriction_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('accounts.restrict')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT u.id,
         COALESCE(NULLIF(btrim(up.display_name), ''), NULLIF(btrim(pr.full_name), ''), ''),
         up.username,
         u.email::text,
         COALESCE(u.phone::text, pr.phone),
         u.created_at,
         u.last_sign_in_at,
         COALESCE(up.verification_status, 'unverified'),
         (SELECT count(*) FROM public.mkt_listings l WHERE l.owner_user_id = u.id),
         (SELECT count(*) FROM public.tenant_memberships m WHERE m.user_id = u.id AND m.status = 'active'),
         r.restriction,
         r.id
    FROM auth.users u
    LEFT JOIN public.mkt_user_profiles up ON up.user_id = u.id
    LEFT JOIN public.profiles pr ON pr.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT ar.id, ar.restriction FROM public.mkt_account_restrictions ar
      WHERE ar.subject_type = 'user' AND ar.subject_id = u.id AND ar.lifted_at IS NULL
        AND (ar.expires_at IS NULL OR ar.expires_at > now())
      ORDER BY ar.created_at DESC LIMIT 1
    ) r ON true
   WHERE _search IS NULL OR btrim(_search) = ''
      OR u.email ILIKE '%' || btrim(_search) || '%'
      OR COALESCE(u.phone::text,'') ILIKE '%' || btrim(_search) || '%'
      OR COALESCE(up.username,'') ILIKE '%' || btrim(_search) || '%'
      OR COALESCE(up.display_name,'') ILIKE '%' || btrim(_search) || '%'
      OR COALESCE(pr.full_name,'') ILIKE '%' || btrim(_search) || '%'
      OR u.id::text = btrim(_search)
   ORDER BY u.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(_offset, 0), 0);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_users(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_users(text, integer, integer) TO authenticated, service_role;

-- 8. Businesses directory ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_businesses(
  _search text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  tenant_id uuid, name text, slug text, country text, city text,
  main_activity text, sub_activities text[], verification_status text,
  listings_count bigint, status text, created_at timestamptz,
  officer_name text, restriction text, restriction_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('verifications.review')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT t.id,
         COALESCE(NULLIF(btrim(bp.display_name_ar), ''), t.name_ar),
         bp.slug,
         c.name_ar,
         COALESCE(ci.name_ar, bp.city),
         bp.main_activity,
         bp.sub_activities,
         COALESCE(bp.verification_status, 'unverified'),
         (SELECT count(*) FROM public.mkt_listings l WHERE l.tenant_id = t.id),
         COALESCE(t.status, 'active'),
         t.created_at,
         (SELECT COALESCE(NULLIF(btrim(p2.full_name), ''), '')
            FROM public.tenant_memberships m2
            JOIN public.profiles p2 ON p2.user_id = m2.user_id
           WHERE m2.tenant_id = t.id AND m2.role = 'owner' AND m2.status = 'active'
           ORDER BY m2.created_at LIMIT 1),
         r.restriction,
         r.id
    FROM public.tenants t
    LEFT JOIN public.mkt_business_profiles bp ON bp.tenant_id = t.id
    LEFT JOIN public.mkt_countries c ON c.id = bp.country_id
    LEFT JOIN public.mkt_cities ci ON ci.id = bp.city_id
    LEFT JOIN LATERAL (
      SELECT ar.id, ar.restriction FROM public.mkt_account_restrictions ar
      WHERE ar.subject_type = 'business' AND ar.subject_id = t.id AND ar.lifted_at IS NULL
        AND (ar.expires_at IS NULL OR ar.expires_at > now())
      ORDER BY ar.created_at DESC LIMIT 1
    ) r ON true
   WHERE t.deleted_at IS NULL AND t.personal_user_id IS NULL
     AND (_search IS NULL OR btrim(_search) = ''
       OR t.name_ar ILIKE '%' || btrim(_search) || '%'
       OR COALESCE(bp.display_name_ar,'') ILIKE '%' || btrim(_search) || '%'
       OR COALESCE(bp.slug,'') ILIKE '%' || btrim(_search) || '%'
       OR t.id::text = btrim(_search))
   ORDER BY t.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(_offset, 0), 0);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_businesses(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_businesses(text, integer, integer) TO authenticated, service_role;

-- 9. Subject actions (users + businesses) --------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_subject_action(
  _subject_type text, _subject_id uuid, _action text, _reason text, _days integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE rid uuid; restriction text;
BEGIN
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _subject_type NOT IN ('user','business') THEN RAISE EXCEPTION 'Invalid subject'; END IF;

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
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_subject_action(text, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_subject_action(text, uuid, text, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_add_note(_subject_type text, _subject_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('reports.add_internal_note')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_body,'')) = '' THEN RAISE EXCEPTION 'A note is required'; END IF;
  INSERT INTO public.mkt_admin_notes (subject_type, subject_id, body, author_id)
  VALUES (_subject_type, _subject_id, btrim(_body), auth.uid())
  RETURNING id INTO new_id;
  PERFORM public.log_audit('mkt_admin_note', 'create', new_id, NULL,
    jsonb_build_object('subject_type', _subject_type, 'subject_id', _subject_id), NULL);
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_add_note(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_add_note(text, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_notify_user(_user_id uuid, _title text, _body text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_title,'')) = '' THEN RAISE EXCEPTION 'A title is required'; END IF;
  PERFORM public.mkt_notify(_user_id, NULL, 'admin_message', btrim(_title), NULLIF(btrim(COALESCE(_body,'')), ''));
  PERFORM public.log_audit('mkt_user', 'notify', _user_id, NULL, jsonb_build_object('title', btrim(_title)), NULL);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_notify_user(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_notify_user(uuid, text, text) TO authenticated, service_role;

-- 10. Roles + staff permissions administration --------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_roles()
RETURNS TABLE(user_id uuid, email text, display_name text, platform_role text,
              staff_perms text[], granted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text,
         COALESCE(NULLIF(btrim(up.display_name), ''), NULLIF(btrim(pr.full_name), ''), ''),
         a.platform_role,
         COALESCE((SELECT array_agg(DISTINCT sp.perm) FROM public.mkt_staff_permissions sp WHERE sp.user_id = u.id), '{}'::text[]),
         COALESCE(a.created_at, (SELECT min(sp.created_at) FROM public.mkt_staff_permissions sp WHERE sp.user_id = u.id))
    FROM auth.users u
    LEFT JOIN public.mkt_platform_admins a ON a.user_id = u.id
    LEFT JOIN public.mkt_user_profiles up ON up.user_id = u.id
    LEFT JOIN public.profiles pr ON pr.user_id = u.id
   WHERE a.user_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.mkt_staff_permissions sp WHERE sp.user_id = u.id)
   ORDER BY a.platform_role NULLS LAST, u.created_at;
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_roles() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_set_platform_role(_user_id uuid, _role text, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE prev text; owners integer;
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _role IS NOT NULL AND _role NOT IN ('system_owner','platform_admin') THEN
    RAISE EXCEPTION 'Invalid role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Target user must exist with a confirmed e-mail'; END IF;

  SELECT platform_role INTO prev FROM public.mkt_platform_admins WHERE user_id = _user_id;
  SELECT count(*) INTO owners FROM public.mkt_platform_admins WHERE platform_role = 'system_owner';

  IF prev = 'system_owner' AND (_role IS DISTINCT FROM 'system_owner') AND owners <= 1 THEN
    RAISE EXCEPTION 'The last system owner cannot be removed';
  END IF;

  IF _role IS NULL THEN
    DELETE FROM public.mkt_platform_admins WHERE user_id = _user_id;
  ELSE
    INSERT INTO public.mkt_platform_admins (user_id, platform_role, created_by, granted_reason)
    VALUES (_user_id, _role, auth.uid(), btrim(_reason))
    ON CONFLICT (user_id) DO UPDATE
      SET platform_role = EXCLUDED.platform_role,
          granted_reason = EXCLUDED.granted_reason,
          updated_at = now();
  END IF;

  PERFORM public.log_audit('mkt_platform_role', CASE WHEN _role IS NULL THEN 'revoke' ELSE 'grant' END,
    _user_id, jsonb_build_object('platform_role', prev),
    jsonb_build_object('platform_role', _role), btrim(_reason));
  PERFORM public.mkt_notify(_user_id, NULL, 'admin_role_changed', 'تم تحديث صلاحياتك الإدارية', NULL);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_platform_role(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_set_staff_perm(
  _user_id uuid, _perm text, _granted boolean, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF btrim(COALESCE(_perm,'')) = '' THEN RAISE EXCEPTION 'A permission is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_platform_admins a
              WHERE a.user_id = _user_id AND a.platform_role = 'system_owner')
     AND _granted = false THEN
    RAISE EXCEPTION 'System owner permissions cannot be reduced here';
  END IF;

  IF _granted THEN
    INSERT INTO public.mkt_staff_permissions (user_id, perm, created_by)
    VALUES (_user_id, btrim(_perm), auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.mkt_staff_permissions WHERE user_id = _user_id AND perm = btrim(_perm);
  END IF;

  PERFORM public.log_audit('mkt_staff_permission', CASE WHEN _granted THEN 'grant' ELSE 'revoke' END,
    _user_id, NULL, jsonb_build_object('perm', btrim(_perm)), btrim(_reason));
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_staff_perm(uuid, text, boolean, text) TO authenticated, service_role;

-- 11. Audit log reader (IP/device columns do not exist; nothing sensitive leaks)
CREATE OR REPLACE FUNCTION public.mkt_admin_audit_log(
  _search text DEFAULT NULL, _entity text DEFAULT NULL,
  _limit integer DEFAULT 100, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, actor_id uuid, actor_name text, entity_type text, entity_id uuid,
              action text, old_value jsonb, new_value jsonb, reason text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('reports.audit_view')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT l.id, l.actor_id,
         COALESCE(NULLIF(btrim(pr.full_name), ''), NULLIF(btrim(up.display_name), ''), ''),
         l.entity_type, l.entity_id, l.action,
         CASE WHEN public.mkt_is_platform_admin() THEN l.old_value ELSE NULL END,
         CASE WHEN public.mkt_is_platform_admin() THEN l.new_value ELSE NULL END,
         l.reason, l.created_at
    FROM public.audit_log l
    LEFT JOIN public.profiles pr ON pr.user_id = l.actor_id
    LEFT JOIN public.mkt_user_profiles up ON up.user_id = l.actor_id
   WHERE (_entity IS NULL OR btrim(_entity) = '' OR l.entity_type = btrim(_entity))
     AND (_search IS NULL OR btrim(_search) = ''
          OR l.action ILIKE '%' || btrim(_search) || '%'
          OR l.entity_type ILIKE '%' || btrim(_search) || '%'
          OR COALESCE(l.reason,'') ILIKE '%' || btrim(_search) || '%'
          OR l.entity_id::text = btrim(_search)
          OR l.actor_id::text = btrim(_search))
   ORDER BY l.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 300) OFFSET GREATEST(COALESCE(_offset, 0), 0);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_audit_log(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_audit_log(text, text, integer, integer) TO authenticated, service_role;