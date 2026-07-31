CREATE OR REPLACE FUNCTION public.can_access_attachment_object(_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[]; pid uuid;
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL THEN RETURN false; END IF;
  parts := string_to_array(_path, '/');
  IF array_length(parts, 1) < 4 OR parts[1] NOT IN ('projects', 'requests') THEN RETURN false; END IF;
  BEGIN
    pid := parts[2]::uuid;
  EXCEPTION WHEN others THEN RETURN false;
  END;
  IF pid IS NULL THEN RETURN false; END IF;
  IF parts[1] = 'projects' THEN
    RETURN public.is_accountant() OR public.can_access_project(pid);
  END IF;
  RETURN public.is_accountant() OR public.can_access_request(pid);
END $$;
REVOKE ALL ON FUNCTION public.can_access_attachment_object(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_object(text) TO authenticated, service_role;