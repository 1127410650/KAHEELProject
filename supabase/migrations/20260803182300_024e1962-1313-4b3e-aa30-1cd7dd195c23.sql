CREATE OR REPLACE FUNCTION public.mkt_report_transition_ok(_from text, _to text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _from = _to THEN false
    WHEN _from IN ('new','unassigned','reopened') AND _to = 'under_review' THEN true
    WHEN _from = 'under_review' AND _to IN ('awaiting_reporter','awaiting_advertiser','escalated','action_taken','invalid') THEN true
    WHEN _from = 'awaiting_reporter' AND _to IN ('under_review','invalid') THEN true
    WHEN _from = 'awaiting_advertiser' AND _to IN ('under_review','action_taken','invalid') THEN true
    WHEN _from = 'escalated' AND _to IN ('under_review','action_taken','invalid') THEN true
    WHEN _from IN ('action_taken','invalid') AND _to = 'closed' THEN true
    WHEN _from = 'closed' AND _to = 'reopened' THEN true
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_assign(_report_id uuid, _assignee uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE cur text;
BEGIN
  IF _assignee = auth.uid() THEN
    PERFORM public.mkt_report_require(_report_id, 'reports.review');
  ELSE
    PERFORM public.mkt_report_require(_report_id, 'reports.assign');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_platform_admins WHERE user_id = _assignee)
     AND NOT EXISTS (
       SELECT 1 FROM public.mkt_staff_permissions
        WHERE user_id = _assignee AND perm IN ('reports.inbox_view','ads.reports_view')
     ) THEN
    RAISE EXCEPTION 'Assignee is not a review staff member';
  END IF;
  SELECT status INTO cur FROM public.mkt_reports WHERE id = _report_id;
  UPDATE public.mkt_reports SET assigned_to = _assignee, assigned_at = now(), updated_at = now()
   WHERE id = _report_id;
  IF cur IN ('new','unassigned','reopened') THEN
    PERFORM public.mkt_report_apply_status(_report_id, 'under_review', 'assigned');
  END IF;
  PERFORM public.mkt_notify(_assignee, _report_id, 'report_assigned', 'تم إسناد بلاغ إليك', NULL);
  PERFORM public.log_audit('mkt_report', 'update', _report_id, NULL,
    jsonb_build_object('assigned_to', _assignee), 'assignment');
END $$;

REVOKE EXECUTE ON FUNCTION public.mkt_report_assign(uuid, uuid) FROM anon;
