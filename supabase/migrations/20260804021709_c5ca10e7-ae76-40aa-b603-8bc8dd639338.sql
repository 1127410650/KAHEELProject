CREATE OR REPLACE FUNCTION public.mkt_listing_promotion_overview(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE wid uuid; w record; act record; prices jsonb;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  wid := public.mkt_wallet_for_listing(_id);
  SELECT id, balance_points, lifetime_spent INTO w
    FROM public.mkt_point_wallets WHERE id = wid;

  prices := public.mkt_promotion_prices();

  SELECT id, duration_days, points_spent, ends_at INTO act
    FROM public.mkt_listing_promotions
   WHERE listing_id = _id AND status = 'active' AND ends_at > now()
   ORDER BY ends_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'wallet_id', w.id,
    'balance', coalesce(w.balance_points, 0),
    'lifetime_spent', coalesce(w.lifetime_spent, 0),
    'prices', coalesce(prices, '{}'::jsonb),
    'active', CASE WHEN act.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', act.id, 'duration_days', act.duration_days,
        'points_spent', act.points_spent, 'ends_at', act.ends_at) END
  );
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_promotion_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_promotion_overview(uuid) TO authenticated;