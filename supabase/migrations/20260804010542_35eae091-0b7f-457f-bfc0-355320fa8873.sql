-- internal enqueue: no caller permission check, used by triggers only
CREATE OR REPLACE FUNCTION public.mkt_workforce_autoqueue(
  _kind text, _subject_id uuid, _priority text DEFAULT 'normal'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _pick uuid; _auto boolean; _id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.mkt_admin_assignments
              WHERE kind = _kind AND subject_id = _subject_id
                AND released_at IS NULL AND closed_at IS NULL) THEN
    RETURN;
  END IF;

  SELECT COALESCE((value->>'enabled')::boolean, true) INTO _auto
    FROM public.mkt_platform_settings WHERE key = 'workforce.auto_assign';
  IF COALESCE(_auto, true) THEN _pick := public.mkt_workforce_pick_assignee(_kind); END IF;

  INSERT INTO public.mkt_admin_assignments
    (kind, subject_id, assignee, claimed_at, priority, auto_assigned)
  VALUES (_kind, _subject_id, _pick, CASE WHEN _pick IS NULL THEN NULL ELSE now() END,
          COALESCE(_priority,'normal'), _pick IS NOT NULL)
  RETURNING id INTO _id;

  IF _pick IS NOT NULL THEN
    UPDATE public.mkt_staff_status SET last_assigned_at = now() WHERE user_id = _pick;
    PERFORM public.mkt_notify(_pick, NULL, 'work_assigned', 'تم إسناد عمل جديد إليك', NULL);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_autoqueue(text, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mkt_workforce_close_item(_kind text, _subject_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.mkt_admin_assignments
     SET closed_at = now(), progress = 'done', last_action_at = now()
   WHERE kind = _kind AND subject_id = _subject_id
     AND released_at IS NULL AND closed_at IS NULL
$$;
REVOKE EXECUTE ON FUNCTION public.mkt_workforce_close_item(text, uuid) FROM PUBLIC, anon, authenticated;

-- listings: entering review enqueues, leaving review closes
CREATE OR REPLACE FUNCTION public.mkt_listing_workforce_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    PERFORM public.mkt_workforce_autoqueue('listing_review', NEW.id, 'normal');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    PERFORM public.mkt_workforce_close_item('listing_review', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mkt_listing_workforce ON public.mkt_listings;
CREATE TRIGGER trg_mkt_listing_workforce
  AFTER INSERT OR UPDATE OF status ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_workforce_sync();

-- reports
CREATE OR REPLACE FUNCTION public.mkt_report_workforce_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mkt_workforce_autoqueue('report', NEW.id, 'high');
  ELSIF NEW.status IN ('closed','rejected','resolved','dismissed','merged') THEN
    PERFORM public.mkt_workforce_close_item('report', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mkt_report_workforce ON public.mkt_reports;
CREATE TRIGGER trg_mkt_report_workforce
  AFTER INSERT OR UPDATE OF status ON public.mkt_reports
  FOR EACH ROW EXECUTE FUNCTION public.mkt_report_workforce_sync();

-- verification requests
CREATE OR REPLACE FUNCTION public.mkt_verification_workforce_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mkt_workforce_autoqueue('verification', NEW.id, 'normal');
  ELSIF NEW.status IN ('approved','rejected','cancelled','withdrawn') THEN
    PERFORM public.mkt_workforce_close_item('verification', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mkt_verification_workforce ON public.mkt_verification_requests;
CREATE TRIGGER trg_mkt_verification_workforce
  AFTER INSERT OR UPDATE OF status ON public.mkt_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_verification_workforce_sync();

-- backfill: everything currently waiting joins the shared list (unassigned)
INSERT INTO public.mkt_admin_assignments (kind, subject_id, priority)
SELECT 'listing_review', l.id, 'normal' FROM public.mkt_listings l
 WHERE l.status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM public.mkt_admin_assignments a
                    WHERE a.kind = 'listing_review' AND a.subject_id = l.id
                      AND a.released_at IS NULL AND a.closed_at IS NULL);

INSERT INTO public.mkt_admin_assignments (kind, subject_id, priority)
SELECT 'verification', v.id, 'normal' FROM public.mkt_verification_requests v
 WHERE v.status NOT IN ('approved','rejected','cancelled','withdrawn')
   AND NOT EXISTS (SELECT 1 FROM public.mkt_admin_assignments a
                    WHERE a.kind = 'verification' AND a.subject_id = v.id
                      AND a.released_at IS NULL AND a.closed_at IS NULL);