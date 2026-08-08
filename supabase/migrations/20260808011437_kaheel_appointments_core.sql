-- KAHEEL Appointments standalone core
--
-- Isolation guarantees:
-- 1. Every object is prefixed with appt_.
-- 2. No table, view, function, trigger, policy, or foreign key references mkt_*.
-- 3. The only shared identity boundary is auth.uid() from the canonical Supabase project.
-- 4. Optional Market linkage stores opaque identifiers only and can be removed during a future split.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.appt_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.appt_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.appt_profiles (
  user_id uuid PRIMARY KEY,
  display_name text,
  phone_e164 text,
  avatar_path text,
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appt_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  slug text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  bio_ar text,
  bio_en text,
  logo_path text,
  cover_path text,
  city text,
  district text,
  address_text text,
  latitude double precision,
  longitude double precision,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'paused', 'suspended')),
  accepts_bookings boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX appt_providers_slug_unique
  ON public.appt_providers (lower(slug)) WHERE deleted_at IS NULL;
CREATE INDEX appt_providers_owner_idx
  ON public.appt_providers (owner_user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX appt_providers_directory_idx
  ON public.appt_providers (status, city, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.appt_provider_members (
  provider_id uuid NOT NULL REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, user_id)
);
CREATE INDEX appt_provider_members_user_idx
  ON public.appt_provider_members (user_id, is_active);

CREATE TABLE public.appt_provider_settings (
  provider_id uuid PRIMARY KEY REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  confirmation_mode text NOT NULL DEFAULT 'manual'
    CHECK (confirmation_mode IN ('instant', 'manual')),
  min_notice_minutes integer NOT NULL DEFAULT 60
    CHECK (min_notice_minutes BETWEEN 0 AND 43200),
  max_advance_days integer NOT NULL DEFAULT 60
    CHECK (max_advance_days BETWEEN 1 AND 365),
  cancellation_window_hours integer NOT NULL DEFAULT 6
    CHECK (cancellation_window_hours BETWEEN 0 AND 168),
  queue_enabled boolean NOT NULL DEFAULT true,
  average_service_minutes integer NOT NULL DEFAULT 30
    CHECK (average_service_minutes BETWEEN 5 AND 480),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appt_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  description_en text,
  duration_minutes integer NOT NULL DEFAULT 30
    CHECK (duration_minutes BETWEEN 5 AND 720),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency_code text NOT NULL DEFAULT 'SAR',
  booking_mode text NOT NULL DEFAULT 'scheduled'
    CHECK (booking_mode IN ('scheduled', 'queue', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT appt_services_provider_id_id_unique UNIQUE (provider_id, id)
);
CREATE INDEX appt_services_provider_idx
  ON public.appt_services (provider_id, is_active, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE public.appt_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  service_id uuid,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  slot_interval_minutes integer NOT NULL DEFAULT 30
    CHECK (slot_interval_minutes IN (5, 10, 15, 20, 30, 45, 60, 90, 120)),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_availability_window_ck CHECK (starts_at < ends_at),
  CONSTRAINT appt_availability_unique UNIQUE (
    provider_id, service_id, weekday, starts_at, ends_at
  ),
  CONSTRAINT appt_availability_service_provider_fk
    FOREIGN KEY (provider_id, service_id)
    REFERENCES public.appt_services(provider_id, id) ON DELETE CASCADE
);
CREATE INDEX appt_availability_lookup_idx
  ON public.appt_availability (provider_id, weekday, is_active, starts_at);

CREATE TABLE public.appt_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_time_off_window_ck CHECK (starts_at < ends_at)
);
CREATE INDEX appt_time_off_lookup_idx
  ON public.appt_time_off (provider_id, starts_at, ends_at);

CREATE SEQUENCE public.appt_appointment_number_seq START 1000;

CREATE TABLE public.appt_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_number text NOT NULL UNIQUE,
  provider_id uuid NOT NULL REFERENCES public.appt_providers(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'confirmed', 'checked_in', 'in_service', 'completed',
    'cancelled_by_customer', 'cancelled_by_provider', 'rejected', 'no_show'
  )),
  source text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'mobile', 'queue', 'market_link')),
  customer_notes text,
  provider_notes text,
  idempotency_key text NOT NULL,
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_appointments_window_ck CHECK (starts_at < ends_at),
  CONSTRAINT appt_appointments_service_provider_fk
    FOREIGN KEY (provider_id, service_id)
    REFERENCES public.appt_services(provider_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX appt_appointments_idempotency_idx
  ON public.appt_appointments (customer_user_id, idempotency_key);
CREATE INDEX appt_appointments_customer_idx
  ON public.appt_appointments (customer_user_id, starts_at DESC);
CREATE INDEX appt_appointments_provider_idx
  ON public.appt_appointments (provider_id, status, starts_at);
CREATE INDEX appt_appointments_active_window_idx
  ON public.appt_appointments (provider_id, starts_at, ends_at)
  WHERE status IN ('requested', 'confirmed', 'checked_in', 'in_service');

CREATE TABLE public.appt_appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appt_appointments(id) ON DELETE CASCADE,
  actor_user_id uuid,
  old_status text,
  new_status text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appt_appointment_events_idx
  ON public.appt_appointment_events (appointment_id, created_at);

CREATE TABLE public.appt_queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  queue_date date NOT NULL,
  queue_number integer NOT NULL CHECK (queue_number > 0),
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'called', 'serving', 'done', 'skipped', 'cancelled')),
  notes text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  serving_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_queue_number_unique UNIQUE (provider_id, queue_date, queue_number),
  CONSTRAINT appt_queue_service_provider_fk
    FOREIGN KEY (provider_id, service_id)
    REFERENCES public.appt_services(provider_id, id) ON DELETE RESTRICT
);
CREATE INDEX appt_queue_provider_idx
  ON public.appt_queue_entries (provider_id, queue_date, status, queue_number);
