DO $$
DECLARE src text; newsrc text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='invitation_accept_by_id';
  IF position('#variable_conflict' in src) = 0 THEN
    newsrc := E'\n#variable_conflict use_column' || src;
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.invitation_accept_by_id(_id uuid) RETURNS TABLE(tenant_id uuid, activated boolean, memberships integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''public'', ''extensions'' AS %L',
      newsrc);
  END IF;
END $$;