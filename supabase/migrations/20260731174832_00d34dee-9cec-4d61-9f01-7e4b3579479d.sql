-- ============ 1. invoices extra fields ============
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS zatca_uuid text,
  ADD COLUMN IF NOT EXISTS qr_hash text,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS seller_name_raw text,
  ADD COLUMN IF NOT EXISTS seller_vat_number text,
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS lines_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_zatca_uuid_unique
  ON public.invoices (zatca_uuid)
  WHERE zatca_uuid IS NOT NULL AND deleted_at IS NULL AND duplicate_reason IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_qr_hash_unique
  ON public.invoices (qr_hash)
  WHERE qr_hash IS NOT NULL AND deleted_at IS NULL AND duplicate_reason IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_file_hash_unique
  ON public.invoices (file_hash)
  WHERE file_hash IS NOT NULL AND deleted_at IS NULL AND duplicate_reason IS NULL;

CREATE OR REPLACE FUNCTION public.invoices_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_is_acc boolean := public.is_accountant();
BEGIN
  NEW.total_amount := round(coalesce(NEW.amount_before_tax, 0) + coalesce(NEW.tax_amount, 0), 2);

  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_acc AND NEW.status NOT IN ('draft', 'under_review', 'tech_verified', 'needs_review') THEN
      RAISE EXCEPTION 'employee_cannot_set_status';
    END IF;
    IF NEW.duplicate_reason IS NOT NULL AND NOT v_is_acc THEN
      RAISE EXCEPTION 'duplicate_override_requires_accountant';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_is_acc THEN
    IF OLD.status NOT IN ('draft', 'returned', 'tech_verified', 'needs_review') THEN
      RAISE EXCEPTION 'employee_cannot_edit_locked_invoice';
    END IF;
    IF NEW.status NOT IN ('draft', 'under_review', 'tech_verified', 'needs_review') THEN
      RAISE EXCEPTION 'employee_cannot_set_status';
    END IF;
    IF NEW.duplicate_reason IS DISTINCT FROM OLD.duplicate_reason THEN
      RAISE EXCEPTION 'duplicate_override_requires_accountant';
    END IF;
  END IF;

  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.invoice_no IS DISTINCT FROM OLD.invoice_no
       OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
       OR NEW.amount_before_tax IS DISTINCT FROM OLD.amount_before_tax
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
      RAISE EXCEPTION 'approved_invoice_is_locked';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$function$;