CREATE UNIQUE INDEX appt_queue_customer_active_idx
  ON public.appt_queue_entries (provider_id, queue_date, customer_user_id)
  WHERE status IN ('waiting', 'called', 'serving');

CREATE TABLE public.appt_market_links (
  provider_id uuid PRIMARY KEY REFERENCES public.appt_providers(id) ON DELETE CASCADE,
  market_tenant_id uuid,
  market_storefront_id uuid,
  market_profile_path text,
  market_url text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'pending', 'linked', 'disabled')),
  linked_by_user_id uuid,
  linked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.appt_market_links IS
  'Optional extraction-safe bridge. Identifiers are opaque and intentionally have no foreign keys to Market tables.';

CREATE TABLE public.appt_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id uuid REFERENCES public.appt_providers(id) ON DELETE SET NULL,
  actor_user_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appt_audit_provider_idx
  ON public.appt_audit_log (provider_id, created_at DESC);

CREATE TRIGGER appt_profiles_touch
  BEFORE UPDATE ON public.appt_profiles
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_providers_touch
  BEFORE UPDATE ON public.appt_providers
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_provider_members_touch
  BEFORE UPDATE ON public.appt_provider_members
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_provider_settings_touch
  BEFORE UPDATE ON public.appt_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_services_touch
  BEFORE UPDATE ON public.appt_services
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_availability_touch
  BEFORE UPDATE ON public.appt_availability
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_appointments_touch
  BEFORE UPDATE ON public.appt_appointments
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_queue_entries_touch
  BEFORE UPDATE ON public.appt_queue_entries
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();
CREATE TRIGGER appt_market_links_touch
  BEFORE UPDATE ON public.appt_market_links
  FOR EACH ROW EXECUTE FUNCTION public.appt_touch_updated_at();

CREATE OR REPLACE FUNCTION public.appt_is_provider_owner(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.appt_providers p
    WHERE p.id = _provider_id
      AND p.owner_user_id = auth.uid()
      AND p.deleted_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.appt_can_manage_provider(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.appt_providers p
      WHERE p.id = _provider_id
        AND p.owner_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.appt_provider_members m
      WHERE m.provider_id = _provider_id
        AND m.user_id = auth.uid()
        AND m.is_active
        AND (
          m.role IN ('owner', 'manager')
          OR 'appointments.manage' = ANY(m.permissions)
        )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.appt_can_access_appointment(_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.appt_appointments a
    WHERE a.id = _appointment_id
      AND (
        a.customer_user_id = auth.uid()
        OR public.appt_can_manage_provider(a.provider_id)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.appt_is_provider_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_can_manage_provider(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appt_can_access_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appt_is_provider_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_can_manage_provider(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.appt_can_access_appointment(uuid) TO authenticated, service_role;

ALTER TABLE public.appt_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_provider_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_appointment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_market_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appt_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY appt_profiles_own_select ON public.appt_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY appt_profiles_own_insert ON public.appt_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY appt_profiles_own_update ON public.appt_profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY appt_providers_public_read ON public.appt_providers
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND accepts_bookings AND deleted_at IS NULL);
CREATE POLICY appt_providers_manager_read ON public.appt_providers
  FOR SELECT TO authenticated
  USING (public.appt_can_manage_provider(id));
CREATE POLICY appt_providers_owner_insert ON public.appt_providers
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY appt_providers_manager_update ON public.appt_providers
  FOR UPDATE TO authenticated
  USING (public.appt_can_manage_provider(id))
  WITH CHECK (public.appt_can_manage_provider(id));
CREATE POLICY appt_providers_owner_delete ON public.appt_providers
  FOR DELETE TO authenticated
  USING (public.appt_is_provider_owner(id));

CREATE POLICY appt_provider_members_read ON public.appt_provider_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.appt_can_manage_provider(provider_id)
  );
CREATE POLICY appt_provider_members_owner_insert ON public.appt_provider_members
  FOR INSERT TO authenticated
  WITH CHECK (public.appt_is_provider_owner(provider_id));
CREATE POLICY appt_provider_members_owner_update ON public.appt_provider_members
  FOR UPDATE TO authenticated
  USING (public.appt_is_provider_owner(provider_id))
  WITH CHECK (public.appt_is_provider_owner(provider_id));
CREATE POLICY appt_provider_members_owner_delete ON public.appt_provider_members
  FOR DELETE TO authenticated
  USING (public.appt_is_provider_owner(provider_id));

CREATE POLICY appt_provider_settings_public_read ON public.appt_provider_settings
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appt_providers p
    WHERE p.id = provider_id
      AND p.status = 'published'
      AND p.accepts_bookings
      AND p.deleted_at IS NULL
  ));
CREATE POLICY appt_provider_settings_manager_all ON public.appt_provider_settings
  FOR ALL TO authenticated
  USING (public.appt_can_manage_provider(provider_id))
  WITH CHECK (public.appt_can_manage_provider(provider_id));

CREATE POLICY appt_services_public_read ON public.appt_services
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.appt_providers p
      WHERE p.id = provider_id
        AND p.status = 'published'
        AND p.accepts_bookings
        AND p.deleted_at IS NULL
    )
  );
