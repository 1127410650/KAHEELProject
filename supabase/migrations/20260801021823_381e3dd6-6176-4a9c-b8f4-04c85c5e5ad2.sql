create or replace function public.can_access_attachment_object(_path text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
DECLARE parts text[]; pid uuid; doc public.property_documents;
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL THEN RETURN false; END IF;
  parts := string_to_array(_path, '/');
  IF array_length(parts, 1) < 4 OR parts[1] NOT IN ('projects', 'requests') THEN RETURN false; END IF;
  BEGIN
    pid := parts[2]::uuid;
  EXCEPTION WHEN others THEN RETURN false;
  END;
  IF pid IS NULL THEN RETURN false; END IF;

  -- Property document files follow the document row's visibility, not just project access.
  SELECT * INTO doc FROM public.property_documents
   WHERE storage_path = _path
   ORDER BY version DESC
   LIMIT 1;
  IF doc.id IS NOT NULL THEN
    RETURN public.is_accountant()
        OR (public.can_view_property_documents(doc.project_id)
            AND (
              doc.visibility = 'project_shared'
              OR (doc.visibility = 'requester_private' AND (doc.created_by = auth.uid() OR public.is_staff()))
              OR (doc.visibility = 'internal' AND public.is_staff())
              OR (doc.visibility = 'sensitive' AND public.has_perm('property_documents.manage'))
            ));
  END IF;

  IF parts[1] = 'projects' THEN
    RETURN public.is_accountant() OR public.can_access_project(pid);
  END IF;
  RETURN public.is_accountant() OR public.can_access_request(pid);
END $function$;