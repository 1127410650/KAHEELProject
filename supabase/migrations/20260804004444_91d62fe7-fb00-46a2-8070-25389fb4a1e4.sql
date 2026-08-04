-- ============ PART A: unified single price ============

ALTER TABLE public.mkt_listings ALTER COLUMN price_on_request SET DEFAULT false;
ALTER TABLE public.mkt_listings DROP CONSTRAINT IF EXISTS mkt_listings_price_positive;
ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_price_positive
  CHECK (price IS NULL OR (price > 0 AND price <= 999999999999));

CREATE OR REPLACE FUNCTION public.mkt_enforce_listing_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.price_on_request := false;
  IF NEW.price IS NOT NULL THEN
    IF NEW.price <= 0 THEN RAISE EXCEPTION 'PRICE_INVALID'; END IF;
    IF NEW.price > 999999999999 THEN RAISE EXCEPTION 'PRICE_TOO_LARGE'; END IF;
  END IF;
  IF NEW.status IN ('pending','published') AND NEW.price IS NULL THEN
    RAISE EXCEPTION 'PRICE_REQUIRED';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- currency is derived from the account country and frozen once published
    IF OLD.published_at IS NOT NULL AND NEW.currency IS DISTINCT FROM OLD.currency THEN
      NEW.currency := OLD.currency;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zzz_mkt_listings_price ON public.mkt_listings;
CREATE TRIGGER zzz_mkt_listings_price
  BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_enforce_listing_price();

CREATE OR REPLACE FUNCTION public.mkt_listing_price_change_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price OR NEW.price_unit IS DISTINCT FROM OLD.price_unit THEN
    PERFORM public.mkt_log_listing_event(NEW.id, 'price_changed', jsonb_build_object(
      'old_price', OLD.price, 'new_price', NEW.price,
      'old_unit', OLD.price_unit, 'new_unit', NEW.price_unit,
      'currency', NEW.currency));
    IF NEW.status = 'published' AND NEW.price IS DISTINCT FROM OLD.price THEN
      PERFORM public.mkt_moderation_scan_listing(NEW.id, 'price_change');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zzz_mkt_listings_price_audit ON public.mkt_listings;
CREATE TRIGGER zzz_mkt_listings_price_audit
  AFTER UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_price_change_audit();

-- legacy rows: no data deleted, no default price invented
DO $$
DECLARE r record;
BEGIN
  PERFORM set_config('mkt.system_action', 'license_expiry', true);
  FOR r IN SELECT id FROM public.mkt_listings
            WHERE deleted_at IS NULL
              AND status IN ('published','pending')
              AND (price IS NULL OR price <= 0)
  LOOP
    PERFORM set_config('mkt.system_action', 'license_expiry', true);
    UPDATE public.mkt_listings SET status = 'needs_changes',
      rejection_reason = 'يلزم إضافة سعر واضح للإعلان وفق سياسة السعر الموحد'
     WHERE id = r.id;
    INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason)
    VALUES (r.id, 'published', 'needs_changes', 'unified_price_policy_missing_price');
    PERFORM public.mkt_log_listing_event(r.id, 'needs_changes', jsonb_build_object('reason','unified_price_policy'));
  END LOOP;
  PERFORM set_config('mkt.system_action', 'license_expiry', true);
  UPDATE public.mkt_listings SET price_on_request = false WHERE price_on_request;
  PERFORM set_config('mkt.system_action', '', true);
END $$;

-- ============ PART B: internal voice calls (WebRTC) ============

CREATE TABLE public.mkt_call_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  calls_enabled boolean NOT NULL DEFAULT false,
  available_from time,
  available_to time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mkt_call_settings TO authenticated;
