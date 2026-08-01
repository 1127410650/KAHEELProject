-- Attachments / property documents: same checks as before, plus the object's
-- owning project or request must belong to the caller's active workspace.
CREATE OR REPLACE FUNCTION public.can_access_attachment_object(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts text[]; pid uuid; doc public.property_documents;
  cur uuid; row_tenant uuid;
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL THEN RETURN false; END IF;
  parts := string_to_array(_path, '/');
  IF array_length(parts, 1) < 4 OR parts[1] NOT IN ('projects', 'requests') THEN RETURN false; END IF;
  BEGIN
    pid := parts[2]::uuid;
  EXCEPTION WHEN others THEN RETURN false;
  END;
  IF pid IS NULL THEN RETURN false; END IF;

  cur := public.current_tenant_id();
  IF cur IS NULL THEN RETURN false; END IF;

  -- Tenant gate first: the file's owning row must be inside the active workspace.
  IF parts[1] = 'projects' THEN
    SELECT p.tenant_id INTO row_tenant FROM public.projects p WHERE p.id = pid;
  ELSE
    SELECT r.tenant_id INTO row_tenant FROM public.requests r WHERE r.id = pid;
  END IF;
  IF row_tenant IS NULL OR row_tenant <> cur THEN RETURN false; END IF;

  -- Property document files follow the document row's visibility, not just project access.
  SELECT * INTO doc FROM public.property_documents
   WHERE storage_path = _path
   ORDER BY version DESC
   LIMIT 1;
  IF doc.id IS NOT NULL THEN
    IF doc.tenant_id IS DISTINCT FROM cur THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION public.can_access_invoice_object(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid; cur uuid; row_tenant uuid;
BEGIN
  IF auth.uid() IS NULL OR split_part(_name, '/', 1) <> 'invoices' THEN RETURN false; END IF;
  BEGIN
    v_id := (split_part(_name, '/', 2))::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  cur := public.current_tenant_id();
  IF cur IS NULL THEN RETURN false; END IF;

  SELECT i.tenant_id INTO row_tenant FROM public.invoices i WHERE i.id = v_id;
  IF row_tenant IS NULL OR row_tenant <> cur THEN RETURN false; END IF;

  RETURN public.can_view_invoice(v_id);
END;
$function$;