CREATE OR REPLACE FUNCTION public.mkt_listing_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Review decisions belong to platform admins or delegated moderation staff
  -- acting through the audited moderation functions.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('published','rejected','suspended')
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_is_moderation_op()
     AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action())
     AND NOT (NEW.status = 'published' AND public.mkt_is_listing_op() AND OLD.published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Only marketplace administrators can approve, reject or suspend listings';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.mkt_is_platform_admin() THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'The advertiser of a listing cannot be changed';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'The advertising identity of a listing cannot be changed';
    END IF;
  END IF;

  IF NEW.tenant_id IS NOT NULL
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_is_moderation_op()
     AND NOT public.mkt_is_system_action()
     AND NOT public.mkt_can_publish_as_business(NEW.tenant_id) THEN
    RAISE EXCEPTION 'You are not allowed to publish on behalf of this business';
  END IF;

  RETURN NEW;
END $$;
