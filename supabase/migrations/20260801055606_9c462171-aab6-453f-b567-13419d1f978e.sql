-- 1) Personal account marker on tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS personal_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_personal_user_unique
  ON public.tenants (personal_user_id) WHERE personal_user_id IS NOT NULL;

-- 2) Per-membership last seen, used only for ordering accounts
ALTER TABLE public.tenant_memberships ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 3) Optional preference: always force the account picker
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS always_select_account boolean NOT NULL DEFAULT false;

-- 4) Ambiguous supervisor <-> auth links go to admin review, never guessed
CREATE TABLE IF NOT EXISTS public.account_link_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES public.supervisors(id) ON DELETE CASCADE,
  candidate_count int NOT NULL DEFAULT 0,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.account_link_reviews TO authenticated;
GRANT ALL ON public.account_link_reviews TO service_role;
ALTER TABLE public.account_link_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_link_reviews_admin ON public.account_link_reviews;
CREATE POLICY account_link_reviews_admin ON public.account_link_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'))
  WITH CHECK (public.has_role(auth.uid(), 'accountant'));

DROP POLICY IF EXISTS account_link_reviews_tenant_isolation ON public.account_link_reviews;
CREATE POLICY account_link_reviews_tenant_isolation ON public.account_link_reviews
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- 5) One personal (individual) account per user, created on demand
CREATE OR REPLACE FUNCTION public.ensure_personal_tenant()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _tid uuid; _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT id INTO _tid FROM public.tenants
   WHERE personal_user_id = _uid AND deleted_at IS NULL;
  IF _tid IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at, membership_start, created_by)
    VALUES (_tid, _uid, 'owner', 'active', now(), current_date, _uid)
    ON CONFLICT DO NOTHING;
    RETURN _tid;
  END IF;

  SELECT nullif(btrim(coalesce(full_name, '')), '') INTO _name
    FROM public.profiles WHERE user_id = _uid;

  INSERT INTO public.tenants (name_ar, name_en, tenant_type, status, is_default, is_test,
                              created_by, personal_user_id, onboarding_completed_at)
  VALUES (coalesce(_name, 'حسابي الشخصي'), coalesce(_name, 'My personal account'),
          'individual', 'active', false, false, _uid, _uid, now())
  RETURNING id INTO _tid;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at, membership_start, created_by)
  VALUES (_tid, _uid, 'owner', 'active', now(), current_date, _uid);

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant', _tid, 'create',
          jsonb_build_object('tenant_type', 'individual', 'personal', true), _tid);

  RETURN _tid;
END $$;
REVOKE ALL ON FUNCTION public.ensure_personal_tenant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_personal_tenant() TO authenticated;

