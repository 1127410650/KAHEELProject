CREATE OR REPLACE FUNCTION public.audit_log_tenant_autofill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_required';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.audit_log_tenant_autofill() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_log_tenant_autofill ON public.audit_log;
CREATE TRIGGER audit_log_tenant_autofill
BEFORE INSERT OR UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_tenant_autofill();