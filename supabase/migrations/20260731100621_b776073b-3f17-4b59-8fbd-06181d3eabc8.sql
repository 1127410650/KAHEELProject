CREATE OR REPLACE FUNCTION public.can_access_attachment_object(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[];
  pid uuid;
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL THEN
    RETURN false;
  END IF;

  parts := string_to_array(_path, '/');
  -- expected: projects/<project_id>/<attachment_id>/<file_name>
  IF array_length(parts, 1) < 4 OR parts[1] <> 'projects' THEN
    RETURN false;
  END IF;

  BEGIN
    pid := parts[2]::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF pid IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.is_accountant() OR public.can_access_project(pid);
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_attachment_object(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_object(text) TO authenticated, service_role;

DROP POLICY IF EXISTS attachments_storage_read ON storage.objects;
DROP POLICY IF EXISTS attachments_storage_insert ON storage.objects;
DROP POLICY IF EXISTS attachments_storage_update ON storage.objects;
DROP POLICY IF EXISTS attachments_storage_select_project_access ON storage.objects;
DROP POLICY IF EXISTS attachments_storage_insert_project_access ON storage.objects;
DROP POLICY IF EXISTS attachments_storage_update_accountant ON storage.objects;
DROP POLICY IF EXISTS attachments_storage_delete_accountant ON storage.objects;

CREATE POLICY attachments_storage_select_project_access
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments' AND public.can_access_attachment_object(name));

CREATE POLICY attachments_storage_insert_project_access
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND owner = auth.uid()
  AND public.can_access_attachment_object(name)
);

CREATE POLICY attachments_storage_update_accountant
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'attachments' AND public.is_accountant())
WITH CHECK (
  bucket_id = 'attachments'
  AND public.is_accountant()
  AND public.can_access_attachment_object(name)
);

CREATE POLICY attachments_storage_delete_accountant
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND public.is_accountant());