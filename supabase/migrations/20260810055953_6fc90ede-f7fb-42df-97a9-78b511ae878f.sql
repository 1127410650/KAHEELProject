REVOKE EXECUTE ON FUNCTION public.mkt_page_block_log(text, uuid, text, jsonb, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_block_save(uuid, text, text, jsonb, integer, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_block_delete(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_block_restore(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_blocks_reorder(text, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_composition_save(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mkt_admin_page_composition_apply(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.mkt_admin_page_block_save(uuid, text, text, jsonb, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_page_block_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_page_block_restore(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_page_blocks_reorder(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_page_composition_save(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_page_composition_apply(uuid) TO authenticated;