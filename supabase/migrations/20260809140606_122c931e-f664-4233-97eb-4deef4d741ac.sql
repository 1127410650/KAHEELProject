ALTER TABLE public.mkt_ad_credit_topups
  DROP CONSTRAINT mkt_ad_credit_topups_status_chk;
ALTER TABLE public.mkt_ad_credit_topups
  ADD CONSTRAINT mkt_ad_credit_topups_status_chk CHECK (
    status = ANY (ARRAY['pending','approved','rejected','cancelled','failed','expired','refunded'])
  );

ALTER TABLE public.mkt_ad_credit_topups
  DROP CONSTRAINT mkt_ad_credit_topups_reject_chk;
ALTER TABLE public.mkt_ad_credit_topups
  ADD CONSTRAINT mkt_ad_credit_topups_reject_chk CHECK (
    status <> 'rejected' OR char_length(btrim(COALESCE(reject_reason, ''))) >= 3
  );

CREATE UNIQUE INDEX IF NOT EXISTS mkt_ad_credit_topups_session_uniq
  ON public.mkt_ad_credit_topups (provider_session_id)
  WHERE provider_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_ad_credit_topups_payment_idx
  ON public.mkt_ad_credit_topups (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Card pricing lives in settings so the browser never states a price.
UPDATE public.mkt_platform_settings
   SET value = value || jsonb_build_object(
         'provider', 'stripe',
         'currency', 'SAR',
         'packs', jsonb_build_array(
           jsonb_build_object('credits', 100,  'amount', 100),
           jsonb_build_object('credits', 500,  'amount', 450),
           jsonb_build_object('credits', 1000, 'amount', 850),
           jsonb_build_object('credits', 5000, 'amount', 4000)
         ))
 WHERE key = 'ad_credit.card_gateway';

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_card_start(
  _credits integer,
  _tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  cfg jsonb;
  wallet public.mkt_ad_credit_wallets;
  pack jsonb;
  v_amount numeric;
  v_currency text;
  topup_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT value INTO cfg FROM public.mkt_platform_settings WHERE key = 'ad_credit.card_gateway';
  IF NOT COALESCE((cfg->>'enabled')::boolean, false) THEN
    RAISE EXCEPTION 'gateway_disabled';
  END IF;

  SELECT p INTO pack
    FROM jsonb_array_elements(COALESCE(cfg->'packs', '[]'::jsonb)) p
   WHERE (p->>'credits')::integer = _credits
   LIMIT 1;
  IF pack IS NULL THEN
    RAISE EXCEPTION 'unknown_pack';
  END IF;

  v_amount := (pack->>'amount')::numeric;
  v_currency := COALESCE(NULLIF(cfg->>'currency', ''), 'SAR');
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_pack_price';
  END IF;

  wallet := public.mkt_ad_credit_wallet(_tenant_id);

  -- An abandoned checkout must not block the next attempt forever.
  UPDATE public.mkt_ad_credit_topups
     SET status = 'expired', updated_at = now()
   WHERE wallet_id = wallet.id
     AND method = 'card_gateway'
     AND status = 'pending'
     AND paid_at IS NULL
     AND created_at < now() - interval '30 minutes';

  IF EXISTS (
    SELECT 1 FROM public.mkt_ad_credit_topups
     WHERE wallet_id = wallet.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending_topup_exists';
  END IF;

  INSERT INTO public.mkt_ad_credit_topups
    (wallet_id, requested_by, method, credits, amount, currency, provider, status)
  VALUES
    (wallet.id, auth.uid(), 'card_gateway', _credits, v_amount, v_currency, 'stripe', 'pending')
  RETURNING id INTO topup_id;

  RETURN jsonb_build_object(
    'topup_id', topup_id,
    'credits', _credits,
    'amount', v_amount,
    'currency', v_currency
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_card_attach(
  _topup_id uuid,
  _session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  updated integer;
BEGIN
  IF _session_id IS NULL OR char_length(btrim(_session_id)) < 6 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  UPDATE public.mkt_ad_credit_topups
     SET provider_session_id = btrim(_session_id), updated_at = now()
   WHERE id = _topup_id
     AND method = 'card_gateway'
     AND status = 'pending'
     AND provider_session_id IS NULL;
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN
    RAISE EXCEPTION 'topup_not_attachable';
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_card_settle(
  _session_id text,
  _payment_id text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  topup public.mkt_ad_credit_topups;
  wallet public.mkt_ad_credit_wallets;
  new_balance integer;
  v_entry_id uuid;
BEGIN
  SELECT * INTO topup FROM public.mkt_ad_credit_topups
   WHERE provider_session_id = btrim(_session_id) FOR UPDATE;
  IF topup.id IS NULL THEN
    RAISE EXCEPTION 'topup_not_found';
  END IF;

  IF topup.status = 'approved' THEN
    SELECT balance INTO new_balance FROM public.mkt_ad_credit_wallets WHERE id = topup.wallet_id;
    RETURN jsonb_build_object('topup_id', topup.id, 'credited', false, 'balance', new_balance);
  END IF;

  IF topup.status NOT IN ('pending', 'expired', 'failed') THEN
    RAISE EXCEPTION 'topup_not_settleable';
  END IF;

  SELECT * INTO wallet FROM public.mkt_ad_credit_wallets WHERE id = topup.wallet_id FOR UPDATE;
  IF wallet.id IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  UPDATE public.mkt_ad_credit_wallets
     SET balance = balance + topup.credits,
         total_purchased = total_purchased + topup.credits
   WHERE id = wallet.id
   RETURNING balance INTO new_balance;

  INSERT INTO public.mkt_ad_credit_entries
    (wallet_id, kind, status, amount, balance_after, price_sar,
     payment_ref, reference_type, reference_id, note, actor_user_id)
  VALUES
    (wallet.id, 'purchase', 'settled', topup.credits, new_balance,
     CASE WHEN COALESCE(_currency, topup.currency) = 'SAR'
          THEN COALESCE(_amount, topup.amount) ELSE NULL END,
     COALESCE(NULLIF(btrim(COALESCE(_payment_id, '')), ''), btrim(_session_id)),
     'topup', topup.id,
     'card_gateway · ' || COALESCE(_amount, topup.amount)::text || ' ' || COALESCE(_currency, topup.currency),
     NULL)
  RETURNING id INTO v_entry_id;

  UPDATE public.mkt_ad_credit_topups
     SET status = 'approved',
         amount = COALESCE(_amount, amount),
         currency = COALESCE(NULLIF(btrim(COALESCE(_currency, '')), ''), currency),
         provider_payment_id = COALESCE(NULLIF(btrim(COALESCE(_payment_id, '')), ''), provider_payment_id),
         paid_at = now(),
         entry_id = v_entry_id,
         reject_reason = NULL,
         updated_at = now()
   WHERE id = topup.id;

  INSERT INTO public.mkt_notifications (user_id, event, title, body)
  VALUES (
    topup.requested_by,
    'ad_credit.topup_approved',
    'تم شحن رصيد الإعلانات',
    'أُضيف ' || topup.credits::text || ' رصيد إلى محفظتك بعد نجاح الدفع.'
  );

  RETURN jsonb_build_object('topup_id', topup.id, 'credited', true, 'balance', new_balance);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_card_fail(
  _session_id text,
  _status text DEFAULT 'failed',
  _reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  topup public.mkt_ad_credit_topups;
BEGIN
  IF _status NOT IN ('failed','expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO topup FROM public.mkt_ad_credit_topups
   WHERE provider_session_id = btrim(_session_id) FOR UPDATE;
  IF topup.id IS NULL THEN
    RETURN false;
  END IF;
  IF topup.status <> 'pending' THEN
    RETURN false;
  END IF;

  UPDATE public.mkt_ad_credit_topups
     SET status = _status,
         reject_reason = NULLIF(btrim(COALESCE(_reason, '')), ''),
         updated_at = now()
   WHERE id = topup.id;

  INSERT INTO public.mkt_notifications (user_id, event, title, body)
  VALUES (
    topup.requested_by,
    'ad_credit.topup_failed',
    'لم تكتمل عملية الدفع',
    COALESCE(NULLIF(btrim(COALESCE(_reason, '')), ''), 'انتهت جلسة الدفع دون إتمامها. يمكنك المحاولة مرة أخرى.')
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_card_refund(
  _payment_id text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  topup public.mkt_ad_credit_topups;
  wallet public.mkt_ad_credit_wallets;
  taken integer;
  shortfall integer;
  new_balance integer;
BEGIN
  SELECT * INTO topup FROM public.mkt_ad_credit_topups
   WHERE provider_payment_id = btrim(_payment_id) FOR UPDATE;
  IF topup.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  IF topup.status = 'refunded' THEN
    RETURN jsonb_build_object('found', true, 'already', true);
  END IF;
  IF topup.status <> 'approved' THEN
    RETURN jsonb_build_object('found', true, 'skipped', true);
  END IF;

  SELECT * INTO wallet FROM public.mkt_ad_credit_wallets WHERE id = topup.wallet_id FOR UPDATE;

  taken := LEAST(topup.credits, GREATEST(wallet.balance, 0));
  shortfall := topup.credits - taken;

  UPDATE public.mkt_ad_credit_wallets
     SET balance = balance - taken,
         total_purchased = GREATEST(total_purchased - topup.credits, 0)
   WHERE id = wallet.id
   RETURNING balance INTO new_balance;

  INSERT INTO public.mkt_ad_credit_entries
    (wallet_id, kind, status, amount, balance_after, payment_ref,
     reference_type, reference_id, note, actor_user_id)
  VALUES
    (wallet.id, 'refund', 'settled', -taken, new_balance, btrim(_payment_id),
     'topup', topup.id,
     COALESCE(NULLIF(btrim(COALESCE(_reason, '')), ''), 'refund')
       || CASE WHEN shortfall > 0
               THEN ' · تعذّر خصم ' || shortfall::text || ' رصيد لأنه استُهلك'
               ELSE '' END,
     NULL);

  UPDATE public.mkt_ad_credit_topups
     SET status = 'refunded',
         reject_reason = NULLIF(btrim(COALESCE(_reason, '')), ''),
         updated_at = now()
   WHERE id = topup.id;

  INSERT INTO public.mkt_notifications (user_id, event, title, body)
  VALUES (
    topup.requested_by,
    'ad_credit.topup_refunded',
    'تم استرجاع مبلغ شحن الرصيد',
    'خُصم ' || taken::text || ' رصيد من محفظتك مقابل الاسترجاع.'
      || CASE WHEN shortfall > 0
              THEN ' وتبقّى ' || shortfall::text || ' رصيد مستهلك سيتابعه فريق كَحيل.'
              ELSE '' END
  );

  RETURN jsonb_build_object('found', true, 'taken', taken, 'shortfall', shortfall, 'balance', new_balance);
END;
$function$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_card_start(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_card_start(integer, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_card_attach(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_card_attach(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_card_settle(text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_card_settle(text, text, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_card_fail(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_card_fail(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_card_refund(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_card_refund(text, text) TO service_role;