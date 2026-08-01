-- Active workspace for the current request: explicit selection wins, otherwise
-- the user's only membership. NULL when ambiguous (caller must be explicit).
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sel text; t uuid; n int;
BEGIN
  sel := nullif(current_setting('app.tenant_id', true), '');
  IF sel IS NOT NULL THEN
    BEGIN
      t := sel::uuid;
    EXCEPTION WHEN others THEN
      t := NULL;
    END;
    IF t IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
       WHERE m.tenant_id = t AND m.user_id = auth.uid() AND m.is_active
    ) THEN
      RETURN t;
    END IF;
  END IF;

  SELECT count(*), min(m.tenant_id) INTO n, t
    FROM public.tenant_memberships m
   WHERE m.user_id = auth.uid() AND m.is_active;
  IF n = 1 THEN RETURN t; END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

-- Generic autofill/validation. TG_ARGV pairs: fk_column, parent_table
CREATE OR REPLACE FUNCTION public.tenant_autofill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int := 0;
  fk_col text; parent text; fk_val uuid; parent_tenant uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'tenant_id_immutable';
    END IF;
    RETURN NEW;
  END IF;

  -- Derive from the parent row when a parent link is present.
  WHILE i < TG_NARGS LOOP
    fk_col := TG_ARGV[i];
    parent := TG_ARGV[i + 1];
    EXECUTE format('SELECT ($1).%I', fk_col) INTO fk_val USING NEW;
    IF fk_val IS NOT NULL THEN
      EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', parent)
        INTO parent_tenant USING fk_val;
      IF parent_tenant IS NOT NULL THEN
        IF NEW.tenant_id IS NULL THEN
          NEW.tenant_id := parent_tenant;
        ELSIF NEW.tenant_id <> parent_tenant THEN
          RAISE EXCEPTION 'tenant_mismatch_with_parent';
        END IF;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_required';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tenant_autofill() FROM PUBLIC, anon;

DO $$
DECLARE
  spec jsonb := '{
    "projects": [],
    "supervisors": [],
    "suppliers": [],
    "unified_products": [],
    "audit_log": [],
    "project_members": ["project_id","projects"],
    "project_supervisors": ["project_id","projects"],
    "requests": ["project_id","projects","supervisor_id","supervisors"],
    "request_messages": ["request_id","requests"],
    "request_status_history": ["request_id","requests"],
    "request_reminders": ["request_id","requests"],
    "request_change_requests": ["request_id","requests"],
    "request_field_versions": ["request_id","requests"],
    "request_message_reads": ["message_id","request_messages"],
    "notifications": ["request_id","requests"],
    "attachments": ["project_id","projects"],
    "custody_transactions": ["supervisor_id","supervisors","project_id","projects"],
    "invoices": ["project_id","projects","supplier_id","suppliers"],
    "invoice_line_items": ["invoice_id","invoices"],
    "invoice_status_history": ["invoice_id","invoices"],
    "invoice_verifications": ["invoice_id","invoices"],
    "product_catalog": ["unified_product_id","unified_products","supplier_id","suppliers"],
    "product_aliases": ["unified_product_id","unified_products"],
    "product_unit_conversions": ["unified_product_id","unified_products"],
    "product_price_history": ["project_id","projects","unified_product_id","unified_products"],
    "property_land": ["project_id","projects"],
    "property_boundaries": ["project_id","projects"],
    "property_coordinates": ["project_id","projects"],
    "property_deeds": ["project_id","projects"],
    "property_owners": ["project_id","projects"],
    "property_licenses": ["project_id","projects"],
    "property_license_components": ["project_id","projects"],
    "property_units": ["project_id","projects"],
    "property_unit_components": ["project_id","projects"],
    "property_partition_reports": ["project_id","projects"],
    "property_contracts": ["project_id","projects"],
    "property_plans": ["project_id","projects"],
    "property_services": ["project_id","projects"],
    "property_service_results": ["project_id","projects"],
    "property_documents": ["project_id","projects"],
    "property_document_requests": ["project_id","projects"],
    "document_analyses": ["project_id","projects","document_id","property_documents"],
    "document_analysis_fields": ["analysis_id","document_analyses"],
    "document_analysis_conflicts": ["analysis_id","document_analyses"],
    "document_analysis_runs": ["analysis_id","document_analyses"]
  }'::jsonb;
  tbl text; args text;
BEGIN
  FOR tbl IN SELECT jsonb_object_keys(spec) LOOP
    -- A default makes tenant_id optional for callers; the trigger fills the rest.
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id()', tbl);

    SELECT coalesce(string_agg(quote_literal(v), ','), '')
      INTO args
      FROM jsonb_array_elements_text(spec -> tbl) AS v;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_tenant_autofill', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tenant_autofill(%s)',
      tbl || '_tenant_autofill', tbl, args);
  END LOOP;
END $$;