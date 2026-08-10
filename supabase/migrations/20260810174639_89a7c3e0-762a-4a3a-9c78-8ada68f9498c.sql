CREATE OR REPLACE FUNCTION public.mkt_qa_rls_probe()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cust uuid := '810db718-ff3d-4acc-ad3b-0d0c784d3088';
  _owner uuid := '3e8d8fe9-a963-4d39-ab65-d65399c506ea';
  _admin uuid := '0c96561f-ee40-411a-9166-4e29ee38cad1';
  _prov uuid := 'a9a70001-0000-4000-8000-000000000005';
  _bk uuid := '9aeb2516-0fde-41fd-8737-39749708b677';
  _out text := '';
  _b public.mkt_realestate_bookings;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'not allowed'; END IF;

  -- 1) provider self-verification (owner, non-admin)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _owner, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE public.mkt_realestate_providers SET verification_status = 'verified', verified_at = now() WHERE id = _prov;
    _out := _out || E'A) provider self-verify: NO ERROR (FAIL)\n';
  EXCEPTION WHEN others THEN
    _out := _out || 'A) provider self-verify BLOCKED: ' || SQLSTATE || ' ' || SQLERRM || E'\n';
  END;

  -- 2) customer self-acceptance: reset to pending as admin first
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  UPDATE public.mkt_realestate_bookings SET status = 'pending' WHERE id = _bk;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _cust, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE public.mkt_realestate_bookings SET status = 'accepted' WHERE id = _bk;
    _out := _out || E'B) customer self-accept: NO ERROR (FAIL)\n';
  EXCEPTION WHEN others THEN
    _out := _out || 'B) customer self-accept BLOCKED: ' || SQLSTATE || ' ' || SQLERRM || E'\n';
  END;

  BEGIN
    UPDATE public.mkt_realestate_bookings SET customer_phone = '+900000000' WHERE id = _bk;
    _out := _out || E'C) customer column tamper: NO ERROR (FAIL)\n';
  EXCEPTION WHEN others THEN
    _out := _out || 'C) customer column tamper BLOCKED: ' || SQLSTATE || ' ' || SQLERRM || E'\n';
  END;

  -- 3) legit definer path: provider owner decides
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _owner, 'role', 'authenticated')::text, true);
  _b := public.mkt_re_booking_decide(_bk, true, 'qa probe');
  _out := _out || 'D) mkt_re_booking_decide by provider owner -> status=' || _b.status || E' (PASS)\n';

  -- 4) legit customer cancel path
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _cust, 'role', 'authenticated')::text, true);
  UPDATE public.mkt_realestate_bookings SET status = 'cancelled_by_customer' WHERE id = _bk
    RETURNING * INTO _b;
  _out := _out || 'E) customer cancel accepted booking -> status=' || _b.status || E' (PASS)\n';

  -- 5) admin can set verification fields
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  UPDATE public.mkt_realestate_providers SET verification_status = 'verified', verified_at = now() WHERE id = _prov;
  _out := _out || E'F) admin verification update -> OK (PASS)\n';

  -- restore original state
  UPDATE public.mkt_realestate_providers SET verification_status = 'unverified', verified_at = NULL WHERE id = _prov;
  UPDATE public.mkt_realestate_bookings
     SET status = 'accepted', decided_at = NULL, decided_by = NULL, decision_reason = NULL,
         customer_phone = (SELECT customer_phone FROM public.mkt_realestate_bookings WHERE id = _bk)
   WHERE id = _bk;
  _out := _out || 'restored original rows';
  RETURN _out;
END $$;

REVOKE ALL ON FUNCTION public.mkt_qa_rls_probe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_qa_rls_probe() TO service_role;