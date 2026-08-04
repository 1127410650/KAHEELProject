DELETE FROM public.mkt_admin_assignments a
 WHERE a.kind = 'account_review'
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = a.subject_id);

UPDATE public.mkt_staff_status
   SET work_state = 'off', pre_leave_state = NULL, capacity_limit = 10;