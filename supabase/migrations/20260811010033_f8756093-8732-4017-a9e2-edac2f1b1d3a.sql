CREATE TABLE public.mkt_ops_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  action text NOT NULL,
  unit text NOT NULL DEFAULT 'platform',
  entity text,
  entity_id uuid,
  summary text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX mkt_ops_log_at_idx ON public.mkt_ops_log (at DESC);
CREATE INDEX mkt_ops_log_actor_idx ON public.mkt_ops_log (actor_user_id, at DESC);
CREATE INDEX mkt_ops_log_entity_idx ON public.mkt_ops_log (entity, entity_id);

GRANT SELECT ON public.mkt_ops_log TO authenticated;
GRANT SELECT, INSERT ON public.mkt_ops_log TO service_role;

ALTER TABLE public.mkt_ops_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit viewers read ops log"
ON public.mkt_ops_log FOR SELECT TO authenticated
USING (public.mkt_admin_can('audit.view'));

-- append-only at the database level: no UPDATE/DELETE for anyone but a superuser
CREATE OR REPLACE FUNCTION public.mkt_ops_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION 'mkt_ops_log is append-only';
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ops_log_append_only() FROM PUBLIC, anon;

CREATE TRIGGER mkt_ops_log_no_update
BEFORE UPDATE ON public.mkt_ops_log
FOR EACH ROW EXECUTE FUNCTION public.mkt_ops_log_append_only();

CREATE TRIGGER mkt_ops_log_no_delete
BEFORE DELETE ON public.mkt_ops_log
FOR EACH ROW EXECUTE FUNCTION public.mkt_ops_log_append_only();

CREATE TRIGGER mkt_ops_log_no_truncate
BEFORE TRUNCATE ON public.mkt_ops_log
FOR EACH STATEMENT EXECUTE FUNCTION public.mkt_ops_log_append_only();

-- single write path; actor comes from the session, never from the caller
CREATE OR REPLACE FUNCTION public.mkt_ops_log_write(
  _action text,
  _unit text DEFAULT 'platform',
  _entity text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _summary text DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _action IS NULL OR length(btrim(_action)) = 0 THEN
    RAISE EXCEPTION 'action_required';
  END IF;
  INSERT INTO public.mkt_ops_log (actor_user_id, action, unit, entity, entity_id, summary, meta)
  VALUES (auth.uid(), btrim(_action), coalesce(_unit, 'platform'), _entity, _entity_id, _summary,
          coalesce(_meta, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ops_log_write(text, text, text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ops_log_write(text, text, text, uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_ops_log(
  _search text DEFAULT NULL,
  _unit text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  at timestamptz,
  actor_user_id uuid,
  action text,
  unit text,
  entity text,
  entity_id uuid,
  summary text,
  meta jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT l.id, l.at, l.actor_user_id, l.action, l.unit, l.entity, l.entity_id, l.summary, l.meta
  FROM public.mkt_ops_log l
  WHERE public.mkt_admin_can('audit.view')
    AND (_unit IS NULL OR l.unit = _unit)
    AND (_from IS NULL OR l.at >= _from)
    AND (_to IS NULL OR l.at <= _to)
    AND (
      _search IS NULL OR btrim(_search) = ''
      OR l.action ILIKE '%' || btrim(_search) || '%'
      OR coalesce(l.summary, '') ILIKE '%' || btrim(_search) || '%'
      OR coalesce(l.entity, '') ILIKE '%' || btrim(_search) || '%'
    )
  ORDER BY l.at DESC
  LIMIT greatest(1, least(coalesce(_limit, 100), 500)) OFFSET greatest(0, coalesce(_offset, 0))
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_ops_log(text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_ops_log(text, text, timestamptz, timestamptz, integer, integer) TO authenticated;

REVOKE ALL ON TABLE public.mkt_ops_log FROM anon;