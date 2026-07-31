-- duplicate check ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_check_duplicate(
  _file_hash text DEFAULT NULL, _qr_hash text DEFAULT NULL, _zatca_uuid text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL, _invoice_no text DEFAULT NULL, _invoice_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_rows jsonb := '[]'::jsonb;
  v_reasons text[] := '{}';
  r record;
BEGIN
  IF NOT public.has_perm('invoice_verification.use') AND NOT public.is_accountant() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  FOR r IN
    SELECT i.id, i.internal_no, i.invoice_no, i.invoice_date, i.total_amount, i.status,
      CASE
        WHEN _file_hash IS NOT NULL AND i.file_hash = _file_hash THEN 'file_hash'
        WHEN _qr_hash IS NOT NULL AND i.qr_hash = _qr_hash THEN 'qr_hash'
        WHEN _zatca_uuid IS NOT NULL AND i.zatca_uuid = _zatca_uuid THEN 'zatca_uuid'
        ELSE 'supplier_no_date'
      END AS reason
    FROM public.invoices i
    WHERE i.deleted_at IS NULL
      AND (
        (_file_hash IS NOT NULL AND i.file_hash = _file_hash)
        OR (_qr_hash IS NOT NULL AND i.qr_hash = _qr_hash)
        OR (_zatca_uuid IS NOT NULL AND i.zatca_uuid = _zatca_uuid)
        OR (_supplier_id IS NOT NULL AND _invoice_no IS NOT NULL
            AND i.supplier_id = _supplier_id
            AND i.invoice_no_norm = upper(regexp_replace(coalesce(_invoice_no,''), '[^a-zA-Z0-9]', '', 'g'))
            AND (_invoice_date IS NULL OR i.invoice_date = _invoice_date))
      )
    LIMIT 10
  LOOP
    v_rows := v_rows || jsonb_build_object('id', r.id, 'internal_no', r.internal_no,
      'invoice_no', r.invoice_no, 'invoice_date', r.invoice_date,
      'total_amount', r.total_amount, 'status', r.status, 'reason', r.reason);
    v_reasons := array_append(v_reasons, r.reason);
  END LOOP;

  RETURN jsonb_build_object('duplicate', jsonb_array_length(v_rows) > 0,
    'reasons', to_jsonb(v_reasons), 'invoices', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_check_duplicate(text,text,text,uuid,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_check_duplicate(text,text,text,uuid,text,date) TO authenticated;

-- supplier match ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_match_supplier(_vat text DEFAULT NULL, _name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE s record;
BEGIN
  IF NOT public.is_staff() AND NOT public.is_accountant() THEN RAISE EXCEPTION 'not_allowed'; END IF;

  IF _vat IS NOT NULL AND btrim(_vat) <> '' THEN
    SELECT * INTO s FROM public.suppliers
      WHERE tax_number = btrim(_vat) AND deleted_at IS NULL LIMIT 1;
    IF s.id IS NOT NULL THEN
      RETURN jsonb_build_object('supplier_id', s.id, 'matched_by', 'vat',
        'name_ar', s.name_ar, 'name_en', s.name_en,
        'name_mismatch', _name IS NOT NULL AND btrim(_name) <> ''
          AND public.normalize_product_name(_name) IS DISTINCT FROM public.normalize_product_name(s.name_ar)
          AND public.normalize_product_name(_name) IS DISTINCT FROM public.normalize_product_name(coalesce(s.name_en,'')));
    END IF;
  END IF;

  IF _name IS NOT NULL AND btrim(_name) <> '' THEN
    SELECT * INTO s FROM public.suppliers
      WHERE deleted_at IS NULL
        AND (public.normalize_product_name(name_ar) = public.normalize_product_name(_name)
          OR public.normalize_product_name(coalesce(name_en,'')) = public.normalize_product_name(_name))
      LIMIT 1;
    IF s.id IS NOT NULL THEN
      RETURN jsonb_build_object('supplier_id', s.id, 'matched_by', 'name',
        'name_ar', s.name_ar, 'name_en', s.name_en, 'name_mismatch', false);
    END IF;
  END IF;

  RETURN jsonb_build_object('supplier_id', NULL, 'matched_by', NULL, 'name_mismatch', false);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_match_supplier(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_match_supplier(text,text) TO authenticated;

-- save a verified invoice -------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_save_verified_invoice(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dup jsonb;
  v_supplier uuid;
  v_invoice uuid;
  v_ver uuid;
  v_token text := nullif(_payload->>'client_token','');
  v_override text := nullif(_payload->>'duplicate_override_reason','');
  v_status public.record_status;
  v_line jsonb;
  v_n integer := 0;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.has_perm('invoices.save_verified') THEN RAISE EXCEPTION 'not_allowed'; END IF;

  -- double-click guard
  IF v_token IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.invoices WHERE client_token = v_token LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('invoice_id', v_existing, 'reused', true);
    END IF;
  END IF;

  -- supplier: vat first, then name; create only when explicitly requested
  v_supplier := nullif(_payload->>'supplier_id','')::uuid;
  IF v_supplier IS NULL THEN
    v_supplier := (public.tiv_match_supplier(_payload->>'seller_vat_number', _payload->>'seller_name')->>'supplier_id')::uuid;
  END IF;
  IF v_supplier IS NULL AND coalesce((_payload->>'create_supplier')::boolean, false) THEN
    INSERT INTO public.suppliers (name_ar, name_en, tax_number, created_by)
    VALUES (coalesce(nullif(_payload->>'seller_name',''), 'مورد غير معروف'),
            nullif(_payload->>'seller_name_en',''),
            nullif(_payload->>'seller_vat_number',''), v_uid)
    RETURNING id INTO v_supplier;
    PERFORM public.log_audit('supplier', 'create', v_supplier, NULL,
      jsonb_build_object('source','invoice_verification'), 'created from invoice verification');
  END IF;
  IF v_supplier IS NULL THEN RAISE EXCEPTION 'supplier_required'; END IF;

  -- duplicate detection
  v_dup := public.tiv_check_duplicate(
    nullif(_payload->>'file_hash',''), nullif(_payload->>'qr_hash',''), nullif(_payload->>'zatca_uuid',''),
    v_supplier, nullif(_payload->>'invoice_no',''), nullif(_payload->>'invoice_date','')::date);

  IF (v_dup->>'duplicate')::boolean THEN
    PERFORM public.log_audit('invoice', 'update', NULL, NULL, v_dup, 'duplicate_detected');
    IF v_override IS NULL THEN
      RETURN jsonb_build_object('saved', false, 'duplicate', v_dup);
    END IF;
    IF NOT public.is_accountant() AND NOT public.has_perm('invoices.approve') THEN
      RAISE EXCEPTION 'duplicate_override_requires_accountant';
    END IF;
  END IF;

  v_status := coalesce(nullif(_payload->>'status',''), 'needs_review')::public.record_status;
  IF v_status NOT IN ('draft','tech_verified','needs_review','under_review') THEN
    v_status := 'needs_review';
  END IF;

  INSERT INTO public.invoices (
    supplier_id, invoice_no, invoice_date, project_id, supervisor_id,
    amount_before_tax, tax_amount, description, status, client_token,
    source, currency, zatca_uuid, qr_hash, file_hash, seller_name_raw,
    seller_vat_number, extraction_method, duplicate_reason, created_by)
  VALUES (
    v_supplier,
    coalesce(nullif(_payload->>'invoice_no',''), 'N/A'),
    coalesce(nullif(_payload->>'invoice_date','')::date, current_date),
    nullif(_payload->>'project_id','')::uuid,
    nullif(_payload->>'supervisor_id','')::uuid,
    coalesce(nullif(_payload->>'amount_before_tax','')::numeric, 0),
    coalesce(nullif(_payload->>'tax_amount','')::numeric, 0),
    nullif(_payload->>'description',''), v_status, v_token,
    'verification', coalesce(nullif(_payload->>'currency',''), 'SAR'),
    nullif(_payload->>'zatca_uuid',''), nullif(_payload->>'qr_hash',''), nullif(_payload->>'file_hash',''),
    nullif(_payload->>'seller_name',''), nullif(_payload->>'seller_vat_number',''),
    nullif(_payload->>'extraction_method',''), v_override, v_uid)
  RETURNING id INTO v_invoice;

  IF v_override IS NOT NULL THEN
    PERFORM public.log_audit('invoice', 'update', v_invoice, v_dup,
      jsonb_build_object('override', true), v_override);
  END IF;

  -- verification result
  v_ver := public.tiv_add_verification(v_invoice, _payload->'verification');

  -- line items
  FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(_payload->'line_items','[]'::jsonb)) LOOP
    v_n := v_n + 1;
    INSERT INTO public.invoice_line_items (
      invoice_id, verification_id, line_number, original_name, normalized_name, description, sku,
      quantity, unit, unit_price_before_vat, discount, vat_rate, vat_amount,
      subtotal_before_vat, total_with_vat, extraction_method, confidence, review_status, created_by)
    VALUES (
      v_invoice, v_ver, v_n,
      coalesce(nullif(v_line->>'original_name',''), 'بند'),
      public.normalize_product_name(v_line->>'original_name'),
      nullif(v_line->>'description',''), nullif(v_line->>'sku',''),
      abs(coalesce(nullif(v_line->>'quantity','')::numeric, 0)),
      nullif(v_line->>'unit',''),
      abs(coalesce(nullif(v_line->>'unit_price_before_vat','')::numeric, 0)),
      coalesce(nullif(v_line->>'discount','')::numeric, 0),
      nullif(v_line->>'vat_rate','')::numeric,
      nullif(v_line->>'vat_amount','')::numeric,
      nullif(v_line->>'subtotal_before_vat','')::numeric,
      nullif(v_line->>'total_with_vat','')::numeric,
      coalesce(nullif(v_line->>'extraction_method',''), 'manual'),
      coalesce(nullif(v_line->>'confidence','')::numeric, 1),
      'pending', v_uid);
  END LOOP;

  PERFORM public.log_audit('invoice', 'create', v_invoice, NULL,
    jsonb_build_object('source','verification','lines', v_n, 'verification_id', v_ver), 'saved from tax verification');

  RETURN jsonb_build_object('saved', true, 'invoice_id', v_invoice,
    'verification_id', v_ver, 'lines', v_n, 'duplicate', v_dup);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_save_verified_invoice(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_save_verified_invoice(jsonb) TO authenticated;

-- add (re)verification result --------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_add_verification(_invoice_id uuid, _v jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_id uuid;
  v_next integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.can_view_invoice(_invoice_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  SELECT coalesce(max(version), 0) + 1 INTO v_next
    FROM public.invoice_verifications WHERE invoice_id = _invoice_id;

  INSERT INTO public.invoice_verifications (
    invoice_id, qr_hash, file_hash, detected_phase, result_status, seller_name, seller_vat_number,
    invoice_timestamp, total_with_vat, vat_total, decoded_tags, verification_reasons,
    extraction_method, storage_path, version, created_by)
  VALUES (
    _invoice_id, nullif(_v->>'qr_hash',''), nullif(_v->>'file_hash',''),
    nullif(_v->>'detected_phase','')::smallint,
    coalesce(nullif(_v->>'result_status',''), 'gray'),
    nullif(_v->>'seller_name',''), nullif(_v->>'seller_vat_number',''),
    nullif(_v->>'invoice_timestamp','')::timestamptz,
    nullif(_v->>'total_with_vat','')::numeric, nullif(_v->>'vat_total','')::numeric,
    coalesce(_v->'decoded_tags','[]'::jsonb), coalesce(_v->'verification_reasons','[]'::jsonb),
    nullif(_v->>'extraction_method',''), nullif(_v->>'storage_path',''), v_next, auth.uid())
  RETURNING id INTO v_id;

  PERFORM public.log_audit('invoice_verification', 'create', v_id, NULL,
    jsonb_build_object('invoice_id', _invoice_id, 'version', v_next,
      'result', _v->>'result_status'), 'invoice verification result');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_add_verification(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_add_verification(uuid, jsonb) TO authenticated;

-- review a line ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_review_line_item(_id uuid, _decision text, _patch jsonb DEFAULT '{}'::jsonb, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  li public.invoice_line_items;
  v_status text;
  v_unified uuid;
BEGIN
  IF NOT public.has_perm('invoices.review_extracted') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO li FROM public.invoice_line_items WHERE id = _id;
  IF li.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.can_view_invoice(li.invoice_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;

  IF _decision NOT IN ('approve','reject','edit') THEN RAISE EXCEPTION 'bad_decision'; END IF;

  -- xml/pdf-text values are authoritative: never overwrite with ocr values
  IF _decision = 'edit' AND coalesce(_patch->>'source','manual') = 'ocr'
     AND li.extraction_method IN ('xml','pdf-text') THEN
    RAISE EXCEPTION 'cannot_override_structured_value';
  END IF;

  v_unified := nullif(_patch->>'unified_product_id','')::uuid;
  v_status := CASE _decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'edited' END;

  -- low-confidence ocr can never be silently approved without an edit
  IF v_status = 'approved' AND li.extraction_method = 'ocr' AND li.confidence < 0.6
     AND _patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'low_confidence_needs_edit';
  END IF;

  UPDATE public.invoice_line_items SET
    original_name = coalesce(nullif(_patch->>'original_name',''), original_name),
    normalized_name = public.normalize_product_name(coalesce(nullif(_patch->>'original_name',''), original_name)),
    description = coalesce(nullif(_patch->>'description',''), description),
    sku = coalesce(nullif(_patch->>'sku',''), sku),
    quantity = coalesce(abs(nullif(_patch->>'quantity','')::numeric), quantity),
    unit = coalesce(nullif(_patch->>'unit',''), unit),
    unit_price_before_vat = coalesce(abs(nullif(_patch->>'unit_price_before_vat','')::numeric), unit_price_before_vat),
    vat_rate = coalesce(nullif(_patch->>'vat_rate','')::numeric, vat_rate),
    total_with_vat = coalesce(nullif(_patch->>'total_with_vat','')::numeric, total_with_vat),
    unified_product_id = coalesce(v_unified, unified_product_id),
    review_status = v_status,
    extraction_method = CASE WHEN _decision = 'edit' THEN 'manual' ELSE extraction_method END,
    confidence = CASE WHEN _decision = 'edit' THEN 1 ELSE confidence END,
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = _id;

  PERFORM public.log_audit('invoice_line_item',
    CASE _decision WHEN 'reject' THEN 'cancel' WHEN 'approve' THEN 'approve' ELSE 'update' END,
    _id, to_jsonb(li), _patch || jsonb_build_object('review_status', v_status), _reason);

  RETURN jsonb_build_object('id', _id, 'review_status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_review_line_item(uuid,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_review_line_item(uuid,text,jsonb,text) TO authenticated;

-- approve invoice -> feed prices ----------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_decide_invoice(_invoice_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  inv public.invoices;
  li record;
  v_catalog uuid;
  v_unified uuid;
  v_prices integer := 0;
BEGIN
  IF NOT public.has_perm('invoices.approve') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id AND deleted_at IS NULL;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'bad_decision'; END IF;

  IF _decision = 'reject' THEN
    UPDATE public.invoices SET status = 'rejected', updated_at = now(), updated_by = auth.uid()
      WHERE id = _invoice_id;
    UPDATE public.product_price_history SET status = 'cancelled',
      exclusion_reason = coalesce(_note, 'invoice rejected')
      WHERE invoice_id = _invoice_id AND status = 'active';
    PERFORM public.log_audit('invoice', 'cancel', _invoice_id, to_jsonb(inv),
      jsonb_build_object('status','rejected'), _note);
    RETURN jsonb_build_object('status','rejected');
  END IF;

  UPDATE public.invoices SET status = 'approved', approved_at = now(), approved_by = auth.uid(),
    lines_reviewed_at = now(), updated_at = now(), updated_by = auth.uid()
    WHERE id = _invoice_id;

  FOR li IN
    SELECT * FROM public.invoice_line_items
    WHERE invoice_id = _invoice_id
      AND review_status IN ('approved','edited')
      AND unit_price_before_vat IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.product_price_history p WHERE p.source_line_item_id = invoice_line_items.id)
  LOOP
    -- catalog entry per (name, supplier)
    SELECT id, unified_product_id INTO v_catalog, v_unified FROM public.product_catalog
      WHERE normalized_name = coalesce(li.normalized_name, public.normalize_product_name(li.original_name))
        AND coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(inv.supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
      LIMIT 1;

    IF v_catalog IS NULL THEN
      INSERT INTO public.product_catalog (unified_product_id, supplier_id, original_name,
        normalized_name, sku, description, default_unit, created_by)
      VALUES (li.unified_product_id, inv.supplier_id, li.original_name,
        coalesce(li.normalized_name, public.normalize_product_name(li.original_name)),
        li.sku, li.description, li.unit, auth.uid())
      RETURNING id, unified_product_id INTO v_catalog, v_unified;
      PERFORM public.log_audit('product_catalog', 'create', v_catalog, NULL,
        jsonb_build_object('name', li.original_name, 'invoice_id', _invoice_id), NULL);
    END IF;

    IF li.unified_product_id IS NOT NULL AND v_unified IS DISTINCT FROM li.unified_product_id THEN
      UPDATE public.product_catalog SET unified_product_id = li.unified_product_id WHERE id = v_catalog;
      v_unified := li.unified_product_id;
    END IF;

    INSERT INTO public.product_price_history (catalog_id, unified_product_id, supplier_id, invoice_id,
      source_line_item_id, project_id, invoice_date, quantity, unit, unit_price, vat_rate,
      total_with_vat, currency, created_by)
    VALUES (v_catalog, v_unified, inv.supplier_id, _invoice_id, li.id, inv.project_id,
      inv.invoice_date, li.quantity, li.unit, li.unit_price_before_vat, li.vat_rate,
      li.total_with_vat, inv.currency, auth.uid())
    ON CONFLICT (source_line_item_id) DO NOTHING;
    v_prices := v_prices + 1;
    PERFORM public.log_audit('product_price_history', 'create', li.id, NULL,
      jsonb_build_object('unit_price', li.unit_price_before_vat, 'invoice_id', _invoice_id), NULL);
  END LOOP;

  PERFORM public.log_audit('invoice', 'approve', _invoice_id, to_jsonb(inv),
    jsonb_build_object('status','approved','prices', v_prices), _note);
  RETURN jsonb_build_object('status','approved','prices', v_prices);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_decide_invoice(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_decide_invoice(uuid,text,text) TO authenticated;

-- exclude a price record -------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_exclude_price(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NOT public.has_perm('products.manage') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.product_price_history SET status = 'excluded', exclusion_reason = _reason WHERE id = _id;
  PERFORM public.log_audit('product_price_history', 'update', _id, NULL,
    jsonb_build_object('status','excluded'), _reason);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_exclude_price(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_exclude_price(uuid,text) TO authenticated;

-- link / merge / split ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiv_link_catalog(_catalog_id uuid, _unified_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE c public.product_catalog;
BEGIN
  IF NOT public.has_perm('products.merge') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO c FROM public.product_catalog WHERE id = _catalog_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  UPDATE public.product_catalog SET unified_product_id = _unified_id WHERE id = _catalog_id;
  UPDATE public.product_price_history SET unified_product_id = _unified_id WHERE catalog_id = _catalog_id;

  INSERT INTO public.product_aliases (unified_product_id, catalog_id, alias_name, normalized_name, supplier_id, created_by)
  VALUES (_unified_id, _catalog_id, c.original_name, c.normalized_name, c.supplier_id, auth.uid())
  ON CONFLICT (unified_product_id, normalized_name) DO NOTHING;

  PERFORM public.log_audit('product_catalog', 'update', _catalog_id,
    jsonb_build_object('unified_product_id', c.unified_product_id),
    jsonb_build_object('unified_product_id', _unified_id), coalesce(_reason, 'link alias'));
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_link_catalog(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_link_catalog(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tiv_merge_products(_from uuid, _into uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_names integer; v_prices integer;
BEGIN
  IF NOT public.has_perm('products.merge') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _from = _into THEN RAISE EXCEPTION 'same_product'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  UPDATE public.product_catalog SET unified_product_id = _into WHERE unified_product_id = _from;
  GET DIAGNOSTICS v_names = ROW_COUNT;
  UPDATE public.product_price_history SET unified_product_id = _into WHERE unified_product_id = _from;
  GET DIAGNOSTICS v_prices = ROW_COUNT;
  UPDATE public.product_aliases SET unified_product_id = _into WHERE unified_product_id = _from;
  UPDATE public.unified_products SET status = 'merged', updated_at = now() WHERE id = _from;

  PERFORM public.log_audit('unified_product', 'update', _from,
    jsonb_build_object('merged_from', _from),
    jsonb_build_object('merged_into', _into, 'names', v_names, 'prices', v_prices), _reason);
  RETURN jsonb_build_object('names', v_names, 'prices', v_prices);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_merge_products(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_merge_products(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tiv_detach_catalog(_catalog_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NOT public.has_perm('products.merge') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  DELETE FROM public.product_aliases WHERE catalog_id = _catalog_id;
  UPDATE public.product_catalog SET unified_product_id = NULL WHERE id = _catalog_id;
  UPDATE public.product_price_history SET unified_product_id = NULL WHERE catalog_id = _catalog_id;
  PERFORM public.log_audit('product_catalog', 'update', _catalog_id, NULL,
    jsonb_build_object('detached', true), _reason);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_detach_catalog(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_detach_catalog(uuid,text) TO authenticated;