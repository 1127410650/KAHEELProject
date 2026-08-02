DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('mkt_is_super_admin','mkt_staff_has','mkt_report_conflict',
        'mkt_report_staff_can_view','mkt_report_is_reporter','mkt_report_is_advertiser',
        'mkt_has_restriction','mkt_user_blocked','mkt_lift_expired_restrictions',
        'mkt_guard_restrictions','mkt_notify','mkt_report_apply_status','mkt_report_require')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    IF r.proname IN ('mkt_user_blocked','mkt_lift_expired_restrictions','mkt_has_restriction') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