-- ============ 2. helper functions ============
CREATE OR REPLACE FUNCTION public.normalize_product_name(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp' AS $$
  SELECT nullif(btrim(regexp_replace(
    translate(lower(coalesce(_name, '')), 'أإآىةئؤ', 'ااايهيو'),
    '[^a-z0-9\u0600-\u06FF]+', ' ', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.can_view_invoice(_invoice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = _invoice_id
      AND (
        public.is_accountant()
        OR (public.is_staff() AND public.can_access_project(i.project_id))
        OR (public.is_supervisor_user() AND i.supervisor_id = public.current_supervisor_id())
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_invoice(uuid) TO authenticated;

-- ============ 3. verification results ============
CREATE TABLE IF NOT EXISTS public.invoice_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  qr_hash text,
  file_hash text,
  detected_phase smallint,
  result_status text NOT NULL,
  seller_name text,
  seller_vat_number text,
  invoice_timestamp timestamptz,
  total_with_vat numeric(14,2),
  vat_total numeric(14,2),
  decoded_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_method text,
  storage_path text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_verifications_invoice_idx ON public.invoice_verifications(invoice_id);
GRANT SELECT ON public.invoice_verifications TO authenticated;
GRANT ALL ON public.invoice_verifications TO service_role;
ALTER TABLE public.invoice_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iv_select ON public.invoice_verifications;
CREATE POLICY iv_select ON public.invoice_verifications FOR SELECT TO authenticated
  USING (public.can_view_invoice(invoice_id));

-- ============ 4. line items ============
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  verification_id uuid REFERENCES public.invoice_verifications(id) ON DELETE SET NULL,
  line_number integer NOT NULL DEFAULT 1,
  original_name text NOT NULL,
  normalized_name text,
  description text,
  sku text,
  quantity numeric(14,3),
  unit text,
  unit_price_before_vat numeric(14,4),
  discount numeric(14,2) DEFAULT 0,
  vat_rate numeric(6,3),
  vat_amount numeric(14,2),
  subtotal_before_vat numeric(14,2),
  total_with_vat numeric(14,2),
  extraction_method text NOT NULL DEFAULT 'manual',
  confidence numeric(4,3) NOT NULL DEFAULT 1,
  review_status text NOT NULL DEFAULT 'pending',
  unified_product_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ili_status_chk CHECK (review_status IN ('pending','approved','rejected','edited','conflict')),
  CONSTRAINT ili_qty_chk CHECK (quantity IS NULL OR quantity >= 0),
  CONSTRAINT ili_price_chk CHECK (unit_price_before_vat IS NULL OR unit_price_before_vat >= 0),
  CONSTRAINT ili_line_unique UNIQUE (invoice_id, line_number)
);
CREATE INDEX IF NOT EXISTS ili_invoice_idx ON public.invoice_line_items(invoice_id);
GRANT SELECT, UPDATE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ili_select ON public.invoice_line_items;
CREATE POLICY ili_select ON public.invoice_line_items FOR SELECT TO authenticated
  USING (public.can_view_invoice(invoice_id));
DROP POLICY IF EXISTS ili_update ON public.invoice_line_items;
CREATE POLICY ili_update ON public.invoice_line_items FOR UPDATE TO authenticated
  USING (public.has_perm('invoices.review_extracted') AND public.can_view_invoice(invoice_id))
  WITH CHECK (public.has_perm('invoices.review_extracted') AND public.can_view_invoice(invoice_id));

-- ============ 5. product catalogue ============
CREATE TABLE IF NOT EXISTS public.unified_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arabic_name text NOT NULL,
  english_name text,
  normalized_name text,
  description text,
  category text,
  default_unit text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT up_status_chk CHECK (status IN ('active','hidden','merged','archived'))
);

CREATE TABLE IF NOT EXISTS public.product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_product_id uuid REFERENCES public.unified_products(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  original_name text NOT NULL,
  normalized_name text NOT NULL,
  sku text,
  description text,
  default_unit text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pc_status_chk CHECK (status IN ('active','hidden','merged'))
);
CREATE UNIQUE INDEX IF NOT EXISTS pc_name_supplier_unique
  ON public.product_catalog (normalized_name, coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_product_id uuid NOT NULL REFERENCES public.unified_products(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  normalized_name text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pa_unique ON public.product_aliases (unified_product_id, normalized_name);

CREATE TABLE IF NOT EXISTS public.product_unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_product_id uuid NOT NULL REFERENCES public.unified_products(id) ON DELETE CASCADE,
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  factor numeric(14,6) NOT NULL CHECK (factor > 0),
  note text,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT puc_unique UNIQUE (unified_product_id, from_unit, to_unit)
);

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  unified_product_id uuid REFERENCES public.unified_products(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  source_line_item_id uuid NOT NULL REFERENCES public.invoice_line_items(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_date date,
  quantity numeric(14,3),
  unit text,
  unit_price numeric(14,4) NOT NULL CHECK (unit_price >= 0),
  vat_rate numeric(6,3),
  total_with_vat numeric(14,2),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'active',
  exclusion_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pph_status_chk CHECK (status IN ('active','cancelled','excluded')),
  CONSTRAINT pph_source_unique UNIQUE (source_line_item_id)
);
CREATE INDEX IF NOT EXISTS pph_product_idx ON public.product_price_history(unified_product_id);
CREATE INDEX IF NOT EXISTS pph_catalog_idx ON public.product_price_history(catalog_id);

GRANT SELECT ON public.unified_products, public.product_catalog, public.product_aliases,
  public.product_unit_conversions, public.product_price_history TO authenticated;
GRANT INSERT, UPDATE ON public.unified_products, public.product_catalog, public.product_aliases,
  public.product_unit_conversions TO authenticated;
GRANT ALL ON public.unified_products, public.product_catalog, public.product_aliases,
  public.product_unit_conversions, public.product_price_history TO service_role;

ALTER TABLE public.unified_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS up_select ON public.unified_products;
CREATE POLICY up_select ON public.unified_products FOR SELECT TO authenticated USING (public.has_perm('products.view'));
DROP POLICY IF EXISTS up_write ON public.unified_products;
CREATE POLICY up_write ON public.unified_products FOR INSERT TO authenticated WITH CHECK (public.has_perm('products.manage'));
DROP POLICY IF EXISTS up_update ON public.unified_products;
CREATE POLICY up_update ON public.unified_products FOR UPDATE TO authenticated
  USING (public.has_perm('products.manage')) WITH CHECK (public.has_perm('products.manage'));

DROP POLICY IF EXISTS pc_select ON public.product_catalog;
CREATE POLICY pc_select ON public.product_catalog FOR SELECT TO authenticated USING (public.has_perm('products.view'));
DROP POLICY IF EXISTS pc_update ON public.product_catalog;
CREATE POLICY pc_update ON public.product_catalog FOR UPDATE TO authenticated
  USING (public.has_perm('products.manage')) WITH CHECK (public.has_perm('products.manage'));

DROP POLICY IF EXISTS pa_select ON public.product_aliases;
CREATE POLICY pa_select ON public.product_aliases FOR SELECT TO authenticated USING (public.has_perm('products.view'));
DROP POLICY IF EXISTS pa_write ON public.product_aliases;
CREATE POLICY pa_write ON public.product_aliases FOR INSERT TO authenticated WITH CHECK (public.has_perm('products.merge'));

DROP POLICY IF EXISTS puc_select ON public.product_unit_conversions;
CREATE POLICY puc_select ON public.product_unit_conversions FOR SELECT TO authenticated USING (public.has_perm('products.view'));
DROP POLICY IF EXISTS puc_write ON public.product_unit_conversions;
CREATE POLICY puc_write ON public.product_unit_conversions FOR INSERT TO authenticated WITH CHECK (public.has_perm('products.manage'));

DROP POLICY IF EXISTS pph_select ON public.product_price_history;
CREATE POLICY pph_select ON public.product_price_history FOR SELECT TO authenticated USING (public.has_perm('prices.view'));

-- ============ 6. storage policies (bucket already created) ============
CREATE OR REPLACE FUNCTION public.can_access_invoice_object(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_id uuid;
BEGIN
  IF split_part(_name, '/', 1) <> 'invoices' THEN RETURN false; END IF;
  BEGIN
    v_id := (split_part(_name, '/', 2))::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.can_view_invoice(v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_invoice_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_invoice_object(text) TO authenticated;

DROP POLICY IF EXISTS invoice_files_read ON storage.objects;
CREATE POLICY invoice_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-files' AND public.can_access_invoice_object(name));
DROP POLICY IF EXISTS invoice_files_insert ON storage.objects;
CREATE POLICY invoice_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-files' AND public.has_perm('invoices.save_verified')
              AND public.can_access_invoice_object(name));