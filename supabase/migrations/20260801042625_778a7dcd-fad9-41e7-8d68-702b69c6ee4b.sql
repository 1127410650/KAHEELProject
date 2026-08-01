DO $$
DECLARE t text; d uuid;
  tables text[] := ARRAY[
    'projects','supervisors','suppliers','project_members','project_supervisors',
    'requests','request_messages','request_message_reads','request_status_history',
    'request_reminders','request_change_requests','request_field_versions',
    'attachments','notifications','custody_transactions',
    'invoices','invoice_line_items','invoice_status_history','invoice_verifications',
    'unified_products','product_catalog','product_aliases','product_unit_conversions','product_price_history',
    'property_land','property_boundaries','property_coordinates','property_deeds','property_owners',
    'property_licenses','property_license_components','property_units','property_unit_components',
    'property_partition_reports','property_contracts','property_plans',
    'property_services','property_service_results','property_documents','property_document_requests',
    'document_analyses','document_analysis_fields','document_analysis_conflicts','document_analysis_runs',
    'audit_log'
  ];
BEGIN
  SELECT id INTO d FROM public.tenants WHERE is_default LIMIT 1;
  IF d IS NULL THEN RAISE EXCEPTION 'DEFAULT_TENANT_MISSING'; END IF;

  ALTER TABLE public.requests DISABLE TRIGGER USER;
  ALTER TABLE public.request_status_history DISABLE TRIGGER USER;

  -- Project-less general requests inherit the creator's workspace.
  UPDATE public.requests r SET tenant_id = m.tenant_id
    FROM public.tenant_memberships m
   WHERE m.user_id = r.created_by AND r.tenant_id IS NULL;
  UPDATE public.requests SET tenant_id = d WHERE tenant_id IS NULL;
  UPDATE public.request_status_history h SET tenant_id = r.tenant_id
    FROM public.requests r WHERE r.id = h.request_id AND h.tenant_id IS NULL;

  ALTER TABLE public.requests ENABLE TRIGGER USER;
  ALTER TABLE public.request_status_history ENABLE TRIGGER USER;

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
  END LOOP;
END $$;