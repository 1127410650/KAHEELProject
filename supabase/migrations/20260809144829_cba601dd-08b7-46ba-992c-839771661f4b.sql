CREATE OR REPLACE FUNCTION public.mkt_call_mode(_user_id uuid, _tenant_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Free in-platform calls are on by default; an account can switch to
  -- 'request' or 'off' from its call settings.
  SELECT coalesce((SELECT s.call_mode FROM public.mkt_call_settings s
                    WHERE s.user_id = _user_id
                      AND s.tenant_id IS NOT DISTINCT FROM _tenant_id
                    LIMIT 1), 'direct')
$function$;

CREATE OR REPLACE FUNCTION public.mkt_call_can_call_conv(_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _buyer uuid; _seller uuid; _tenant uuid; _peer uuid; _mode text;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'auth_required'); END IF;

  SELECT c.buyer_user_id, l.owner_user_id, l.tenant_id
    INTO _buyer, _seller, _tenant
    FROM public.mkt_conversations c
    LEFT JOIN public.mkt_listings l ON l.id = c.listing_id
   WHERE c.id = _conversation_id;

  IF _buyer IS NULL OR _seller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _me = _buyer THEN _peer := _seller;
  ELSIF _me = _seller THEN _peer := _buyer;
  ELSE RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- The peer's own availability decides; a seller calling a buyer reads the
  -- buyer's personal setting.
  _mode := CASE WHEN _peer = _seller THEN public.mkt_call_mode(_seller, _tenant)
                ELSE public.mkt_call_mode(_buyer, NULL) END;
  IF _mode = 'off' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'calls_disabled', 'mode', 'off');
  END IF;

  IF EXISTS (SELECT 1 FROM public.mkt_call_blocks b
              WHERE b.kind = 'block'
                AND ((b.user_id = _peer AND b.blocked_user_id = _me)
                  OR (b.user_id = _me AND b.blocked_user_id = _peer)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'blocked', 'mode', _mode); END IF;

  IF EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
     WHERE r.subject_type = 'user' AND r.subject_id IN (_me, _peer)
       AND r.restriction IN ('suspend_account', 'suspend_calls', 'suspend_messaging')
       AND r.lifted_at IS NULL AND r.starts_at <= now()
       AND (r.expires_at IS NULL OR r.expires_at > now())
  ) THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted', 'mode', _mode); END IF;

  IF EXISTS (SELECT 1 FROM public.mkt_call_restrictions r
              WHERE r.user_id = _me AND r.restricted_until > now())
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted', 'mode', _mode); END IF;

  IF EXISTS (SELECT 1 FROM public.mkt_calls c
              WHERE c.status IN ('requesting','ringing','connected')
                AND (c.caller_user_id IN (_me, _peer) OR c.callee_user_id IN (_me, _peer)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'busy', 'mode', _mode); END IF;

  RETURN jsonb_build_object('ok', true, 'mode', _mode);
END $function$;

CREATE OR REPLACE FUNCTION public.mkt_call_start_conv(_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _chk jsonb; _buyer uuid; _seller uuid; _listing uuid;
        _peer uuid; _call uuid; _recent int; _missed int;
BEGIN
  _chk := public.mkt_call_can_call_conv(_conversation_id);
  IF (_chk->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CALL_NOT_ALLOWED:%', _chk->>'reason';
  END IF;

  SELECT c.buyer_user_id, l.owner_user_id, c.listing_id
    INTO _buyer, _seller, _listing
    FROM public.mkt_conversations c
    LEFT JOIN public.mkt_listings l ON l.id = c.listing_id
   WHERE c.id = _conversation_id;

  _peer := CASE WHEN _me = _buyer THEN _seller ELSE _buyer END;

  SELECT count(*) INTO _recent FROM public.mkt_calls
   WHERE caller_user_id = _me AND requested_at > now() - interval '1 hour';
  IF _recent >= 10 THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:rate_limited'; END IF;

  SELECT count(*) INTO _missed FROM public.mkt_calls
   WHERE caller_user_id = _me AND callee_user_id = _peer
     AND status IN ('declined','no_answer','cancelled')
     AND requested_at > now() - interval '1 day';
  IF _missed >= 5 THEN
    INSERT INTO public.mkt_call_restrictions (user_id, restricted_until, reason)
    VALUES (_me, now() + interval '6 hours', 'repeated_unanswered_calls')
    ON CONFLICT (user_id) DO UPDATE SET restricted_until = now() + interval '6 hours',
      reason = 'repeated_unanswered_calls';
    RAISE EXCEPTION 'CALL_NOT_ALLOWED:restricted';
  END IF;

  INSERT INTO public.mkt_calls (listing_id, conversation_id, caller_user_id, callee_user_id, status)
  VALUES (_listing, _conversation_id, _me, _peer, 'ringing')
  RETURNING id INTO _call;

  PERFORM public.mkt_notify(_peer, NULL, 'call_incoming', 'مكالمة واردة', NULL);
  RETURN jsonb_build_object('call_id', _call, 'conversation_id', _conversation_id);
END $function$;

REVOKE ALL ON FUNCTION public.mkt_call_can_call_conv(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_call_start_conv(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_call_can_call_conv(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_call_start_conv(uuid) TO authenticated;