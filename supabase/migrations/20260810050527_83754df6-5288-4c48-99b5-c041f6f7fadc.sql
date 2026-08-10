ALTER TABLE public.mkt_ai_image_jobs
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS slot_key text;

CREATE INDEX IF NOT EXISTS mkt_ai_image_jobs_created_idx
  ON public.mkt_ai_image_jobs (created_at DESC);

-- السقف الشهري بالدولار: يُقرأ من إعدادات المنصة ويُقيَّد بين 0 و 5000.
CREATE OR REPLACE FUNCTION public.mkt_ai_image_monthly_cap()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(GREATEST(
    COALESCE((SELECT (value->>'monthly_usd')::numeric
              FROM public.mkt_platform_settings
              WHERE key = 'ai_image.budget'), 100), 0), 5000);
$$;

CREATE OR REPLACE FUNCTION public.mkt_ai_image_budget()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cap numeric := public.mkt_ai_image_monthly_cap();
  _spent numeric := 0;
  _count integer := 0;
  _daily integer := 0;
BEGIN
  IF _uid IS NULL OR NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(sum(cost_usd), 0), count(*)
    INTO _spent, _count
  FROM public.mkt_ai_image_jobs
  WHERE status <> 'failed'
    AND created_at >= date_trunc('month', (now() AT TIME ZONE 'Asia/Riyadh')) AT TIME ZONE 'Asia/Riyadh';

  SELECT count(*) INTO _daily
  FROM public.mkt_ai_image_jobs
  WHERE user_id = _uid
    AND status <> 'failed'
    AND created_at >= now() - interval '24 hours';

  RETURN jsonb_build_object(
    'monthly_usd', _cap,
    'spent_usd', round(_spent, 4),
    'remaining_usd', round(GREATEST(_cap - _spent, 0), 4),
    'count', _count,
    'daily_limit', 30,
    'daily_used', _daily,
    'blocked', (_spent >= _cap)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_ai_image_set_budget(_usd numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next numeric := LEAST(GREATEST(COALESCE(_usd, 100), 0), 5000);
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.mkt_platform_settings (key, value)
  VALUES ('ai_image.budget', jsonb_build_object('monthly_usd', _next))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RETURN _next;
END;
$$;

DROP FUNCTION IF EXISTS public.mkt_ai_image_claim(text, text, text, text);
CREATE FUNCTION public.mkt_ai_image_claim(
  _prompt text,
  _size_key text,
  _model text,
  _preset text DEFAULT NULL,
  _purpose text DEFAULT NULL,
  _slot_key text DEFAULT NULL,
  _unit_usd numeric DEFAULT 0.02
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _daily_limit integer := 30;
  _unit numeric := LEAST(GREATEST(COALESCE(_unit_usd, 0.02), 0), 5);
  _cap numeric := public.mkt_ai_image_monthly_cap();
  _spent numeric;
  _used integer;
  _job uuid;
BEGIN
  IF _uid IS NULL OR NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _prompt IS NULL OR length(btrim(_prompt)) < 4 THEN
    RAISE EXCEPTION 'invalid_prompt';
  END IF;

  SELECT count(*) INTO _used
  FROM public.mkt_ai_image_jobs
  WHERE user_id = _uid
    AND created_at >= (now() - interval '24 hours')
    AND status <> 'failed';

  IF _used >= _daily_limit THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;

  SELECT COALESCE(sum(cost_usd), 0) INTO _spent
  FROM public.mkt_ai_image_jobs
  WHERE status <> 'failed'
    AND created_at >= date_trunc('month', (now() AT TIME ZONE 'Asia/Riyadh')) AT TIME ZONE 'Asia/Riyadh';

  IF _spent + _unit > _cap THEN
    RAISE EXCEPTION 'monthly_budget_reached';
  END IF;

  INSERT INTO public.mkt_ai_image_jobs
    (user_id, prompt, preset, size_key, model, purpose, slot_key, cost_usd)
  VALUES
    (_uid, left(btrim(_prompt), 2000), _preset, _size_key, _model,
     left(_purpose, 40), left(_slot_key, 120), _unit)
  RETURNING id INTO _job;

  RETURN jsonb_build_object(
    'job_id', _job,
    'used', _used + 1,
    'daily_limit', _daily_limit,
    'remaining', _daily_limit - _used - 1,
    'monthly_usd', _cap,
    'spent_usd', round(_spent + _unit, 4),
    'remaining_usd', round(GREATEST(_cap - _spent - _unit, 0), 4)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.mkt_ai_image_finish(uuid, text, integer, text, numeric, text);
CREATE FUNCTION public.mkt_ai_image_finish(
  _job_id uuid,
  _status text,
  _bytes integer DEFAULT 0,
  _asset_path text DEFAULT NULL,
  _cost numeric DEFAULT 0,
  _detail text DEFAULT NULL,
  _cost_usd numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _status NOT IN ('generated', 'failed', 'approved') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.mkt_ai_image_jobs
  SET status = _status,
      bytes = GREATEST(COALESCE(_bytes, 0), bytes),
      asset_path = COALESCE(_asset_path, asset_path),
      cost_credits = GREATEST(COALESCE(_cost, 0), cost_credits),
      cost_usd = CASE
        WHEN _status = 'failed' THEN 0
        WHEN _cost_usd IS NOT NULL THEN LEAST(GREATEST(_cost_usd, 0), 5)
        ELSE cost_usd
      END,
      detail = COALESCE(left(_detail, 500), detail),
      finished_at = now()
  WHERE id = _job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ai_image_monthly_cap() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_image_budget() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_image_set_budget(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_image_claim(text, text, text, text, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_image_finish(uuid, text, integer, text, numeric, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ai_image_budget() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_ai_image_set_budget(numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_ai_image_claim(text, text, text, text, text, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_ai_image_finish(uuid, text, integer, text, numeric, text, numeric) TO authenticated, service_role;