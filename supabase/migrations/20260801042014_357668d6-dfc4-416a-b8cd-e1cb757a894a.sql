-- Column-level protection: raw extracted text is only reachable through the
-- permission-checked RPC, never through a direct table read.
REVOKE SELECT ON public.document_analyses FROM authenticated;
GRANT SELECT (
  id, project_id, document_id, document_version, file_hash,
  document_type_detected, document_type_confirmed, analyzer_version,
  extraction_method, language_detected, page_count, status, overall_confidence,
  quick_mode, qr_findings, started_at, completed_at, created_by, reviewed_by,
  reviewed_at, applied_by, applied_at, failure_code, failure_message,
  created_at, updated_at
) ON public.document_analyses TO authenticated;
GRANT ALL ON public.document_analyses TO service_role;

-- Applied values keep a full provenance trail (analysis id + document id).
CREATE OR REPLACE FUNCTION public.document_analysis_apply(_analysis_id uuid, _only_field_keys text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a public.document_analyses;
  f record;
  open_high int;
  land_cols text[] := ARRAY['city','district','plan_no','block_no','parcel_no','property_no',
                            'land_area','land_use','street_name','street_width','national_address',
                            'region','amanah','municipality','latitude','longitude'];
  deed_cols text[] := ARRAY['deed_no','registry_property_no','copy_no','issue_date','deed_date',
                            'issuer','doc_status','verify_url','owner_registry_no'];
  lic_cols  text[] := ARRAY['license_no','license_type','license_status','request_type','amanah',
                            'municipality','issue_date','expiry_date','holder_name','holder_id',
                            'ownership_doc_type','ownership_doc_no','plan_no','parcel_no',
                            'building_type','building_use','building_description','land_area',
                            'built_area','build_ratio','floors_count','units_count','design_office',
                            'supervision_office','contractor','fees','payment_no','payment_date'];
  land_set jsonb := '{}'::jsonb;
  deed_set jsonb := '{}'::jsonb;
  lic_set  jsonb := '{}'::jsonb;
  grp text; col text;
  applied text[] := ARRAY[]::text[];
  skipped text[] := ARRAY[]::text[];
  new_deed uuid; new_lic uuid; land_id uuid;
  sql text;
  src_note text;
BEGIN
  SELECT * INTO a FROM public.document_analyses WHERE id = _analysis_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'ANALYSIS_NOT_FOUND'; END IF;
  IF NOT public.can_view_property_document(a.document_id) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT (public.is_accountant() OR public.has_perm('property_documents.apply_analysis')) THEN
    RAISE EXCEPTION 'APPLY_FORBIDDEN';
  END IF;

  src_note := 'من تحليل المستند ' || a.document_id::text || ' / تحليل ' || _analysis_id::text;

  SELECT count(*) INTO open_high FROM public.document_analysis_conflicts
   WHERE analysis_id = _analysis_id AND status = 'open' AND severity = 'high';
  IF open_high > 0 AND _only_field_keys IS NULL THEN
    RAISE EXCEPTION 'UNRESOLVED_CONFLICTS';
  END IF;

  FOR f IN
    SELECT * FROM public.document_analysis_fields
     WHERE analysis_id = _analysis_id
       AND status IN ('confirmed','edited')
       AND approved_value IS NOT NULL AND btrim(approved_value) <> ''
       AND (_only_field_keys IS NULL OR field_key = ANY(_only_field_keys))
  LOOP
    IF EXISTS (SELECT 1 FROM public.document_analysis_conflicts c
                WHERE c.analysis_id = _analysis_id AND c.field_key = f.field_key
                  AND c.status = 'open' AND c.severity = 'high') THEN
      skipped := skipped || f.field_key; CONTINUE;
    END IF;
    IF f.is_sensitive AND NOT (public.is_accountant() OR public.has_perm('property.approve')) THEN
      skipped := skipped || f.field_key; CONTINUE;
    END IF;
    grp := split_part(f.field_key, '.', 1);
    col := split_part(f.field_key, '.', 2);
    IF grp = 'land' AND col = ANY(land_cols) THEN
      land_set := land_set || jsonb_build_object(col, f.approved_value);
      applied := applied || f.field_key;
    ELSIF grp = 'deed' AND col = ANY(deed_cols) THEN
      deed_set := deed_set || jsonb_build_object(col, f.approved_value);
      applied := applied || f.field_key;
    ELSIF grp = 'license' AND col = ANY(lic_cols) THEN
      lic_set := lic_set || jsonb_build_object(col, f.approved_value);
      applied := applied || f.field_key;
    ELSE
      skipped := skipped || f.field_key;
    END IF;
  END LOOP;

  IF land_set <> '{}'::jsonb THEN
    SELECT id INTO land_id FROM public.property_land WHERE project_id = a.project_id LIMIT 1;
    IF land_id IS NULL THEN
      INSERT INTO public.property_land(project_id, created_by) VALUES (a.project_id, auth.uid())
      RETURNING id INTO land_id;
    END IF;
    sql := 'UPDATE public.property_land SET (' ||
           (SELECT string_agg(quote_ident(k), ',') FROM jsonb_object_keys(land_set) k) ||
           ') = (SELECT ' ||
           (SELECT string_agg(format('(%L)::text::%s', land_set->>k,
                    (SELECT data_type FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='property_land' AND column_name=k)), ',')
              FROM jsonb_object_keys(land_set) k) ||
           '), updated_at = now() WHERE id = $1';
    EXECUTE sql USING land_id;
  END IF;

  IF deed_set <> '{}'::jsonb THEN
    INSERT INTO public.property_deeds(project_id, doc_type, version, is_current, previous_id, created_by,
      deed_no, registry_property_no, copy_no, issue_date, deed_date, issuer, doc_status, verify_url,
      owner_registry_no, notes)
    SELECT a.project_id, COALESCE(p.doc_type, 'deed'), COALESCE(p.version, 0) + 1, true, p.id, auth.uid(),
      COALESCE(deed_set->>'deed_no', p.deed_no),
      COALESCE(deed_set->>'registry_property_no', p.registry_property_no),
      COALESCE(deed_set->>'copy_no', p.copy_no),
      COALESCE((deed_set->>'issue_date')::date, p.issue_date),
      COALESCE((deed_set->>'deed_date')::date, p.deed_date),
      COALESCE(deed_set->>'issuer', p.issuer),
      COALESCE(deed_set->>'doc_status', p.doc_status),
      COALESCE(deed_set->>'verify_url', p.verify_url),
      COALESCE(deed_set->>'owner_registry_no', p.owner_registry_no),
      src_note
    FROM (SELECT * FROM public.property_deeds
           WHERE project_id = a.project_id AND is_current
           ORDER BY version DESC LIMIT 1) p
    RETURNING id INTO new_deed;

    IF new_deed IS NULL THEN
      INSERT INTO public.property_deeds(project_id, doc_type, version, is_current, created_by,
        deed_no, registry_property_no, copy_no, issue_date, deed_date, issuer, doc_status, verify_url,
        owner_registry_no, notes)
      VALUES (a.project_id, 'deed', 1, true, auth.uid(),
        deed_set->>'deed_no', deed_set->>'registry_property_no', deed_set->>'copy_no',
        (deed_set->>'issue_date')::date, (deed_set->>'deed_date')::date,
        deed_set->>'issuer', deed_set->>'doc_status', deed_set->>'verify_url',
        deed_set->>'owner_registry_no', src_note)
      RETURNING id INTO new_deed;
    ELSE
      UPDATE public.property_deeds SET is_current = false, doc_status = COALESCE(doc_status, 'superseded')
       WHERE project_id = a.project_id AND id <> new_deed AND is_current;
    END IF;
  END IF;

  IF lic_set <> '{}'::jsonb THEN
    INSERT INTO public.property_licenses(project_id, created_by, license_no, license_type,
      license_status, request_type, amanah, municipality, issue_date, expiry_date, holder_name,
      holder_id, ownership_doc_type, ownership_doc_no, plan_no, parcel_no, building_type,
      building_use, building_description, land_area, built_area, build_ratio, floors_count,
      units_count, design_office, supervision_office, contractor, fees, payment_no, payment_date, notes)
    VALUES (a.project_id, auth.uid(), lic_set->>'license_no', lic_set->>'license_type',
      lic_set->>'license_status', lic_set->>'request_type', lic_set->>'amanah',
      lic_set->>'municipality', (lic_set->>'issue_date')::date, (lic_set->>'expiry_date')::date,
      lic_set->>'holder_name', lic_set->>'holder_id', lic_set->>'ownership_doc_type',
      lic_set->>'ownership_doc_no', lic_set->>'plan_no', lic_set->>'parcel_no',
      lic_set->>'building_type', lic_set->>'building_use', lic_set->>'building_description',
      (lic_set->>'land_area')::numeric, (lic_set->>'built_area')::numeric,
      (lic_set->>'build_ratio')::numeric, (lic_set->>'floors_count')::int,
      (lic_set->>'units_count')::int, lic_set->>'design_office', lic_set->>'supervision_office',
      lic_set->>'contractor', (lic_set->>'fees')::numeric, lic_set->>'payment_no',
      (lic_set->>'payment_date')::date, src_note)
    RETURNING id INTO new_lic;
  END IF;

  UPDATE public.document_analyses
     SET status = 'applied', applied_by = auth.uid(), applied_at = now()
   WHERE id = _analysis_id;

  PERFORM public.log_audit('document_analysis', 'update', _analysis_id, NULL,
    jsonb_build_object('applied', applied, 'skipped', skipped,
                       'analysis_id', _analysis_id,
                       'document_id', a.document_id, 'new_deed_id', new_deed,
                       'new_license_id', new_lic), 'apply_analysis');

  RETURN jsonb_build_object('applied', applied, 'skipped', skipped,
                            'new_deed_id', new_deed, 'new_license_id', new_lic);
END $function$;