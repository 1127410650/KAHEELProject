CREATE TABLE public.mkt_ai_image_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  preset text,
  size_key text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  bytes integer NOT NULL DEFAULT 0,
  asset_path text,
  cost_credits numeric(10,4) NOT NULL DEFAULT 0,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.mkt_ai_image_jobs TO authenticated;
GRANT ALL ON public.mkt_ai_image_jobs TO service_role;
ALTER TABLE public.mkt_ai_image_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_image_jobs_admin_read" ON public.mkt_ai_image_jobs
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

CREATE INDEX mkt_ai_image_jobs_user_day_idx
  ON public.mkt_ai_image_jobs (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.mkt_ai_image_claim(
  _prompt text,
  _size_key text,
  _model text,
  _preset text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _daily_limit integer := 30;
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

  INSERT INTO public.mkt_ai_image_jobs (user_id, prompt, preset, size_key, model)
  VALUES (_uid, left(btrim(_prompt), 2000), _preset, _size_key, _model)
  RETURNING id INTO _job;

  RETURN jsonb_build_object(
    'job_id', _job,
    'used', _used + 1,
    'daily_limit', _daily_limit,
    'remaining', _daily_limit - _used - 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_ai_image_finish(
  _job_id uuid,
  _status text,
  _bytes integer DEFAULT 0,
  _asset_path text DEFAULT NULL,
  _cost numeric DEFAULT 0,
  _detail text DEFAULT NULL
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
      detail = COALESCE(left(_detail, 500), detail),
      finished_at = now()
  WHERE id = _job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ai_image_claim(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_ai_image_finish(uuid, text, integer, text, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_ai_image_claim(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_ai_image_finish(uuid, text, integer, text, numeric, text) TO authenticated;