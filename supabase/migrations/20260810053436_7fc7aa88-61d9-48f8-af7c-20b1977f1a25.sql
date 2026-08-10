CREATE OR REPLACE FUNCTION public.mkt_re_provider_slugify(_name text, _id uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base text;
BEGIN
  base := lower(btrim(coalesce(_name, '')));
  base := regexp_replace(base, '[^a-z0-9\u0621-\u064a]+', '-', 'g');
  base := btrim(base, '-');
  IF base IS NULL OR base = '' OR char_length(base) < 2 THEN
    base := 'p';
  END IF;
  RETURN left(base, 40) || '-' || right(replace(_id::text, '-', ''), 6);
END;
$$;

UPDATE public.mkt_realestate_providers
SET slug = public.mkt_re_provider_slugify(display_name, id)
WHERE deleted_at IS NULL;