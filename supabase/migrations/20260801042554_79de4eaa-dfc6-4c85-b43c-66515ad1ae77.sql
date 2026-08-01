-- ============================================================
-- Step 2: add tenant_id (nullable) everywhere + backfill + FK + index
-- ============================================================
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
    'audit_log','app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', t);
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I, ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT',
      t, t || '_tenant_fk', t || '_tenant_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', t || '_tenant_idx', t);
  END LOOP;

  -- Backfill must not fire business guards / audit triggers: it is a structural
  -- migration, not a user edit. Triggers are restored right after.
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Backfill, parent-first. Production is single-tenant today, so every
-- existing row derives to the default tenant through its parent chain.
-- ------------------------------------------------------------
DO $$
DECLARE d uuid;
BEGIN
  SELECT id INTO d FROM public.tenants WHERE is_default LIMIT 1;
  IF d IS NULL THEN RAISE EXCEPTION 'DEFAULT_TENANT_MISSING'; END IF;

  UPDATE public.projects       SET tenant_id = d WHERE tenant_id IS NULL;
  UPDATE public.supervisors    SET tenant_id = d WHERE tenant_id IS NULL;
  UPDATE public.suppliers      SET tenant_id = d WHERE tenant_id IS NULL;
  UPDATE public.unified_products SET tenant_id = d WHERE tenant_id IS NULL;

  UPDATE public.project_members pm SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = pm.project_id AND pm.tenant_id IS NULL;
  UPDATE public.project_supervisors ps SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = ps.project_id AND ps.tenant_id IS NULL;
  UPDATE public.property_land x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_boundaries x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_coordinates x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_deeds x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_owners x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_licenses x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_license_components x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_units x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_unit_components x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_partition_reports x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_contracts x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_plans x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_services x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_service_results x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_documents x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.property_document_requests x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.invoices x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.custody_transactions x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;

  UPDATE public.requests x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.requests x SET tenant_id = s.tenant_id FROM public.supervisors s WHERE s.id = x.supervisor_id AND x.tenant_id IS NULL;

  UPDATE public.invoices x SET tenant_id = s.tenant_id FROM public.suppliers s WHERE s.id = x.supplier_id AND x.tenant_id IS NULL;
  UPDATE public.custody_transactions x SET tenant_id = s.tenant_id FROM public.supervisors s WHERE s.id = x.supervisor_id AND x.tenant_id IS NULL;

  UPDATE public.request_messages x SET tenant_id = r.tenant_id FROM public.requests r WHERE r.id = x.request_id AND x.tenant_id IS NULL;
  UPDATE public.request_status_history x SET tenant_id = r.tenant_id FROM public.requests r WHERE r.id = x.request_id AND x.tenant_id IS NULL;
  UPDATE public.request_reminders x SET tenant_id = r.tenant_id FROM public.requests r WHERE r.id = x.request_id AND x.tenant_id IS NULL;
  UPDATE public.request_change_requests x SET tenant_id = r.tenant_id FROM public.requests r WHERE r.id = x.request_id AND x.tenant_id IS NULL;
  UPDATE public.request_field_versions x SET tenant_id = r.tenant_id FROM public.requests r WHERE r.id = x.request_id AND x.tenant_id IS NULL;
  UPDATE public.request_message_reads x SET tenant_id = m.tenant_id FROM public.request_messages m WHERE m.id = x.message_id AND x.tenant_id IS NULL;
  UPDATE public.notifications x SET tenant_id = r.tenant_id FROM public.requests r WHERE r.id = x.request_id AND x.tenant_id IS NULL;

  UPDATE public.invoice_line_items x SET tenant_id = i.tenant_id FROM public.invoices i WHERE i.id = x.invoice_id AND x.tenant_id IS NULL;
  UPDATE public.invoice_status_history x SET tenant_id = i.tenant_id FROM public.invoices i WHERE i.id = x.invoice_id AND x.tenant_id IS NULL;
  UPDATE public.invoice_verifications x SET tenant_id = i.tenant_id FROM public.invoices i WHERE i.id = x.invoice_id AND x.tenant_id IS NULL;

  UPDATE public.product_catalog x SET tenant_id = u.tenant_id FROM public.unified_products u WHERE u.id = x.unified_product_id AND x.tenant_id IS NULL;
  UPDATE public.product_catalog x SET tenant_id = s.tenant_id FROM public.suppliers s WHERE s.id = x.supplier_id AND x.tenant_id IS NULL;
  UPDATE public.product_aliases x SET tenant_id = u.tenant_id FROM public.unified_products u WHERE u.id = x.unified_product_id AND x.tenant_id IS NULL;
  UPDATE public.product_aliases x SET tenant_id = c.tenant_id FROM public.product_catalog c WHERE c.id = x.catalog_id AND x.tenant_id IS NULL;
  UPDATE public.product_unit_conversions x SET tenant_id = u.tenant_id FROM public.unified_products u WHERE u.id = x.unified_product_id AND x.tenant_id IS NULL;
  UPDATE public.product_price_history x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.product_price_history x SET tenant_id = i.tenant_id FROM public.invoices i WHERE i.id = x.invoice_id AND x.tenant_id IS NULL;
  UPDATE public.product_price_history x SET tenant_id = u.tenant_id FROM public.unified_products u WHERE u.id = x.unified_product_id AND x.tenant_id IS NULL;

  UPDATE public.attachments x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.attachments x SET tenant_id = r.tenant_id FROM public.requests r
   WHERE x.entity_type = 'request' AND r.id = x.entity_id AND x.tenant_id IS NULL;

  UPDATE public.document_analyses x SET tenant_id = p.tenant_id FROM public.projects p WHERE p.id = x.project_id AND x.tenant_id IS NULL;
  UPDATE public.document_analyses x SET tenant_id = pd.tenant_id FROM public.property_documents pd WHERE pd.id = x.document_id AND x.tenant_id IS NULL;
  UPDATE public.document_analysis_fields x SET tenant_id = a.tenant_id FROM public.document_analyses a WHERE a.id = x.analysis_id AND x.tenant_id IS NULL;
  UPDATE public.document_analysis_conflicts x SET tenant_id = a.tenant_id FROM public.document_analyses a WHERE a.id = x.analysis_id AND x.tenant_id IS NULL;
  UPDATE public.document_analysis_runs x SET tenant_id = a.tenant_id FROM public.document_analyses a WHERE a.id = x.analysis_id AND x.tenant_id IS NULL;

  UPDATE public.audit_log SET tenant_id = d WHERE tenant_id IS NULL;
END $$;

-- Restore every business guard / audit trigger.
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
    'audit_log','app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
  END LOOP;
END $$;

COMMENT ON COLUMN public.app_settings.tenant_id IS 'NULL = platform-level setting; otherwise scoped to that tenant.';