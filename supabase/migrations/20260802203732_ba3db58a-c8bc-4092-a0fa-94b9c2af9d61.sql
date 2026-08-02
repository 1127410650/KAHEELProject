CREATE OR REPLACE FUNCTION public.mkt_listing_freeze_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'owner_user_id is immutable';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.mkt_listing_freeze_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aa_mkt_listings_freeze_owner ON public.mkt_listings;
CREATE TRIGGER aa_mkt_listings_freeze_owner
BEFORE UPDATE ON public.mkt_listings
FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_freeze_owner();