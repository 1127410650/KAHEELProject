CREATE OR REPLACE FUNCTION public.can_view_property_document(_document_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE doc public.property_documents;
BEGIN
  IF auth.uid() IS NULL OR _document_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO doc FROM public.property_documents WHERE id = _document_id;
  IF doc.id IS NULL THEN RETURN false; END IF;
  IF public.is_accountant() THEN RETURN true; END IF;
  RETURN public.can_view_property_documents(doc.project_id)
     AND (
       doc.visibility = 'project_shared'
       OR (doc.visibility = 'requester_private' AND (doc.created_by = auth.uid() OR public.is_staff()))
       OR (doc.visibility = 'internal' AND public.is_staff())
       OR (doc.visibility = 'sensitive' AND public.has_perm('property_documents.manage'))
     );
END $$;

CREATE OR REPLACE FUNCTION public.touch_analysis_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.document_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.property_documents(id) ON DELETE CASCADE,
  document_version integer,
  file_hash text,
  document_type_detected text,
  document_type_confirmed text,
  analyzer_version text NOT NULL DEFAULT 'v1',
  extraction_method text,
  language_detected text,
  page_count integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','preparing','extracting_text','ocr','extracting_fields',
                      'ready_for_review','partially_reviewed','reviewed','applied','failed','cancelled')),
  overall_confidence numeric,
  raw_text text,
  quick_mode boolean NOT NULL DEFAULT false,
  qr_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied_by uuid,
  applied_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_analyses_cache_key
  ON public.document_analyses(document_id, file_hash, analyzer_version)
  WHERE file_hash IS NOT NULL;
CREATE INDEX document_analyses_project_idx ON public.document_analyses(project_id);

CREATE TABLE public.document_analysis_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.document_analyses(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text,
  extracted_value text,
  normalized_value text,
  original_text text,
  page_number integer,
  bounding_box jsonb,
  extraction_method text,
  confidence numeric,
  is_sensitive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','confirmed','edited','rejected','conflict')),
  match_state text,
  current_project_value text,
  approved_value text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_analysis_fields_key ON public.document_analysis_fields(analysis_id, field_key);

CREATE TABLE public.document_analysis_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.document_analyses(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  document_value text,
  project_value text,
  conflict_type text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_analysis_conflicts_key ON public.document_analysis_conflicts(analysis_id, field_key);

CREATE TABLE public.document_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.document_analyses(id) ON DELETE CASCADE,
  analyzer_version text NOT NULL DEFAULT 'v1',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result text,
  device_info jsonb,
  performance_metrics jsonb
);

GRANT SELECT, INSERT, UPDATE ON public.document_analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_analysis_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_analysis_conflicts TO authenticated;
GRANT SELECT, INSERT ON public.document_analysis_runs TO authenticated;
GRANT ALL ON public.document_analyses TO service_role;
GRANT ALL ON public.document_analysis_fields TO service_role;
GRANT ALL ON public.document_analysis_conflicts TO service_role;
GRANT ALL ON public.document_analysis_runs TO service_role;

ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_analysis_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_analysis_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY analyses_select ON public.document_analyses FOR SELECT TO authenticated
USING (public.can_view_property_document(document_id));

CREATE POLICY analyses_insert ON public.document_analyses FOR INSERT TO authenticated
WITH CHECK (
  public.can_view_property_document(document_id)
  AND (public.is_accountant() OR public.has_perm('property_documents.analyze'))
);

CREATE POLICY analyses_update ON public.document_analyses FOR UPDATE TO authenticated
USING (
  public.can_view_property_document(document_id)
  AND (public.is_accountant()
       OR public.has_perm('property_documents.analyze')
       OR public.has_perm('property_documents.review_analysis'))
);

CREATE POLICY fields_select ON public.document_analysis_fields FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id)));

CREATE POLICY fields_insert ON public.document_analysis_fields FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id))
            AND (public.is_accountant() OR public.has_perm('property_documents.analyze')));

CREATE POLICY fields_update ON public.document_analysis_fields FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id))
            AND (public.is_accountant() OR public.has_perm('property_documents.review_analysis')));

CREATE POLICY conflicts_select ON public.document_analysis_conflicts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id)));

CREATE POLICY conflicts_insert ON public.document_analysis_conflicts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id))
            AND (public.is_accountant() OR public.has_perm('property_documents.analyze')));

CREATE POLICY conflicts_update ON public.document_analysis_conflicts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id))
            AND (public.is_accountant() OR public.has_perm('property_documents.review_analysis')));

CREATE POLICY runs_select ON public.document_analysis_runs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id)));

CREATE POLICY runs_insert ON public.document_analysis_runs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.document_analyses a
               WHERE a.id = analysis_id AND public.can_view_property_document(a.document_id)));

