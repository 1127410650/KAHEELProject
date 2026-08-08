-- Cover composite service/provider foreign keys used by booking and queue lookups.
CREATE INDEX appt_appointments_provider_service_idx
  ON public.appt_appointments (provider_id, service_id);
CREATE INDEX appt_queue_provider_service_idx
  ON public.appt_queue_entries (provider_id, service_id);

-- Keep one permissive SELECT policy per role/action while preserving the same access.
DROP POLICY IF EXISTS appt_providers_public_read ON public.appt_providers;
DROP POLICY IF EXISTS appt_providers_manager_read ON public.appt_providers;
CREATE POLICY appt_providers_anon_read ON public.appt_providers
  FOR SELECT TO anon
  USING (status = 'published' AND accepts_bookings AND deleted_at IS NULL);
CREATE POLICY appt_providers_authenticated_read ON public.appt_providers
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND accepts_bookings AND deleted_at IS NULL)
    OR public.appt_can_manage_provider(id)
  );

DROP POLICY IF EXISTS appt_provider_settings_public_read ON public.appt_provider_settings;
DROP POLICY IF EXISTS appt_provider_settings_manager_all ON public.appt_provider_settings;
CREATE POLICY appt_provider_settings_anon_read ON public.appt_provider_settings
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.appt_providers p
    WHERE p.id = provider_id
      AND p.status = 'published'
      AND p.accepts_bookings
      AND p.deleted_at IS NULL
  ));
CREATE POLICY appt_provider_settings_authenticated_read ON public.appt_provider_settings
  FOR SELECT TO authenticated
  USING (
    public.appt_can_manage_provider(provider_id)
    OR EXISTS (
      SELECT 1 FROM public.appt_providers p
      WHERE p.id = provider_id
        AND p.status = 'published'
        AND p.accepts_bookings
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS appt_services_public_read ON public.appt_services;
DROP POLICY IF EXISTS appt_services_manager_all ON public.appt_services;
CREATE POLICY appt_services_anon_read ON public.appt_services
  FOR SELECT TO anon
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
CREATE POLICY appt_services_authenticated_read ON public.appt_services
  FOR SELECT TO authenticated
  USING (
    public.appt_can_manage_provider(provider_id)
    OR (
      is_active
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.appt_providers p
        WHERE p.id = provider_id
          AND p.status = 'published'
          AND p.accepts_bookings
          AND p.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS appt_availability_public_read ON public.appt_availability;
DROP POLICY IF EXISTS appt_availability_manager_all ON public.appt_availability;
CREATE POLICY appt_availability_anon_read ON public.appt_availability
  FOR SELECT TO anon
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
CREATE POLICY appt_availability_authenticated_read ON public.appt_availability
  FOR SELECT TO authenticated
  USING (
    public.appt_can_manage_provider(provider_id)
    OR (
      is_active
      AND EXISTS (
        SELECT 1 FROM public.appt_providers p
        WHERE p.id = provider_id
          AND p.status = 'published'
          AND p.accepts_bookings
          AND p.deleted_at IS NULL
      )
    )
  );