-- 6) Accounts the user may enter: active membership, live tenant, not expired.
CREATE OR REPLACE FUNCTION public.my_accounts()
RETURNS TABLE(
  tenant_id uuid, name_ar text, name_en text, tenant_type text,
  role text, membership_status text, last_seen_at timestamptz,
  is_personal boolean, is_current boolean, is_owner boolean, masked_ref text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name_ar, t.name_en, t.tenant_type, m.role::text, m.status::text, m.last_seen_at,
         (t.personal_user_id = auth.uid()) AS is_personal,
         t.id = public.current_tenant_id() AS is_current,
         (m.role::text = 'owner') AS is_owner,
         CASE
           WHEN coalesce(t.commercial_registration_number, '') <> ''
             THEN '******' || right(t.commercial_registration_number, 4)
           ELSE NULL
         END AS masked_ref
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
   WHERE m.user_id = auth.uid()
     AND m.status = 'active'
     AND (m.membership_end IS NULL OR m.membership_end >= current_date)
     AND (m.membership_start IS NULL OR m.membership_start <= current_date)
     AND t.deleted_at IS NULL
     AND t.status = 'active'
   ORDER BY (t.personal_user_id = auth.uid()) DESC, m.last_seen_at DESC NULLS LAST, t.name_ar;
$$;
REVOKE ALL ON FUNCTION public.my_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_accounts() TO authenticated;

-- 7) Enter an account: identity + active membership verified server-side.
CREATE OR REPLACE FUNCTION public.activate_account(_tenant_id uuid)
RETURNS TABLE(tenant_id uuid, tenant_type text, role text, is_personal boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _role text; _type text; _personal boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT m.role::text, t.tenant_type, (t.personal_user_id = _uid)
    INTO _role, _type, _personal
    FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id
   WHERE m.tenant_id = _tenant_id
     AND m.user_id = _uid
     AND m.status = 'active'
     AND (m.membership_end IS NULL OR m.membership_end >= current_date)
     AND (m.membership_start IS NULL OR m.membership_start <= current_date)
     AND t.deleted_at IS NULL
     AND t.status = 'active';

  IF _role IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_MEMBERSHIP'; END IF;

  UPDATE public.profiles
     SET active_tenant_id = _tenant_id, last_tenant_id = _tenant_id
   WHERE user_id = _uid;

  UPDATE public.tenant_memberships
     SET last_seen_at = now()
   WHERE tenant_id = _tenant_id AND user_id = _uid;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, tenant_id)
  VALUES (_uid, 'tenant', _tenant_id, 'enter_account',
          jsonb_build_object('tenant_type', _type, 'role', _role), _tenant_id);

  RETURN QUERY SELECT _tenant_id, _type, _role, coalesce(_personal, false);
END $$;
REVOKE ALL ON FUNCTION public.activate_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_account(uuid) TO authenticated;

-- 8) Backfill: personal account for every existing user, memberships untouched.
DO $$
DECLARE r record; _tid uuid;
BEGIN
  FOR r IN SELECT user_id, nullif(btrim(coalesce(full_name, '')), '') AS full_name
             FROM public.profiles p
            WHERE NOT EXISTS (
              SELECT 1 FROM public.tenants t
               WHERE t.personal_user_id = p.user_id AND t.deleted_at IS NULL)
  LOOP
    INSERT INTO public.tenants (name_ar, name_en, tenant_type, status, is_default, is_test,
                                created_by, personal_user_id, onboarding_completed_at)
    VALUES (coalesce(r.full_name, 'حسابي الشخصي'), coalesce(r.full_name, 'My personal account'),
            'individual', 'active', false, coalesce(r.full_name, '') LIKE 'TEST-%',
            r.user_id, r.user_id, now())
    RETURNING id INTO _tid;

    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at, membership_start, created_by)
    VALUES (_tid, r.user_id, 'owner', 'active', now(), current_date, r.user_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 9) Supervisor profile linking: only confirmed email matches (never by name).
UPDATE public.profiles p
   SET supervisor_id = s.id
  FROM public.supervisors s
 WHERE p.supervisor_id IS NULL
   AND s.deleted_at IS NULL
   AND p.email IS NOT NULL
   AND s.email IS NOT NULL
   AND lower(btrim(p.email)) = lower(btrim(s.email))
   AND (SELECT count(*) FROM public.profiles p2
         WHERE p2.email IS NOT NULL
           AND lower(btrim(p2.email)) = lower(btrim(s.email))) = 1
   AND NOT EXISTS (SELECT 1 FROM public.profiles p3 WHERE p3.supervisor_id = s.id);

INSERT INTO public.account_link_reviews (tenant_id, supervisor_id, candidate_count, reason)
SELECT s.tenant_id, s.id,
       (SELECT count(*) FROM public.profiles p2
         WHERE p2.email IS NOT NULL AND s.email IS NOT NULL
           AND lower(btrim(p2.email)) = lower(btrim(s.email))),
       'unconfirmed_link'
  FROM public.supervisors s
 WHERE s.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.supervisor_id = s.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.account_link_reviews r
      WHERE r.supervisor_id = s.id AND r.status = 'pending');