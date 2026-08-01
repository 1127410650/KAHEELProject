DO $$
DECLARE
  t text;
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
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_isolation', t);
    -- RESTRICTIVE: ANDed with every existing permissive policy, so module
    -- permissions stay exactly as they are and the tenant scope is added on top.
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I AS RESTRICTIVE TO authenticated
        USING (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    $f$, t || '_tenant_isolation', t);
  END LOOP;
END $$;