GRANT ALL ON public.mkt_call_settings TO service_role;
ALTER TABLE public.mkt_call_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_call_settings_own ON public.mkt_call_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER mkt_call_settings_touch BEFORE UPDATE ON public.mkt_call_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mkt_call_blocks (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'block' CHECK (kind IN ('block','mute')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id, kind)
);
GRANT SELECT, INSERT, DELETE ON public.mkt_call_blocks TO authenticated;
GRANT ALL ON public.mkt_call_blocks TO service_role;
ALTER TABLE public.mkt_call_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_call_blocks_own ON public.mkt_call_blocks
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.mkt_call_restrictions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted_until timestamptz NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_call_restrictions TO authenticated;
GRANT ALL ON public.mkt_call_restrictions TO service_role;
ALTER TABLE public.mkt_call_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_call_restrictions_own ON public.mkt_call_restrictions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.mkt_is_platform_admin());

CREATE TABLE public.mkt_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.mkt_listings(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.mkt_conversations(id) ON DELETE SET NULL,
  caller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requesting'
    CHECK (status IN ('requesting','ringing','connected','declined','no_answer','busy','failed','ended','cancelled')),
  end_reason text,
  ended_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (caller_user_id <> callee_user_id)
);
CREATE INDEX mkt_calls_caller_idx ON public.mkt_calls (caller_user_id, requested_at DESC);
CREATE INDEX mkt_calls_callee_idx ON public.mkt_calls (callee_user_id, requested_at DESC);
CREATE INDEX mkt_calls_conversation_idx ON public.mkt_calls (conversation_id, requested_at DESC);
CREATE INDEX mkt_calls_active_idx ON public.mkt_calls (status) WHERE status IN ('requesting','ringing','connected');
GRANT SELECT ON public.mkt_calls TO authenticated;
GRANT ALL ON public.mkt_calls TO service_role;
ALTER TABLE public.mkt_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_calls_read_own ON public.mkt_calls
  FOR SELECT TO authenticated
  USING (caller_user_id = auth.uid() OR callee_user_id = auth.uid() OR public.mkt_is_platform_admin());
