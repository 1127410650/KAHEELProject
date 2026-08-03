CREATE OR REPLACE FUNCTION public.mkt_review_listing(
  _listing_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text;
  new_status text;
  _days smallint;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT status, COALESCE(duration_days, 30) INTO old_status, _days
    FROM public.mkt_listings WHERE id = _listing_id;
  IF old_status IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  new_status := CASE _action
    WHEN 'approve' THEN 'published'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
    WHEN 'return' THEN 'draft'
    ELSE NULL END;

  IF new_status IS NULL THEN
    RAISE EXCEPTION 'Unknown action';
  END IF;

  IF _action <> 'approve' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  UPDATE public.mkt_listings
     SET status = new_status,
         rejection_reason = CASE WHEN _action = 'approve' THEN NULL ELSE _reason END,
         published_at = CASE WHEN _action = 'approve' THEN COALESCE(published_at, now()) ELSE published_at END,
         -- the countdown starts at approval, using the duration the advertiser picked
         expires_at = CASE WHEN _action = 'approve'
                           THEN now() + make_interval(days => _days::int)
                           ELSE expires_at END,
         expiry_notice_stage = CASE WHEN _action = 'approve' THEN 0 ELSE expiry_notice_stage END,
         paused_at = CASE WHEN _action = 'approve' THEN NULL ELSE paused_at END,
         updated_at = now()
   WHERE id = _listing_id;

  INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason, actor_id)
  VALUES (_listing_id, old_status, new_status, _reason, auth.uid());

  PERFORM public.log_audit('mkt_listing', _action, _listing_id,
    jsonb_build_object('status', old_status), jsonb_build_object('status', new_status), _reason);
END;
$$;