CREATE POLICY appt_services_manager_all ON public.appt_services
  FOR ALL TO authenticated
  USING (public.appt_can_manage_provider(provider_id))
  WITH CHECK (public.appt_can_manage_provider(provider_id));

CREATE POLICY appt_availability_public_read ON public.appt_availability
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.appt_providers p
      WHERE p.id = provider_id
        AND p.status = 'published'
        AND p.accepts_bookings
        AND p.deleted_at IS NULL
    )
  );
CREATE POLICY appt_availability_manager_all ON public.appt_availability
  FOR ALL TO authenticated
  USING (public.appt_can_manage_provider(provider_id))
  WITH CHECK (public.appt_can_manage_provider(provider_id));

CREATE POLICY appt_time_off_manager_all ON public.appt_time_off
  FOR ALL TO authenticated
  USING (public.appt_can_manage_provider(provider_id))
  WITH CHECK (public.appt_can_manage_provider(provider_id));

CREATE POLICY appt_appointments_party_read ON public.appt_appointments
  FOR SELECT TO authenticated
  USING (
    customer_user_id = (SELECT auth.uid())
    OR public.appt_can_manage_provider(provider_id)
  );

CREATE POLICY appt_appointment_events_party_read ON public.appt_appointment_events
  FOR SELECT TO authenticated
  USING (public.appt_can_access_appointment(appointment_id));

CREATE POLICY appt_queue_entries_party_read ON public.appt_queue_entries
  FOR SELECT TO authenticated
  USING (
    customer_user_id = (SELECT auth.uid())
    OR public.appt_can_manage_provider(provider_id)
  );

CREATE POLICY appt_market_links_manager_all ON public.appt_market_links
  FOR ALL TO authenticated
  USING (public.appt_can_manage_provider(provider_id))
  WITH CHECK (public.appt_can_manage_provider(provider_id));

CREATE POLICY appt_audit_manager_read ON public.appt_audit_log
  FOR SELECT TO authenticated
  USING (provider_id IS NOT NULL AND public.appt_can_manage_provider(provider_id));

REVOKE ALL ON TABLE
  public.appt_profiles,
  public.appt_providers,
  public.appt_provider_members,
  public.appt_provider_settings,
  public.appt_services,
  public.appt_availability,
  public.appt_time_off,
  public.appt_appointments,
  public.appt_appointment_events,
  public.appt_queue_entries,
  public.appt_market_links,
  public.appt_audit_log
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.appt_providers, public.appt_provider_settings,
  public.appt_services, public.appt_availability TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appt_profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.appt_providers TO authenticated;
GRANT UPDATE (
  slug, name_ar, name_en, bio_ar, bio_en, logo_path, cover_path, city, district,
  address_text, latitude, longitude, timezone, status, accepts_bookings
) ON public.appt_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appt_provider_members,
  public.appt_services, public.appt_availability, public.appt_time_off,
  public.appt_market_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appt_provider_settings TO authenticated;
GRANT SELECT ON public.appt_appointments, public.appt_appointment_events,
  public.appt_queue_entries, public.appt_audit_log TO authenticated;
GRANT ALL ON TABLE
  public.appt_profiles,
  public.appt_providers,
  public.appt_provider_members,
  public.appt_provider_settings,
  public.appt_services,
  public.appt_availability,
  public.appt_time_off,
  public.appt_appointments,
  public.appt_appointment_events,
  public.appt_queue_entries,
  public.appt_market_links,
  public.appt_audit_log
TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.appt_appointment_number_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.appt_audit_log_id_seq TO service_role;
