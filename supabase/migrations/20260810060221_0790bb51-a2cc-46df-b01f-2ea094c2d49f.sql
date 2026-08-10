DROP FUNCTION IF EXISTS public.mkt_admin_page_block_save(uuid, text, text, jsonb, integer, boolean);

CREATE OR REPLACE FUNCTION public.mkt_admin_page_block_save(
  _page text,
  _block_type text,
  _settings jsonb DEFAULT '{}'::jsonb,
  _id uuid DEFAULT NULL,
  _sort_order integer DEFAULT NULL,
  _hidden boolean DEFAULT NULL
) RETURNS public.mkt_page_blocks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row public.mkt_page_blocks;
  _old jsonb;
  _live integer;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  IF _id IS NULL THEN
    SELECT count(*) INTO _live
      FROM public.mkt_page_blocks
     WHERE page = _page AND deleted_at IS NULL;
    IF _live >= 20 THEN RAISE EXCEPTION 'BLOCK_LIMIT_REACHED'; END IF;

    INSERT INTO public.mkt_page_blocks (page, block_type, settings, sort_order, hidden, updated_by)
    VALUES (
      _page, _block_type, COALESCE(_settings, '{}'::jsonb),
      COALESCE(_sort_order, (
        SELECT COALESCE(max(sort_order), 0) + 10 FROM public.mkt_page_blocks WHERE page = _page
      )),
      COALESCE(_hidden, false), auth.uid()
    )
    RETURNING * INTO _row;
    PERFORM public.mkt_page_block_log(_page, _row.id, 'create', NULL, to_jsonb(_row));
    RETURN _row;
  END IF;

  SELECT to_jsonb(b) INTO _old FROM public.mkt_page_blocks b WHERE b.id = _id;
  IF _old IS NULL THEN RAISE EXCEPTION 'BLOCK_NOT_FOUND'; END IF;

  UPDATE public.mkt_page_blocks b
     SET settings   = COALESCE(_settings, b.settings),
         sort_order = COALESCE(_sort_order, b.sort_order),
         hidden     = COALESCE(_hidden, b.hidden),
         updated_by = auth.uid()
   WHERE b.id = _id
  RETURNING * INTO _row;

  PERFORM public.mkt_page_block_log(_row.page, _row.id, 'update', _old, to_jsonb(_row));
  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_block_save(text, text, jsonb, uuid, integer, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_page_block_save(text, text, jsonb, uuid, integer, boolean) TO authenticated;