CREATE TRIGGER mkt_calls_touch BEFORE UPDATE ON public.mkt_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mkt_call_signals (
  id bigserial PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.mkt_calls(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('offer','answer','candidate','bye')),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_call_signals_call_idx ON public.mkt_call_signals (call_id, id);
GRANT SELECT, INSERT, DELETE ON public.mkt_call_signals TO authenticated;
GRANT ALL ON public.mkt_call_signals TO service_role;
ALTER TABLE public.mkt_call_signals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mkt_is_call_party(_call_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_calls c
                  WHERE c.id = _call_id
                    AND (c.caller_user_id = auth.uid() OR c.callee_user_id = auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.mkt_is_call_party(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_is_call_party(uuid) TO authenticated, service_role;

CREATE POLICY mkt_call_signals_party_read ON public.mkt_call_signals
  FOR SELECT TO authenticated
  USING (public.mkt_is_call_party(call_id) AND expires_at > now());
CREATE POLICY mkt_call_signals_party_insert ON public.mkt_call_signals
  FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid() AND public.mkt_is_call_party(call_id)
              AND EXISTS (SELECT 1 FROM public.mkt_calls c WHERE c.id = call_id
                           AND c.status IN ('requesting','ringing','connected')));
CREATE POLICY mkt_call_signals_party_delete ON public.mkt_call_signals
  FOR DELETE TO authenticated USING (public.mkt_is_call_party(call_id));

ALTER TABLE public.mkt_calls REPLICA IDENTITY FULL;
ALTER TABLE public.mkt_call_signals REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mkt_calls; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mkt_call_signals; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---- server-side eligibility ----
CREATE OR REPLACE FUNCTION public.mkt_call_can_call(_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
  SELECT EXISTS (SELECT 1 FROM public.mkt_call_restrictions r
                  WHERE r.user_id = _me AND r.restricted_until > now()) INTO _restricted;
  IF _restricted THEN RETURN jsonb_build_object('ok', false, 'reason', 'restricted'); END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_calls c
              WHERE c.status IN ('requesting','ringing','connected')
                AND (c.caller_user_id IN (_me, _owner) OR c.callee_user_id IN (_me, _owner)))
  THEN RETURN jsonb_build_object('ok', false, 'reason', 'busy'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.mkt_call_can_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_can_call(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_call_start(_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _chk jsonb; _owner uuid; _conv uuid; _call uuid; _recent int; _missed int;
BEGIN
  _chk := public.mkt_call_can_call(_listing_id);
  IF (_chk->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CALL_NOT_ALLOWED:%', _chk->>'reason';
  END IF;
  SELECT owner_user_id INTO _owner FROM public.mkt_listings WHERE id = _listing_id;

  SELECT count(*) INTO _recent FROM public.mkt_calls
   WHERE caller_user_id = _me AND requested_at > now() - interval '1 hour';
  IF _recent >= 10 THEN RAISE EXCEPTION 'CALL_NOT_ALLOWED:rate_limited'; END IF;

  SELECT count(*) INTO _missed FROM public.mkt_calls
   WHERE caller_user_id = _me AND callee_user_id = _owner
     AND status IN ('declined','no_answer','cancelled')
     AND requested_at > now() - interval '1 day';
  IF _missed >= 5 THEN
    INSERT INTO public.mkt_call_restrictions (user_id, restricted_until, reason)
    VALUES (_me, now() + interval '6 hours', 'repeated_unanswered_calls')
    ON CONFLICT (user_id) DO UPDATE SET restricted_until = now() + interval '6 hours',
      reason = 'repeated_unanswered_calls';
    RAISE EXCEPTION 'CALL_NOT_ALLOWED:restricted';
  END IF;

  SELECT id INTO _conv FROM public.mkt_conversations
   WHERE listing_id = _listing_id AND buyer_user_id = _me;
  IF _conv IS NULL THEN
    INSERT INTO public.mkt_conversations (listing_id, buyer_user_id) VALUES (_listing_id, _me)
    RETURNING id INTO _conv;
  END IF;

  INSERT INTO public.mkt_calls (listing_id, conversation_id, caller_user_id, callee_user_id, status)
  VALUES (_listing_id, _conv, _me, _owner, 'ringing')
  RETURNING id INTO _call;

  PERFORM public.mkt_notify(_owner, NULL, 'call_incoming', 'مكالمة واردة', NULL);
  RETURN jsonb_build_object('call_id', _call, 'conversation_id', _conv);
END $$;
REVOKE ALL ON FUNCTION public.mkt_call_start(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_start(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_call_transition(_call_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _c public.mkt_calls;
BEGIN
  SELECT * INTO _c FROM public.mkt_calls WHERE id = _call_id FOR UPDATE;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _me NOT IN (_c.caller_user_id, _c.callee_user_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _c.status IN ('ended','declined','no_answer','busy','failed','cancelled') THEN
    RETURN jsonb_build_object('status', _c.status);
  END IF;

  IF _status = 'connected' THEN
    IF _me <> _c.callee_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE public.mkt_calls SET status = 'connected', accepted_at = now() WHERE id = _call_id;
  ELSIF _status = 'declined' THEN
    IF _me <> _c.callee_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE public.mkt_calls SET status = 'declined', ended_at = now(), ended_by = _me,
      end_reason = coalesce(_reason,'declined') WHERE id = _call_id;
  ELSIF _status = 'cancelled' THEN
    IF _me <> _c.caller_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE public.mkt_calls SET status = 'cancelled', ended_at = now(), ended_by = _me,
      end_reason = coalesce(_reason,'cancelled') WHERE id = _call_id;
  ELSIF _status IN ('ended','failed','no_answer','busy') THEN
    UPDATE public.mkt_calls SET status = _status, ended_at = now(), ended_by = _me,
      end_reason = _reason,
      duration_seconds = CASE WHEN accepted_at IS NOT NULL
        THEN greatest(0, extract(epoch FROM (now() - accepted_at))::int) ELSE 0 END
     WHERE id = _call_id;
  ELSE
    RAISE EXCEPTION 'invalid_status';
  END IF;

  DELETE FROM public.mkt_call_signals WHERE call_id = _call_id
    AND (SELECT status FROM public.mkt_calls WHERE id = _call_id)
        NOT IN ('requesting','ringing','connected');
  RETURN jsonb_build_object('status', (SELECT status FROM public.mkt_calls WHERE id = _call_id));
END $$;
REVOKE ALL ON FUNCTION public.mkt_call_transition(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_transition(uuid, text, text) TO authenticated, service_role;

-- privacy-safe peer info for the in-call UI (no phone, no email, no IP)
CREATE OR REPLACE FUNCTION public.mkt_call_peer(_call_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _me uuid := auth.uid(); _c public.mkt_calls; _peer uuid; _name text; _avatar text; _title text;
BEGIN
  SELECT * INTO _c FROM public.mkt_calls WHERE id = _call_id;
  IF _c.id IS NULL OR _me NOT IN (_c.caller_user_id, _c.callee_user_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  _peer := CASE WHEN _me = _c.caller_user_id THEN _c.callee_user_id ELSE _c.caller_user_id END;
  SELECT full_name, avatar_url INTO _name, _avatar FROM public.profiles WHERE id = _peer;
  SELECT title INTO _title FROM public.mkt_listings WHERE id = _c.listing_id;
  RETURN jsonb_build_object(
    'role', CASE WHEN _me = _c.caller_user_id THEN 'caller' ELSE 'callee' END,
    'peer_name', coalesce(_name, 'مستخدم'), 'peer_avatar', _avatar,
    'listing_title', _title, 'listing_id', _c.listing_id,
    'conversation_id', _c.conversation_id, 'status', _c.status,
    'accepted_at', _c.accepted_at);
END $$;
REVOKE ALL ON FUNCTION public.mkt_call_peer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_call_peer(uuid) TO authenticated, service_role;

-- housekeeping: expire ringing calls and purge stale signals
CREATE OR REPLACE FUNCTION public.mkt_calls_sweep()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int := 0;
BEGIN
  WITH x AS (
    UPDATE public.mkt_calls SET status = 'no_answer', ended_at = now(), end_reason = 'timeout',
      duration_seconds = 0
     WHERE status IN ('requesting','ringing') AND requested_at < now() - interval '45 seconds'
    RETURNING 1)
  SELECT count(*) INTO n FROM x;
  UPDATE public.mkt_calls SET status = 'failed', ended_at = now(), end_reason = 'stalled',
    duration_seconds = coalesce(duration_seconds, 0)
   WHERE status = 'connected' AND updated_at < now() - interval '4 hours';
  DELETE FROM public.mkt_call_signals s
   WHERE s.expires_at < now()
      OR EXISTS (SELECT 1 FROM public.mkt_calls c WHERE c.id = s.call_id
                  AND c.status NOT IN ('requesting','ringing','connected'));
  DELETE FROM public.mkt_call_restrictions WHERE restricted_until < now() - interval '7 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mkt_calls_sweep() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_calls_sweep() TO authenticated, service_role;

-- admin abuse overview (counts only, never audio or content)
CREATE OR REPLACE FUNCTION public.mkt_admin_call_abuse(_limit int DEFAULT 50)
RETURNS TABLE (user_id uuid, declined_count bigint, no_answer_count bigint,
               total_calls bigint, restricted_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.caller_user_id,
         count(*) FILTER (WHERE c.status = 'declined'),
         count(*) FILTER (WHERE c.status = 'no_answer'),
         count(*),
         (SELECT r.restricted_until FROM public.mkt_call_restrictions r WHERE r.user_id = c.caller_user_id)
    FROM public.mkt_calls c
   WHERE public.mkt_is_platform_admin()
     AND c.requested_at > now() - interval '30 days'
   GROUP BY c.caller_user_id
   HAVING count(*) FILTER (WHERE c.status IN ('declined','no_answer')) > 0
   ORDER BY count(*) FILTER (WHERE c.status IN ('declined','no_answer')) DESC
   LIMIT coalesce(_limit, 50)
$$;
REVOKE ALL ON FUNCTION public.mkt_admin_call_abuse(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_call_abuse(int) TO authenticated, service_role;