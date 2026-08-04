-- 1) Account-scoped call availability -------------------------------------
ALTER TABLE public.mkt_call_settings
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS call_mode text NOT NULL DEFAULT 'off';

ALTER TABLE public.mkt_call_settings DROP CONSTRAINT IF EXISTS mkt_call_settings_mode_chk;
ALTER TABLE public.mkt_call_settings
  ADD CONSTRAINT mkt_call_settings_mode_chk CHECK (call_mode IN ('off','request','direct'));

-- Backfill the mode from the legacy boolean for the personal account rows.
UPDATE public.mkt_call_settings
   SET call_mode = CASE WHEN calls_enabled THEN 'direct' ELSE 'off' END
 WHERE call_mode = 'off' AND calls_enabled;

-- One row per (account) = (user, tenant|personal).
ALTER TABLE public.mkt_call_settings DROP CONSTRAINT IF EXISTS mkt_call_settings_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS mkt_call_settings_account_uq
  ON public.mkt_call_settings (user_id, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Keep the legacy flag in sync so nothing reading it goes stale.
CREATE OR REPLACE FUNCTION public.mkt_call_settings_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.calls_enabled := (NEW.call_mode <> 'off');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mkt_call_settings_sync_trg ON public.mkt_call_settings;
CREATE TRIGGER mkt_call_settings_sync_trg BEFORE INSERT OR UPDATE ON public.mkt_call_settings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_call_settings_sync();

-- The owner may only manage a business row when they are an active member.
DROP POLICY IF EXISTS mkt_call_settings_own ON public.mkt_call_settings;
CREATE POLICY mkt_call_settings_own ON public.mkt_call_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid()
         AND (tenant_id IS NULL OR public.is_active_member(tenant_id, auth.uid())))
  WITH CHECK (user_id = auth.uid()
         AND (tenant_id IS NULL OR public.is_active_member(tenant_id, auth.uid())));

-- 2) Resolved mode for an account ------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_call_mode(_user_id uuid, _tenant_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT s.call_mode FROM public.mkt_call_settings s
                    WHERE s.user_id = _user_id
                      AND s.tenant_id IS NOT DISTINCT FROM _tenant_id
                    LIMIT 1), 'off')
$$;
REVOKE ALL ON FUNCTION public.mkt_call_mode(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_mode(uuid, uuid) TO authenticated, service_role;

-- 3) Eligibility now reports the advertiser's mode --------------------------
CREATE OR REPLACE FUNCTION public.mkt_call_can_call(_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _owner uuid; _tenant uuid; _status text; _mode text; _restricted boolean;
BEGIN
  IF _me IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'auth_required'); END IF;
  SELECT owner_user_id, tenant_id, status INTO _owner, _tenant, _status
    FROM public.mkt_listings WHERE id = _listing_id AND deleted_at IS NULL;
  IF _owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF _status <> 'published' THEN RETURN jsonb_build_object('ok', false, 'reason', 'listing_unavailable'); END IF;
  IF _owner = _me THEN RETURN jsonb_build_object('ok', false, 'reason', 'self_call'); END IF;

  _mode := public.mkt_call_mode(_owner, _tenant);
  IF _mode = 'off' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'calls_disabled', 'mode', 'off');
  END IF;

  IF EXISTS (SELECT 1 FROM public.mkt_call_blocks b
              WHERE b.kind = 'block'
                AND ((b.user_id = _owner AND b.blocked_user_id = _me)
                  OR (b.user_id = _me AND b.blocked_user_id = _owner)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'blocked', 'mode', _mode); END IF;

  IF EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
     WHERE r.subject_type = 'user' AND r.subject_id IN (_me, _owner)
       AND r.restriction IN ('suspend_account', 'suspend_calls', 'suspend_messaging')
       AND r.lifted_at IS NULL AND r.starts_at <= now()
       AND (r.expires_at IS NULL OR r.expires_at > now())
  ) THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted', 'mode', _mode); END IF;

  SELECT EXISTS (SELECT 1 FROM public.mkt_call_restrictions r
                  WHERE r.user_id = _me AND r.restricted_until > now()) INTO _restricted;
  IF _restricted THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted', 'mode', _mode); END IF;

  -- A pending request is enough for "request" mode; only real calls need a free line.
  IF _mode = 'direct' AND EXISTS (
      SELECT 1 FROM public.mkt_calls c
       WHERE c.status IN ('requesting','ringing','connected')
         AND (c.caller_user_id IN (_me, _owner) OR c.callee_user_id IN (_me, _owner)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'busy', 'mode', _mode); END IF;

  RETURN jsonb_build_object('ok', true, 'mode', _mode);
END $function$;

-- 4) Call requests (mode = 'request') --------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_call_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  call_id uuid REFERENCES public.mkt_calls(id) ON DELETE SET NULL,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_call_requests_status_chk CHECK (status IN ('open','called','closed'))
);