CREATE TRIGGER document_analyses_updated_at BEFORE UPDATE ON public.document_analyses
FOR EACH ROW EXECUTE FUNCTION public.touch_analysis_updated_at();

CREATE OR REPLACE FUNCTION public.document_analysis_raw_text(_analysis_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.document_analyses; txt text;
BEGIN
  SELECT * INTO a FROM public.document_analyses WHERE id = _analysis_id;
  IF a.id IS NULL THEN RETURN NULL; END IF;
  IF NOT public.can_view_property_document(a.document_id) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT (public.is_accountant() OR public.has_perm('property_documents.view_raw_text')) THEN
    RAISE EXCEPTION 'RAW_TEXT_FORBIDDEN';
  END IF;
  txt := a.raw_text;
  RETURN txt;
END $$;

CREATE OR REPLACE FUNCTION public.document_analysis_review_field(
  _field_id uuid, _action text, _value text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.document_analysis_fields; a public.document_analyses; total int; pending int;
BEGIN
  SELECT * INTO f FROM public.document_analysis_fields WHERE id = _field_id;
  IF f.id IS NULL THEN RAISE EXCEPTION 'FIELD_NOT_FOUND'; END IF;
  SELECT * INTO a FROM public.document_analyses WHERE id = f.analysis_id;
  IF NOT public.can_view_property_document(a.document_id) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT (public.is_accountant() OR public.has_perm('property_documents.review_analysis')) THEN
    RAISE EXCEPTION 'REVIEW_FORBIDDEN';
  END IF;
  IF _action NOT IN ('confirm','edit','reject') THEN RAISE EXCEPTION 'BAD_ACTION'; END IF;
  IF f.is_sensitive AND _action <> 'reject'
     AND NOT (public.is_accountant() OR public.has_perm('property_documents.approve_analysis')) THEN
    RAISE EXCEPTION 'SENSITIVE_APPROVAL_REQUIRED';
  END IF;

  UPDATE public.document_analysis_fields SET
    status = CASE _action WHEN 'confirm' THEN 'confirmed' WHEN 'edit' THEN 'edited' ELSE 'rejected' END,
    approved_value = CASE _action WHEN 'reject' THEN NULL
                                  WHEN 'edit' THEN _value
                                  ELSE COALESCE(f.normalized_value, f.extracted_value) END,
    extraction_method = CASE WHEN _action = 'edit' THEN 'manual' ELSE f.extraction_method END,
    reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _field_id;

  SELECT count(*), count(*) FILTER (WHERE status = 'proposed')
    INTO total, pending FROM public.document_analysis_fields WHERE analysis_id = a.id;

  UPDATE public.document_analyses SET
    status = CASE WHEN a.status = 'applied' THEN 'applied'
                  WHEN pending = 0 THEN 'reviewed' ELSE 'partially_reviewed' END,
    reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = a.id;

  PERFORM public.log_audit('document_analysis_field', _action, _field_id,
    NULL, jsonb_build_object('status', _action, 'field_key', f.field_key), NULL);
END $$;

CREATE OR REPLACE FUNCTION public.document_analysis_resolve_conflict(
  _conflict_id uuid, _resolution text, _keep text DEFAULT 'project'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.document_analysis_conflicts; a public.document_analyses;
BEGIN
  SELECT * INTO c FROM public.document_analysis_conflicts WHERE id = _conflict_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'CONFLICT_NOT_FOUND'; END IF;
  SELECT * INTO a FROM public.document_analyses WHERE id = c.analysis_id;
  IF NOT public.can_view_property_document(a.document_id) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT (public.is_accountant() OR public.has_perm('property_documents.approve_analysis')) THEN
    RAISE EXCEPTION 'APPROVE_FORBIDDEN';
  END IF;
  IF coalesce(trim(_resolution), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  UPDATE public.document_analysis_conflicts
     SET status = 'resolved', resolution = _resolution, resolved_by = auth.uid(), resolved_at = now()
   WHERE id = _conflict_id;

  IF _keep = 'project' THEN
    UPDATE public.document_analysis_fields SET status = 'rejected', approved_value = NULL,
           reviewed_by = auth.uid(), reviewed_at = now()
     WHERE analysis_id = c.analysis_id AND field_key = c.field_key;
  ELSE
    UPDATE public.document_analysis_fields SET status = 'confirmed',
           approved_value = COALESCE(normalized_value, extracted_value),
           reviewed_by = auth.uid(), reviewed_at = now()
     WHERE analysis_id = c.analysis_id AND field_key = c.field_key;
  END IF;

  PERFORM public.log_audit('document_analysis_conflict', 'approve', _conflict_id, NULL,
    jsonb_build_object('keep', _keep), _resolution);
END $$;
