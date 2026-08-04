REVOKE EXECUTE ON FUNCTION
  public.mkt_store_admin(),
  public.mkt_store_manage(uuid),
  public.mkt_store_branch_manage(uuid),
  public.mkt_store_item_manage(uuid),
  public.mkt_store_addon_group_manage(uuid),
  public.mkt_cart_owner(uuid),
  public.mkt_cart_item_owner(uuid),
  public.mkt_order_party(uuid),
  public.mkt_order_item_party(uuid),
  public.mkt_my_storefront(text)
FROM anon, public;

GRANT EXECUTE ON FUNCTION
  public.mkt_store_admin(),
  public.mkt_store_manage(uuid),
  public.mkt_store_branch_manage(uuid),
  public.mkt_store_item_manage(uuid),
  public.mkt_store_addon_group_manage(uuid),
  public.mkt_cart_owner(uuid),
  public.mkt_cart_item_owner(uuid),
  public.mkt_order_party(uuid),
  public.mkt_order_item_party(uuid),
  public.mkt_my_storefront(text)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.mkt_store_visible(uuid),
  public.mkt_store_branch_visible(uuid),
  public.mkt_store_item_visible(uuid),
  public.mkt_store_addon_group_visible(uuid)
TO anon, authenticated, service_role;