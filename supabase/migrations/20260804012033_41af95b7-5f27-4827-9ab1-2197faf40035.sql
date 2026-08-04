ALTER TABLE public.mkt_admin_assignments DROP CONSTRAINT IF EXISTS mkt_admin_assignments_kind_check;

CREATE OR REPLACE FUNCTION public.mkt_admin_assignments_kind_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mkt_workforce_kinds k WHERE k.kind = NEW.kind) THEN
    RAISE EXCEPTION 'invalid_kind:%', NEW.kind;
  END IF;
  IF NEW.department IS NULL THEN
    SELECT k.department_code INTO NEW.department FROM public.mkt_workforce_kinds k WHERE k.kind = NEW.kind;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mkt_admin_assignments_kind_guard ON public.mkt_admin_assignments;
CREATE TRIGGER trg_mkt_admin_assignments_kind_guard
  BEFORE INSERT OR UPDATE OF kind ON public.mkt_admin_assignments
  FOR EACH ROW EXECUTE FUNCTION public.mkt_admin_assignments_kind_guard();

CREATE OR REPLACE FUNCTION public.mkt_queue_perm(_kind text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _kind
    WHEN 'listing_review'       THEN 'listings.review'
    WHEN 'report'               THEN 'reports.manage'
    WHEN 'verification'         THEN 'verifications.manage'
    WHEN 'activity_suggestion'  THEN 'listings.review'
    WHEN 'account_review'       THEN 'users.manage'
    WHEN 'business_review'      THEN 'businesses.manage'
    WHEN 'security_review'      THEN 'restrictions.manage'
    WHEN 'admin_request'        THEN 'restrictions.manage'
    ELSE 'restrictions.manage' END
$$;