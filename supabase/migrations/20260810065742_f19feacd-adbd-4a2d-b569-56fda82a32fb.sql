CREATE OR REPLACE FUNCTION public.mkt_re_decide_extension(
  _extension_id uuid,
  _accept boolean,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _e public.mkt_realestate_booking_extensions;
BEGIN
  SELECT * INTO _e FROM public.mkt_realestate_booking_extensions
  WHERE id = _extension_id AND deleted_at IS NULL;

  IF _e.id IS NULL THEN
    RAISE EXCEPTION 'طلب التمديد غير موجود.';
  END IF;
  IF NOT (public.mkt_re_is_member(_e.provider_id) OR public.mkt_is_platform_admin()) THEN
    RAISE EXCEPTION 'لا تملك صلاحية البتّ في هذا الطلب.';
  END IF;
  IF _e.status <> 'pending' THEN
    RAISE EXCEPTION 'تمّ البتّ في هذا الطلب مسبقًا.';
  END IF;
  IF _e.expires_at < now() THEN
    UPDATE public.mkt_realestate_booking_extensions
      SET status = 'expired' WHERE id = _e.id;
    RAISE EXCEPTION 'انتهت مهلة الرد على هذا الطلب.';
  END IF;

  UPDATE public.mkt_realestate_booking_extensions
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END,
        decided_at = now(),
        decided_by = auth.uid(),
        decision_reason = NULLIF(btrim(COALESCE(_reason, '')), '')
    WHERE id = _e.id;

  IF _accept THEN
    UPDATE public.mkt_realestate_bookings
      SET previous_check_out = check_out,
          check_out = _e.new_check_out,
          extended_at = now(),
          extension_count = extension_count + 1,
          extension_id = _e.id
      WHERE id = _e.booking_id;
  END IF;

  BEGIN
    INSERT INTO public.mkt_notifications (user_id, event, title, body)
    VALUES (
      _e.requested_by,
      'aqar_extension_decided',
      CASE WHEN _accept THEN 'تم تمديد حجزك' ELSE 'رُفض طلب التمديد' END,
      CASE WHEN _accept
        THEN 'وافق المعلن على التمديد حتى ' || to_char(_e.new_check_out, 'DD/MM/YYYY') || '.'
        ELSE 'لم يوافق المعلن على تمديد الحجز.'
      END
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- التنبيه ثانوي: لا يُفشل قرار التمديد
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_re_decide_extension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_re_decide_extension(uuid, boolean, text) TO authenticated;