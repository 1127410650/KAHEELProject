-- an approved advertiser operation marks itself, so the review guard can tell it
-- apart from a hand-crafted API write
CREATE OR REPLACE FUNCTION public.mkt_is_listing_op()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(current_setting('mkt.listing_op', true), '') = 'owner_lifecycle'
$$;
REVOKE ALL ON FUNCTION public.mkt_is_listing_op() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mkt_listing_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Review decisions belong to platform admins only.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('published','rejected','suspended')
     AND NOT public.mkt_is_platform_admin()
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

  -- Publishing under a business name requires an active membership with publishing rights.
  IF NEW.tenant_id IS NOT NULL
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_is_system_action()
     AND NOT public.mkt_can_publish_as_business(NEW.tenant_id) THEN
    RAISE EXCEPTION 'You are not allowed to publish on behalf of this business';
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mkt_set_listing_status(
  _listing_id uuid, _to text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _from text;
BEGIN
  SELECT status INTO _from FROM public.mkt_listings WHERE id = _listing_id;
  PERFORM set_config('mkt.listing_op', 'owner_lifecycle', true);
  UPDATE public.mkt_listings SET status = _to, updated_at = now() WHERE id = _listing_id;
  PERFORM set_config('mkt.listing_op', '', true);
  INSERT INTO public.mkt_listing_status_history (listing_id, actor_id, from_status, to_status, reason)
  VALUES (_listing_id, auth.uid(), _from, _to, _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_set_listing_status(uuid, text, text) FROM PUBLIC, anon, authenticated;