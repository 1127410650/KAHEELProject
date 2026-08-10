ALTER TABLE public.mkt_ai_image_jobs
  ADD COLUMN IF NOT EXISTS capability text NOT NULL DEFAULT 'generation';

ALTER TABLE public.mkt_ai_image_jobs
  DROP CONSTRAINT IF EXISTS mkt_ai_image_jobs_capability_chk;
ALTER TABLE public.mkt_ai_image_jobs
  ADD CONSTRAINT mkt_ai_image_jobs_capability_chk
  CHECK (capability IN ('generation', 'enhancement'));

CREATE INDEX IF NOT EXISTS mkt_ai_image_jobs_capability_idx
  ON public.mkt_ai_image_jobs (capability, created_at DESC);

CREATE OR REPLACE FUNCTION public.mkt_ai_capability_cap(_capability text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(GREATEST(
    COALESCE((SELECT (value->>'monthly_usd')::numeric
              FROM public.mkt_platform_settings
              WHERE key = CASE WHEN _capability = 'enhancement'
                               THEN 'ai_enhance.budget' ELSE 'ai_image.budget' END), 100), 0), 5000);
$$;

CREATE OR REPLACE FUNCTION public.mkt_ai_set_capability_budget(_capability text, _usd numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next numeric := LEAST(GREATEST(COALESCE(_usd, 100), 0), 5000);
  _key text := CASE WHEN _capability = 'enhancement' THEN 'ai_enhance.budget' ELSE 'ai_image.budget' END;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.mkt_platform_settings (key, value)
  VALUES (_key, jsonb_build_object('monthly_usd', _next))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RETURN _next;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_ai_spend_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start timestamptz := date_trunc('month', (now() AT TIME ZONE 'Asia/Riyadh')) AT TIME ZONE 'Asia/Riyadh';
  _rows jsonb := '[]'::jsonb;
  _cap numeric;
  _spent numeric;
  _count integer;
  _cap_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  FOREACH _cap_name IN ARRAY ARRAY['generation', 'enhancement'] LOOP
    _cap := public.mkt_ai_capability_cap(_cap_name);
    SELECT COALESCE(sum(cost_usd), 0), count(*)
      INTO _spent, _count
    FROM public.mkt_ai_image_jobs
    WHERE capability = _cap_name
      AND status <> 'failed'
      AND created_at >= _start;

    _rows := _rows || jsonb_build_array(jsonb_build_object(
      'capability', _cap_name,
      'monthly_usd', _cap,
      'spent_usd', round(_spent, 4),
      'remaining_usd', round(GREATEST(_cap - _spent, 0), 4),
      'count', _count,
      'blocked', (_spent >= _cap)
    ));
  END LOOP;

  RETURN jsonb_build_object('month_start', _start, 'capabilities', _rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_ai_enhance_claim(
  _provider text,
  _purpose text DEFAULT NULL,
  _slot_key text DEFAULT NULL,
  _unit_usd numeric DEFAULT 0.01
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _unit numeric := LEAST(GREATEST(COALESCE(_unit_usd, 0.01), 0), 5);
  _cap numeric := public.mkt_ai_capability_cap('enhancement');
  _spent numeric;
  _daily integer;
  _job uuid;
BEGIN
  IF _uid IS NULL OR NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT count(*) INTO _daily
  FROM public.mkt_ai_image_jobs
  WHERE user_id = _uid
    AND capability = 'enhancement'
    AND status <> 'failed'
    AND created_at >= now() - interval '24 hours';

  IF _daily >= 200 THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;

  SELECT COALESCE(sum(cost_usd), 0) INTO _spent
  FROM public.mkt_ai_image_jobs
  WHERE capability = 'enhancement'
    AND status <> 'failed'
    AND created_at >= date_trunc('month', (now() AT TIME ZONE 'Asia/Riyadh')) AT TIME ZONE 'Asia/Riyadh';

  IF _spent + _unit > _cap THEN
    RAISE EXCEPTION 'monthly_budget_reached';
  END IF;

  INSERT INTO public.mkt_ai_image_jobs
    (user_id, prompt, size_key, model, purpose, slot_key, cost_usd, capability)
  VALUES
    (_uid, 'image enhancement', 'enhance', left(COALESCE(_provider, 'local'), 60),
     left(_purpose, 40), left(_slot_key, 120), _unit, 'enhancement')
  RETURNING id INTO _job;

  RETURN jsonb_build_object(
    'job_id', _job,
    'daily_used', _daily + 1,
    'daily_limit', 200,
    'monthly_usd', _cap,
    'spent_usd', round(_spent + _unit, 4),
    'remaining_usd', round(GREATEST(_cap - _spent - _unit, 0), 4)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ai_capability_cap(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_set_capability_budget(text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_spend_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_ai_enhance_claim(text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ai_capability_cap(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_ai_set_capability_budget(text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_ai_spend_summary() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_ai_enhance_claim(text, text, text, numeric) TO authenticated, service_role;