-- سعر الصرف اليدوي: دالة إدارية واحدة تعتمد سعرًا جديدًا وتُلغي القديم.
CREATE OR REPLACE FUNCTION public.mkt_admin_set_usd_rate(_rate numeric, _reason text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
BEGIN
  SELECT public.mkt_is_platform_admin() INTO v_admin;
  IF NOT coalesce(v_admin, false) THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  IF _rate IS NULL OR _rate <= 0 OR _rate > 1000000 THEN
    RAISE EXCEPTION 'BAD_RATE';
  END IF;

  UPDATE public.mkt_realestate_exchange_rates
     SET is_active = false, updated_at = now()
   WHERE base_currency = 'USD' AND quote_currency = 'SYP' AND is_active = true;

  INSERT INTO public.mkt_realestate_exchange_rates (base_currency, quote_currency, rate, is_active, note)
  VALUES ('USD', 'SYP', _rate, true, nullif(btrim(coalesce(_reason, '')), ''));

  RETURN _rate;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_set_usd_rate(numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_set_usd_rate(numeric, text) TO authenticated;