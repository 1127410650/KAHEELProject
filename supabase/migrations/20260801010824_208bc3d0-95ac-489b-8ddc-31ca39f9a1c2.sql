-- 1) Block final approval while any extracted line is still pending review
CREATE OR REPLACE FUNCTION public.tiv_decide_invoice(_invoice_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  inv public.invoices;
  li record;
  v_catalog uuid;
  v_unified uuid;
  v_prices integer := 0;
  v_pending integer := 0;
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

  SELECT count(*) INTO v_pending FROM public.invoice_line_items
    WHERE invoice_id = _invoice_id AND review_status = 'pending';
  IF v_pending > 0 THEN RAISE EXCEPTION 'pending_line_items'; END IF;

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
$function$;

-- 2) Reject unauthorized project_id / supervisor_id in the verified-invoice save path
CREATE OR REPLACE FUNCTION public.tiv_save_verified_invoice(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_project uuid;
  v_supervisor uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.has_perm('invoices.save_verified') THEN RAISE EXCEPTION 'not_allowed'; END IF;

  IF v_token IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.invoices WHERE client_token = v_token LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('invoice_id', v_existing, 'reused', true);
    END IF;
  END IF;

  v_project := nullif(_payload->>'project_id','')::uuid;
  v_supervisor := nullif(_payload->>'supervisor_id','')::uuid;
  IF v_project IS NOT NULL AND NOT public.can_access_project(v_project) THEN
    RAISE EXCEPTION 'project_not_allowed';
  END IF;
  IF v_supervisor IS NOT NULL AND NOT public.can_access_supervisor(v_supervisor) THEN
    RAISE EXCEPTION 'supervisor_not_allowed';
  END IF;

  v_supplier := nullif(_payload->>'supplier_id','')::uuid;
  IF v_supplier IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = v_supplier AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'supplier_not_found';
  END IF;
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
    v_project, v_supervisor,
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

  v_ver := public.tiv_add_verification(v_invoice, _payload->'verification');

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
$function$;