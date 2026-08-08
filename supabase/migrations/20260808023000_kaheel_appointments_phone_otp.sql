-- KAHEEL Appointments passwordless customer access.
-- This migration changes appointment-owned objects only. It never writes to
-- KAHEEL Market tables. The sole shared-account check is a read-only lookup in
-- public.profiles so provider registration remains a Market-controlled flow.

CREATE UNIQUE INDEX IF NOT EXISTS appt_profiles_phone_unique
  ON public.appt_profiles (phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- Appointment customers cannot write or replace their verified identity
-- directly. The verified-phone RPC below is the only write path.
DROP POLICY IF EXISTS appt_profiles_own_insert ON public.appt_profiles;
DROP POLICY IF EXISTS appt_profiles_own_update ON public.appt_profiles;
REVOKE INSERT, UPDATE ON public.appt_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.appt_has_market_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles shared_profile
      WHERE shared_profile.user_id = auth.uid()
        AND shared_profile.is_active
    )
$$;

CREATE OR REPLACE FUNCTION public.appt_verified_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(p)
  FROM public.appt_profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = auth.uid()
    AND u.phone_confirmed_at IS NOT NULL
    AND u.phone = p.phone_e164
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.appt_complete_phone_profile(_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_phone text;
  v_phone_confirmed_at timestamptz;
  v_profile public.appt_profiles;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  v_name := regexp_replace(btrim(coalesce(_display_name, '')), '\s+', ' ', 'g');
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'profile_name_required';
  END IF;

  SELECT u.phone, u.phone_confirmed_at
    INTO v_phone, v_phone_confirmed_at
  FROM auth.users u
  WHERE u.id = v_user;

  IF nullif(btrim(coalesce(v_phone, '')), '') IS NULL
     OR v_phone_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'phone_not_verified';
  END IF;
  IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  BEGIN
    INSERT INTO public.appt_profiles AS current_profile (
      user_id,
      display_name,
      phone_e164
    ) VALUES (
      v_user,
      v_name,
      v_phone
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      phone_e164 = EXCLUDED.phone_e164,
      updated_at = now()
    RETURNING * INTO v_profile;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'phone_already_linked';
  END;

  INSERT INTO public.appt_audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    new_value
  ) VALUES (
    v_user,
    'appointment_profile',
    v_user,
    'verify_phone',
    jsonb_build_object('phone_verified', true)
  );

  RETURN jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'phone_e164', v_profile.phone_e164,
    'locale', v_profile.locale,
    'timezone', v_profile.timezone
  );
END;
$$;

-- The existing booking RPC signatures are preserved. This trigger discards any
-- client-supplied name or phone and snapshots the verified appointment profile.
CREATE OR REPLACE FUNCTION public.appt_enforce_verified_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.appt_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.appt_profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = auth.uid()
    AND u.phone_confirmed_at IS NOT NULL
    AND u.phone = p.phone_e164
    AND nullif(btrim(coalesce(p.display_name, '')), '') IS NOT NULL;

  IF v_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'appointment_profile_required';
  END IF;

  NEW.customer_user_id := auth.uid();
  NEW.customer_name := v_profile.display_name;
  NEW.customer_phone := v_profile.phone_e164;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appt_appointments_verified_customer
  ON public.appt_appointments;
CREATE TRIGGER appt_appointments_verified_customer
  BEFORE INSERT ON public.appt_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appt_enforce_verified_customer();

DROP TRIGGER IF EXISTS appt_queue_verified_customer
  ON public.appt_queue_entries;
CREATE TRIGGER appt_queue_verified_customer
  BEFORE INSERT ON public.appt_queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.appt_enforce_verified_customer();

-- A phone-only appointment customer must never become a provider by calling the
-- existing provider RPC. Provider eligibility remains controlled by the shared
-- KAHEEL account record; no Market business table is read or written.
CREATE OR REPLACE FUNCTION public.appt_enforce_provider_market_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.owner_user_id = auth.uid()
     AND NOT public.appt_has_market_account() THEN
    RAISE EXCEPTION 'provider_registration_required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appt_provider_market_account_guard
  ON public.appt_providers;
CREATE TRIGGER appt_provider_market_account_guard
  BEFORE INSERT ON public.appt_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.appt_enforce_provider_market_account();

REVOKE ALL ON FUNCTION public.appt_has_market_account()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_verified_profile()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_complete_phone_profile(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_enforce_verified_customer()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.appt_enforce_provider_market_account()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.appt_has_market_account()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_verified_profile()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_complete_phone_profile(text)
  TO authenticated, service_role;
