-- ============================================================
-- Ad credit top-up methods: documented manual transfer (Sham Cash /
-- bank transfer) + a technically complete, deliberately inactive
-- online-gateway path (Stripe).
--
-- The wallet balance is still written by `mkt_ad_credit_*` definer
-- functions only. A top-up request is a *claim*: it stores what the
-- provider says it transferred plus a receipt image, and adds nothing
-- until a platform admin approves it. Approval reuses the existing
-- ledger (`mkt_ad_credit_entries`), so consumption and history are
-- unchanged.
-- ============================================================

CREATE TABLE public.mkt_ad_credit_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.mkt_ad_credit_wallets(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  method text NOT NULL,
  credits integer NOT NULL,
  amount numeric(14,2),
  currency text NOT NULL DEFAULT 'SYP',
  transfer_ref text,
  receipt_path text,
  sender_note text,
  status text NOT NULL DEFAULT 'pending',
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  entry_id uuid REFERENCES public.mkt_ad_credit_entries(id) ON DELETE SET NULL,
  -- Reserved for the online gateway. Written by a verified server-side
  -- callback only; never by the browser.
  provider text,
  provider_session_id text,
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_ad_credit_topups_method_chk
    CHECK (method IN ('sham_cash','bank_transfer','card_gateway')),
  CONSTRAINT mkt_ad_credit_topups_status_chk
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT mkt_ad_credit_topups_credits_chk
    CHECK (credits > 0 AND credits <= 1000000),
  CONSTRAINT mkt_ad_credit_topups_amount_chk
    CHECK (amount IS NULL OR (amount > 0 AND amount <= 1000000000)),
  CONSTRAINT mkt_ad_credit_topups_currency_chk
    CHECK (currency IN ('SYP','SAR','USD','TRY')),
  CONSTRAINT mkt_ad_credit_topups_transfer_ref_chk
    CHECK (transfer_ref IS NULL OR char_length(btrim(transfer_ref)) BETWEEN 3 AND 80),
  CONSTRAINT mkt_ad_credit_topups_receipt_chk
    CHECK (receipt_path IS NULL OR receipt_path LIKE 'ad-credit/%'),
  CONSTRAINT mkt_ad_credit_topups_note_chk
    CHECK (sender_note IS NULL OR char_length(sender_note) <= 500),
  CONSTRAINT mkt_ad_credit_topups_reject_chk
    CHECK (status <> 'rejected' OR char_length(btrim(coalesce(reject_reason,''))) >= 3),
  -- A manual transfer must be evidenced; the gateway path is evidenced by
  -- the provider payment id instead.
  CONSTRAINT mkt_ad_credit_topups_manual_evidence_chk
    CHECK (
      method = 'card_gateway'
      OR (transfer_ref IS NOT NULL AND amount IS NOT NULL)
    )
);

CREATE INDEX mkt_ad_credit_topups_wallet_idx
  ON public.mkt_ad_credit_topups (wallet_id, created_at DESC);
CREATE INDEX mkt_ad_credit_topups_pending_idx
  ON public.mkt_ad_credit_topups (created_at DESC) WHERE status = 'pending';
-- One transfer receipt can only fund one top-up.
CREATE UNIQUE INDEX mkt_ad_credit_topups_ref_key
  ON public.mkt_ad_credit_topups (method, lower(btrim(transfer_ref)))
  WHERE transfer_ref IS NOT NULL AND status <> 'cancelled';

GRANT SELECT ON public.mkt_ad_credit_topups TO authenticated;
GRANT ALL ON public.mkt_ad_credit_topups TO service_role;

ALTER TABLE public.mkt_ad_credit_topups ENABLE ROW LEVEL SECURITY;

-- Reads: the provider sees only its own wallet's requests.
CREATE POLICY "mkt_ad_credit_topups_owner_read"
  ON public.mkt_ad_credit_topups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_ad_credit_wallets w
      WHERE w.id = mkt_ad_credit_topups.wallet_id
        AND (
          (w.tenant_id IS NULL AND w.owner_user_id = auth.uid())
          OR (w.tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(w.tenant_id))
        )
    )
  );

CREATE POLICY "mkt_ad_credit_topups_admin_read"
  ON public.mkt_ad_credit_topups FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage'));

-- No INSERT / UPDATE / DELETE policy: every write goes through the definer
-- functions below, so a client can never set its own status, credits or
-- reviewer.

CREATE TRIGGER mkt_ad_credit_topups_updated_at
  BEFORE UPDATE ON public.mkt_ad_credit_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- receipts in mkt-media (staff read) ----------