GRANT SELECT ON public.mkt_call_requests TO authenticated;
GRANT ALL ON public.mkt_call_requests TO service_role;
ALTER TABLE public.mkt_call_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_call_requests_read ON public.mkt_call_requests;
CREATE POLICY mkt_call_requests_read ON public.mkt_call_requests
  FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR owner_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS mkt_call_requests_owner_idx
  ON public.mkt_call_requests (owner_user_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_call_requests_open_uq
  ON public.mkt_call_requests (listing_id, requester_user_id) WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.mkt_call_request_create(_listing_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _chk jsonb; _owner uuid; _tenant uuid; _id uuid; _recent int;
BEGIN
  _chk := public.mkt_call_can_call(_listing_id);
  IF (_chk->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CALL_NOT_ALLOWED:%', _chk->>'reason';
  END IF;
  IF _chk->>'mode' <> 'request' THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:invalid_state'; END IF;

  SELECT owner_user_id, tenant_id INTO _owner, _tenant
    FROM public.mkt_listings WHERE id = _listing_id;

  SELECT count(*) INTO _recent FROM public.mkt_call_requests
   WHERE requester_user_id = _me AND created_at > now() - interval '1 hour';
  IF _recent >= 10 THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:rate_limited'; END IF;

  SELECT id INTO _id FROM public.mkt_call_requests
   WHERE listing_id = _listing_id AND requester_user_id = _me AND status = 'open';
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  INSERT INTO public.mkt_call_requests (listing_id, tenant_id, requester_user_id, owner_user_id)
  VALUES (_listing_id, _tenant, _me, _owner)
  RETURNING id INTO _id;

  PERFORM public.mkt_notify(_owner, NULL, 'call_request', 'طلب اتصال جديد على إعلانك', NULL);
  RETURN _id;
END $function$;
REVOKE ALL ON FUNCTION public.mkt_call_request_create(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_request_create(uuid) TO authenticated;

-- The advertiser answers a request by calling the requester back.
CREATE OR REPLACE FUNCTION public.mkt_call_request_start(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _r public.mkt_call_requests; _conv uuid; _call uuid;
BEGIN
  SELECT * INTO _r FROM public.mkt_call_requests WHERE id = _request_id;
  IF _r.id IS NULL OR _r.owner_user_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _r.status <> 'open' THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:invalid_state'; END IF;

  IF EXISTS (SELECT 1 FROM public.mkt_call_blocks b
              WHERE b.kind = 'block'
                AND ((b.user_id = _me AND b.blocked_user_id = _r.requester_user_id)
                  OR (b.user_id = _r.requester_user_id AND b.blocked_user_id = _me)))
  THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:blocked'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
     WHERE r.subject_type = 'user' AND r.subject_id IN (_me, _r.requester_user_id)
       AND r.restriction IN ('suspend_account','suspend_calls','suspend_messaging')
       AND r.lifted_at IS NULL AND r.starts_at <= now()
       AND (r.expires_at IS NULL OR r.expires_at > now())
  ) THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:restricted'; END IF;

  IF EXISTS (SELECT 1 FROM public.mkt_calls c
              WHERE c.status IN ('requesting','ringing','connected')
                AND (c.caller_user_id IN (_me, _r.requester_user_id)
                  OR c.callee_user_id IN (_me, _r.requester_user_id)))
  THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:busy'; END IF;

  SELECT id INTO _conv FROM public.mkt_conversations
   WHERE listing_id = _r.listing_id AND buyer_user_id = _r.requester_user_id;
  IF _conv IS NULL THEN
    INSERT INTO public.mkt_conversations (listing_id, buyer_user_id)
    VALUES (_r.listing_id, _r.requester_user_id) RETURNING id INTO _conv;
  END IF;

  INSERT INTO public.mkt_calls (listing_id, conversation_id, caller_user_id, callee_user_id, status)
  VALUES (_r.listing_id, _conv, _me, _r.requester_user_id, 'ringing')
  RETURNING id INTO _call;

  UPDATE public.mkt_call_requests
     SET status = 'called', call_id = _call, updated_at = now()
   WHERE id = _request_id;

  PERFORM public.mkt_notify(_r.requester_user_id, NULL, 'call_incoming', 'مكالمة واردة', NULL);
  RETURN jsonb_build_object('call_id', _call, 'conversation_id', _conv);
END $function$;
REVOKE ALL ON FUNCTION public.mkt_call_request_start(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_request_start(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_call_request_close(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid();
BEGIN
  UPDATE public.mkt_call_requests
     SET status = 'closed', closed_reason = left(coalesce(_reason,''), 120), updated_at = now()
   WHERE id = _request_id
     AND status <> 'closed'
     AND (owner_user_id = _me OR requester_user_id = _me);
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.mkt_call_request_close(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_request_close(uuid, text) TO authenticated;

-- 5) Mode switch that also stops an in-flight call -------------------------
CREATE OR REPLACE FUNCTION public.mkt_call_mode_set(_tenant_id uuid, _mode text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _mode NOT IN ('off','request','direct') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  IF _tenant_id IS NOT NULL AND NOT public.is_active_member(_tenant_id, _me) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.mkt_call_settings (user_id, tenant_id, call_mode)
  VALUES (_me, _tenant_id, _mode)
  ON CONFLICT (user_id, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET call_mode = EXCLUDED.call_mode;

  -- Turning reception off must end whatever is live right now, safely.
  IF _mode = 'off' THEN
    UPDATE public.mkt_calls
       SET status = CASE WHEN status = 'connected' THEN 'ended' ELSE 'cancelled' END,
           end_reason = 'receiver_disabled', ended_by = _me, ended_at = now(),
           duration_seconds = CASE WHEN accepted_at IS NOT NULL
                                   THEN greatest(0, extract(epoch FROM now() - accepted_at)::int)
                                   ELSE duration_seconds END,
           updated_at = now()
     WHERE status IN ('requesting','ringing','connected')
       AND (callee_user_id = _me OR caller_user_id = _me);
  END IF;

  RETURN _mode;
END $function$;
REVOKE ALL ON FUNCTION public.mkt_call_mode_set(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_mode_set(uuid, text) TO authenticated;

-- 6) Missed call bookkeeping for direct mode -------------------------------
CREATE OR REPLACE FUNCTION public.mkt_call_missed(_call_id uuid, _reason text DEFAULT 'no_answer')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _me uuid := auth.uid(); _c public.mkt_calls;
BEGIN
  SELECT * INTO _c FROM public.mkt_calls WHERE id = _call_id;
  IF _c.id IS NULL OR _me NOT IN (_c.caller_user_id, _c.callee_user_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _c.status IN ('declined','no_answer','busy','failed','ended','cancelled') THEN RETURN; END IF;

  UPDATE public.mkt_calls
     SET status = CASE WHEN _reason = 'busy' THEN 'busy' ELSE 'no_answer' END,
         end_reason = left(_reason, 40), ended_by = _me, ended_at = now(), updated_at = now()
   WHERE id = _call_id;

  PERFORM public.mkt_notify(_c.callee_user_id, NULL, 'call_missed', 'مكالمة فائتة', NULL);
END $function$;
REVOKE ALL ON FUNCTION public.mkt_call_missed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_missed(uuid, text) TO authenticated;