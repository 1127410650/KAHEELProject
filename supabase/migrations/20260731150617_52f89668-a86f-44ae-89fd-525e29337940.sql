CREATE OR REPLACE FUNCTION public.request_exists(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.requests r WHERE r.id = _request_id AND r.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.request_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_exists(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_exists(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.project_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_exists(uuid) TO authenticated;