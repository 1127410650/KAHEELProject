-- 1) Price/currency/unit hardening (runs last: zzz_ trigger).
CREATE OR REPLACE FUNCTION public.mkt_enforce_listing_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_currency text;
BEGIN
  NEW.price_on_request := false;

  IF NEW.price IS NOT NULL THEN
    IF NEW.price <= 0 THEN RAISE EXCEPTION 'PRICE_INVALID'; END IF;
    IF NEW.price > 999999999999 THEN RAISE EXCEPTION 'PRICE_TOO_LARGE'; END IF;
  END IF;

  IF NEW.status IN ('pending','published') AND NEW.price IS NULL THEN
    RAISE EXCEPTION 'PRICE_REQUIRED';
  END IF;

  -- Optional unit, but only from the approved list.
  IF NEW.price_unit IS NOT NULL THEN
    NEW.price_unit := btrim(NEW.price_unit);
    IF NEW.price_unit = '' THEN
      NEW.price_unit := NULL;
    ELSIF NEW.price_unit NOT IN ('hour','day','week','month','year','piece','meter',
                                 'sqm','ton','kg','litre','trip','service') THEN
      RAISE EXCEPTION 'PRICE_UNIT_INVALID';
    END IF;
  END IF;

  -- Currency is always re-derived from the (server-forced) listing country here,
  -- after mkt_listing_validate has reset country_id to the account country.
  IF NEW.country_id IS NOT NULL THEN
    SELECT currency_code INTO v_currency FROM public.mkt_countries WHERE id = NEW.country_id;
    IF v_currency IS NOT NULL THEN NEW.currency := v_currency; END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- currency is frozen once published
    IF OLD.published_at IS NOT NULL AND NEW.currency IS DISTINCT FROM OLD.currency THEN
      NEW.currency := OLD.currency;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

-- 2) Call history: owner only, plus an explicit security/support permission.
DROP POLICY IF EXISTS mkt_calls_read_own ON public.mkt_calls;
CREATE POLICY mkt_calls_read_own ON public.mkt_calls
  FOR SELECT TO authenticated
  USING (
    caller_user_id = auth.uid()
    OR callee_user_id = auth.uid()
    OR public.mkt_staff_has('calls.audit_view')
  );

-- 3) Sweep stale calls and expired signalling data every minute.
SELECT cron.unschedule('mkt_calls_sweep')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mkt_calls_sweep');
SELECT cron.schedule('mkt_calls_sweep', '* * * * *', $$SELECT public.mkt_calls_sweep();$$);