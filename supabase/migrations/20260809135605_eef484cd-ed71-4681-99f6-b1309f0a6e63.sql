-- `entry_id` was both a local variable and a column of the table being
-- updated, which makes `SET entry_id = entry_id` ambiguous at execution
-- time. Rename the variable so the approval links the top-up to its ledger
-- entry.
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
  v_entry_id uuid;
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
  RETURNING id INTO v_entry_id;

  UPDATE public.mkt_ad_credit_topups
     SET status = 'approved',
         credits = granted,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         entry_id = v_entry_id,
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