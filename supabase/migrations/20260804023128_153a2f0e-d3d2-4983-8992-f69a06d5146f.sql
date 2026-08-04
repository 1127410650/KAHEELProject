CREATE OR REPLACE FUNCTION public.mkt_call_can_call(_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _owner uuid; _status text; _enabled boolean; _restricted boolean;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'auth_required'); END IF;
  SELECT owner_user_id, status INTO _owner, _status
    FROM public.mkt_listings WHERE id = _listing_id AND deleted_at IS NULL;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF _status <> 'published' THEN RETURN jsonb_build_object('ok', false, 'reason', 'listing_unavailable'); END IF;
  IF _owner = _me THEN RETURN jsonb_build_object('ok', false, 'reason', 'self_call'); END IF;
  SELECT calls_enabled INTO _enabled FROM public.mkt_call_settings WHERE user_id = _owner;
  IF coalesce(_enabled, false) = false THEN RETURN jsonb_build_object('ok', false, 'reason', 'calls_disabled'); END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_call_blocks b
              WHERE b.kind = 'block'
                AND ((b.user_id = _owner AND b.blocked_user_id = _me)
                  OR (b.user_id = _me AND b.blocked_user_id = _owner)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'blocked'); END IF;

  -- Administrative account restrictions apply to both sides of the call.
  IF EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
     WHERE r.subject_type = 'user'
       AND r.subject_id IN (_me, _owner)
       AND r.restriction IN ('suspend_account', 'suspend_calls', 'suspend_messaging')
       AND r.lifted_at IS NULL
       AND r.starts_at <= now()
       AND (r.expires_at IS NULL OR r.expires_at > now())
  ) THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted'); END IF;

  SELECT EXISTS (SELECT 1 FROM public.mkt_call_restrictions r
                  WHERE r.user_id = _me AND r.restricted_until > now()) INTO _restricted;
  IF _restricted THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted'); END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_calls c
              WHERE c.status IN ('requesting','ringing','connected')
                AND (c.caller_user_id IN (_me, _owner) OR c.callee_user_id IN (_me, _owner)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'busy'); END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;