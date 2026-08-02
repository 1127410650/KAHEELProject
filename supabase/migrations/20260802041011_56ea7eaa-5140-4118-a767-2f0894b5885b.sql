CREATE OR REPLACE FUNCTION public.mkt_report_reopen(_report_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record;
BEGIN
  PERFORM public.mkt_report_require(_report_id, 'reports.reopen');
  IF btrim(COALESCE(_reason,'')) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.mkt_reports SET closed_at = NULL, updated_at = now() WHERE id = _report_id;
  PERFORM public.mkt_report_apply_status(_report_id, 'reopened', _reason);
  SELECT * INTO r FROM public.mkt_reports WHERE id = _report_id;
  PERFORM public.mkt_notify(r.reporter_user_id, _report_id, 'report_reopened', 'تم إعادة فتح بلاغك', NULL);
  PERFORM public.mkt_notify(r.owner_user_id, _report_id, 'report_reopened_advertiser', 'تم إعادة فتح مراجعة بخصوص إعلانك', NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_report_reopen(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_report_reopen(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_report_reopen(uuid, text) TO authenticated;