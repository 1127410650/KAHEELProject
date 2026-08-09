CREATE OR REPLACE FUNCTION public.mkt_user_addresses_single_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.mkt_user_addresses
       SET is_default = false, updated_at = now()
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_user_addresses_single_default() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_user_addresses_touch() FROM PUBLIC, anon, authenticated;