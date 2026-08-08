-- All business mutations must pass through audited appt_* RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.appt_providers FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appt_provider_members FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appt_provider_settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appt_services FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appt_availability FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appt_time_off FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appt_market_links FROM authenticated;

CREATE OR REPLACE FUNCTION public.appt_validate_provider_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'published' THEN
    IF nullif(btrim(NEW.name_ar), '') IS NULL THEN
      RAISE EXCEPTION 'provider_name_required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.appt_services s
      WHERE s.provider_id = NEW.id
        AND s.is_active
        AND s.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'provider_service_required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.appt_availability a
      WHERE a.provider_id = NEW.id AND a.is_active
    ) THEN
      RAISE EXCEPTION 'provider_schedule_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.appt_validate_provider_publish() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER appt_providers_validate_publish
  BEFORE UPDATE OF status ON public.appt_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.appt_validate_provider_publish();
