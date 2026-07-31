CREATE OR REPLACE FUNCTION public.tiv_set_verification_file(_verification_id uuid, _storage_path text, _file_hash text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v public.invoice_verifications;
BEGIN
  SELECT * INTO v FROM public.invoice_verifications WHERE id = _verification_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.can_view_invoice(v.invoice_id) OR NOT public.has_perm('invoices.save_verified') THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v.storage_path IS NOT NULL THEN RAISE EXCEPTION 'file_already_set'; END IF;

  UPDATE public.invoice_verifications
    SET storage_path = _storage_path, file_hash = coalesce(file_hash, _file_hash)
    WHERE id = _verification_id;
  UPDATE public.invoices SET file_hash = coalesce(file_hash, _file_hash) WHERE id = v.invoice_id;
  PERFORM public.log_audit('invoice_verification', 'upload', _verification_id, NULL,
    jsonb_build_object('storage_path', _storage_path), NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.tiv_set_verification_file(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiv_set_verification_file(uuid,text,text) TO authenticated;