CREATE TABLE public.mkt_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  kind text NOT NULL,
  unit text NOT NULL DEFAULT 'platform',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  reason text NOT NULL
);

CREATE INDEX mkt_export_log_at_idx ON public.mkt_export_log (at DESC);
CREATE INDEX mkt_export_log_actor_idx ON public.mkt_export_log (actor_user_id, at DESC);

GRANT SELECT ON public.mkt_export_log TO authenticated;
GRANT SELECT, INSERT ON public.mkt_export_log TO service_role;
REVOKE ALL ON TABLE public.mkt_export_log FROM anon;

ALTER TABLE public.mkt_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit viewers read export log"
ON public.mkt_export_log FOR SELECT TO authenticated
USING (public.mkt_admin_can('audit.view'));

CREATE TRIGGER mkt_export_log_no_update
BEFORE UPDATE ON public.mkt_export_log
FOR EACH ROW EXECUTE FUNCTION public.mkt_ops_log_append_only();

CREATE TRIGGER mkt_export_log_no_delete
BEFORE DELETE ON public.mkt_export_log
FOR EACH ROW EXECUTE FUNCTION public.mkt_ops_log_append_only();

CREATE OR REPLACE FUNCTION public.mkt_admin_export_record(
  _kind text,
  _reason text,
  _unit text DEFAULT 'platform',
  _filters jsonb DEFAULT '{}'::jsonb,
  _row_count integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
  v_today integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.mkt_admin_can('data.export') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _kind IS NULL OR length(btrim(_kind)) = 0 THEN
    RAISE EXCEPTION 'kind_required';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT count(*) INTO v_today
  FROM public.mkt_export_log e
  WHERE e.actor_user_id = auth.uid() AND e.at >= now() - interval '1 day';

  IF v_today >= 20 THEN
    RAISE EXCEPTION 'daily_export_limit_reached';
  END IF;

  INSERT INTO public.mkt_export_log (actor_user_id, kind, unit, filters, row_count, reason)
  VALUES (auth.uid(), btrim(_kind), coalesce(_unit, 'platform'), coalesce(_filters, '{}'::jsonb),
          greatest(0, coalesce(_row_count, 0)), btrim(_reason))
  RETURNING id INTO v_id;

  PERFORM public.mkt_ops_log_write(
    'data.exported',
    coalesce(_unit, 'platform'),
    'export',
    v_id,
    btrim(_kind) || ' — ' || btrim(_reason),
    jsonb_build_object('row_count', greatest(0, coalesce(_row_count, 0)), 'filters', coalesce(_filters, '{}'::jsonb))
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_export_record(text, text, text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_export_record(text, text, text, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_export_log(
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  at timestamptz,
  actor_user_id uuid,
  kind text,
  unit text,
  filters jsonb,
  row_count integer,
  reason text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT e.id, e.at, e.actor_user_id, e.kind, e.unit, e.filters, e.row_count, e.reason
  FROM public.mkt_export_log e
  WHERE public.mkt_admin_can('audit.view')
  ORDER BY e.at DESC
  LIMIT greatest(1, least(coalesce(_limit, 100), 500)) OFFSET greatest(0, coalesce(_offset, 0))
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_export_log(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_export_log(integer, integer) TO authenticated;