CREATE OR REPLACE FUNCTION app_private.mkt_ad_credit_receipt_staff_can_read(_storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL
      OR NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage'))
      THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.mkt_ad_credit_topups t
      WHERE t.receipt_path = _storage_path
    )
  END;
$function$;

REVOKE ALL ON FUNCTION app_private.mkt_ad_credit_receipt_staff_can_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mkt_ad_credit_receipt_staff_can_read(text)
  TO authenticated, service_role;

DROP POLICY IF EXISTS mkt_ad_credit_receipts_staff_read ON storage.objects;
CREATE POLICY mkt_ad_credit_receipts_staff_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND (storage.foldername(name))[1] = 'ad-credit'
    AND app_private.mkt_ad_credit_receipt_staff_can_read(name)
  );

-- ---------- platform wallet details shown to the provider ----------
INSERT INTO public.mkt_platform_settings (key, section, value, description_ar)
VALUES (
  'ad_credit.sham_cash',
  'ad_credit',
  jsonb_build_object(
    'enabled', true,
    'wallet_id', '',
    'wallet_name', '',
    'instructions_ar', '',
    'instructions_en', ''
  ),
  'بيانات محفظة شام كاش التي يحوّل إليها المزود لشحن رصيد الإعلانات'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.mkt_platform_settings (key, section, value, description_ar)
VALUES (
  'ad_credit.card_gateway',
  'ad_credit',
  jsonb_build_object('enabled', false, 'provider', 'stripe'),
  'بوابة الدفع الإلكتروني لرصيد الإعلانات — معطّلة حتى ربط مفاتيح المزود'
)
ON CONFLICT (key) DO NOTHING;

-- The settings table is staff-read only; providers need the payment details
-- (and nothing else from it), so expose exactly those keys.
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_methods()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE
    jsonb_build_object(
      'sham_cash', COALESCE((SELECT value FROM public.mkt_platform_settings WHERE key = 'ad_credit.sham_cash'), '{}'::jsonb),
      'card_gateway', COALESCE((SELECT value FROM public.mkt_platform_settings WHERE key = 'ad_credit.card_gateway'), '{}'::jsonb)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_methods() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_methods() TO authenticated;

-- ---------- provider: submit a top-up claim ----------
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_submit(
  _method text,
  _credits integer,
  _amount numeric,
  _currency text DEFAULT 'SYP',
  _transfer_ref text DEFAULT NULL,
  _receipt_path text DEFAULT NULL,
  _sender_note text DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  wallet public.mkt_ad_credit_wallets;
  topup_id uuid;
  gateway_on boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _method NOT IN ('sham_cash','bank_transfer','card_gateway') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;

  IF _method = 'card_gateway' THEN
    SELECT COALESCE((value->>'enabled')::boolean, false) INTO gateway_on
      FROM public.mkt_platform_settings WHERE key = 'ad_credit.card_gateway';
    IF NOT COALESCE(gateway_on, false) THEN
      RAISE EXCEPTION 'gateway_disabled';
    END IF;
  ELSE
    IF _transfer_ref IS NULL OR char_length(btrim(_transfer_ref)) < 3 THEN
      RAISE EXCEPTION 'transfer_ref_required';
    END IF;
    IF _amount IS NULL OR _amount <= 0 THEN
      RAISE EXCEPTION 'amount_required';
    END IF;
  END IF;

  IF _credits IS NULL OR _credits <= 0 OR _credits > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _receipt_path IS NOT NULL AND _receipt_path NOT LIKE ('ad-credit/' || auth.uid()::text || '/%') THEN
    RAISE EXCEPTION 'invalid_receipt_path';
  END IF;

  wallet := public.mkt_ad_credit_wallet(_tenant_id);

  -- One open claim at a time keeps the review queue honest.
  IF EXISTS (
    SELECT 1 FROM public.mkt_ad_credit_topups
    WHERE wallet_id = wallet.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending_topup_exists';
  END IF;

  INSERT INTO public.mkt_ad_credit_topups
    (wallet_id, requested_by, method, credits, amount, currency,
     transfer_ref, receipt_path, sender_note,
     provider, status)
  VALUES
    (wallet.id, auth.uid(), _method, _credits,
     _amount, COALESCE(NULLIF(btrim(_currency), ''), 'SYP'),
     NULLIF(btrim(_transfer_ref), ''), _receipt_path, NULLIF(btrim(_sender_note), ''),
     CASE WHEN _method = 'card_gateway' THEN 'stripe' ELSE NULL END,
     'pending')
  RETURNING id INTO topup_id;

  RETURN topup_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_submit(text, integer, numeric, text, text, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_submit(text, integer, numeric, text, text, text, text, uuid)
  TO authenticated;

-- ---------- provider: withdraw an unreviewed claim ----------
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_cancel(_topup_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.mkt_ad_credit_topups t
     SET status = 'cancelled'
   WHERE t.id = _topup_id
     AND t.status = 'pending'
     AND EXISTS (
       SELECT 1 FROM public.mkt_ad_credit_wallets w
       WHERE w.id = t.wallet_id
         AND (
           (w.tenant_id IS NULL AND w.owner_user_id = auth.uid())
           OR (w.tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(w.tenant_id))
         )
     );
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN
    RAISE EXCEPTION 'topup_not_pending';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_cancel(uuid) TO authenticated;

-- ---------- admin: approve or reject ----------
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_topup_review(
  _topup_id uuid,
  _approve boolean,
  _reject_reason text DEFAULT NULL,
  _payment_ref text DEFAULT NULL,
  _credits_override integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  topup public.mkt_ad_credit_topups;
  wallet public.mkt_ad_credit_wallets;
  granted integer;
  new_balance integer;
  entry_id uuid;
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO topup FROM public.mkt_ad_credit_topups
   WHERE id = _topup_id AND status = 'pending' FOR UPDATE;
  IF topup.id IS NULL THEN
    RAISE EXCEPTION 'topup_not_pending';
  END IF;

  SELECT * INTO wallet FROM public.mkt_ad_credit_wallets WHERE id = topup.wallet_id FOR UPDATE;
  IF wallet.id IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  IF NOT _approve THEN
    IF _reject_reason IS NULL OR char_length(btrim(_reject_reason)) < 3 THEN
      RAISE EXCEPTION 'reject_reason_required';
    END IF;

    UPDATE public.mkt_ad_credit_topups
       SET status = 'rejected',
           reject_reason = btrim(_reject_reason),
           reviewed_by = auth.uid(),
           reviewed_at = now()
     WHERE id = _topup_id;

    INSERT INTO public.mkt_notifications (user_id, event, title, body)
    VALUES (
      topup.requested_by,
      'ad_credit.topup_rejected',
      'تعذّر اعتماد طلب شحن رصيد الإعلانات',
      btrim(_reject_reason)
    );

    RETURN wallet.balance;
  END IF;

  granted := COALESCE(_credits_override, topup.credits);
  IF granted <= 0 OR granted > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.mkt_ad_credit_wallets
     SET balance = balance + granted,
         total_purchased = total_purchased + granted
   WHERE id = wallet.id
   RETURNING balance INTO new_balance;

  INSERT INTO public.mkt_ad_credit_entries
    (wallet_id, kind, status, amount, balance_after, price_sar,
     payment_ref, reference_type, reference_id, note, actor_user_id)
  VALUES
    (wallet.id, 'purchase', 'settled', granted, new_balance,
     CASE WHEN topup.currency = 'SAR' THEN topup.amount ELSE NULL END,
     COALESCE(NULLIF(btrim(COALESCE(_payment_ref, '')), ''), topup.transfer_ref, topup.provider_payment_id),
     'topup', topup.id,
     topup.method || COALESCE(' · ' || topup.amount::text || ' ' || topup.currency, ''),
     auth.uid())
  RETURNING id INTO entry_id;

  UPDATE public.mkt_ad_credit_topups
     SET status = 'approved',
         credits = granted,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         entry_id = entry_id,
         reject_reason = NULL
   WHERE id = _topup_id;

  INSERT INTO public.mkt_notifications (user_id, event, title, body)
  VALUES (
    topup.requested_by,
    'ad_credit.topup_approved',
    'تم اعتماد شحن رصيد الإعلانات',
    'أُضيف ' || granted::text || ' رصيد إلى محفظتك.'
  );

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_topup_review(uuid, boolean, text, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_topup_review(uuid, boolean, text, text, integer)
  TO authenticated;

COMMENT ON TABLE public.mkt_ad_credit_topups IS
  'Ad credit top-up claims. Manual methods (Sham Cash / bank transfer) are evidenced by a transfer reference plus a receipt in mkt-media under ad-credit/<uid>/ and require admin approval; card_gateway rows are reserved for the online provider path, which stays disabled until API keys are configured.';