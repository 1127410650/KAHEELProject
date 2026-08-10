CREATE OR REPLACE VIEW public.mkt_ai_usage
WITH (security_invoker = true) AS
SELECT
  j.id,
  j.capability      AS service,
  j.user_id         AS actor,
  j.purpose         AS action,
  j.cost_usd        AS cost_estimate,
  j.status,
  j.model,
  j.prompt,
  j.slot_key,
  j.created_at
FROM public.mkt_ai_image_jobs j;

GRANT SELECT ON public.mkt_ai_usage TO authenticated;
GRANT SELECT ON public.mkt_ai_usage TO service_role;

CREATE OR REPLACE FUNCTION public.mkt_ai_usage_recent(_service text DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  service text,
  actor uuid,
  actor_name text,
  action text,
  prompt text,
  status text,
  cost_estimate numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.id,
    j.capability,
    j.user_id,
    COALESCE(p.display_name, left(j.user_id::text, 8)),
    j.purpose,
    left(j.prompt, 140),
    j.status,
    j.cost_usd,
    j.created_at
  FROM public.mkt_ai_image_jobs j
  LEFT JOIN public.mkt_user_profiles p ON p.user_id = j.user_id
  WHERE public.mkt_is_platform_admin()
    AND (_service IS NULL OR j.capability = _service)
  ORDER BY j.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.mkt_ai_usage_recent(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_ai_usage_recent(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_ai_usage_recent(text, integer) TO service_role;