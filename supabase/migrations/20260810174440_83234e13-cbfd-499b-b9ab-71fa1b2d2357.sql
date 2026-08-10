-- ITEM 1a: providers cannot self-verify
CREATE OR REPLACE FUNCTION public.mkt_re_guard_provider_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at)
     AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'verification fields are admin-only: use mkt_re_verification_review'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_guard_provider_update ON public.mkt_realestate_providers;
CREATE TRIGGER trg_re_guard_provider_update
  BEFORE UPDATE ON public.mkt_realestate_providers
  FOR EACH ROW EXECUTE FUNCTION public.mkt_re_guard_provider_update();

-- ITEM 1b: customers may only cancel their own booking
CREATE OR REPLACE FUNCTION public.mkt_re_guard_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  -- provider staff, owners and platform admins keep the definer/staff paths
  IF _actor IS NULL
     OR public.mkt_re_is_member(OLD.provider_id)
     OR public.mkt_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.customer_user_id = _actor THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status <> 'cancelled_by_customer'
         OR OLD.status NOT IN ('pending', 'accepted') THEN
        RAISE EXCEPTION 'customers may only cancel a pending or accepted booking'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
       OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
       OR NEW.room_type_id IS DISTINCT FROM OLD.room_type_id
       OR NEW.customer_user_id IS DISTINCT FROM OLD.customer_user_id
       OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
       OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
       OR NEW.check_in IS DISTINCT FROM OLD.check_in
       OR NEW.check_out IS DISTINCT FROM OLD.check_out
       OR NEW.guests IS DISTINCT FROM OLD.guests
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
       OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
       OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       OR NEW.deleted_reason IS DISTINCT FROM OLD.deleted_reason
       OR NEW.extended_at IS DISTINCT FROM OLD.extended_at
       OR NEW.extension_count IS DISTINCT FROM OLD.extension_count
       OR NEW.previous_check_out IS DISTINCT FROM OLD.previous_check_out
       OR NEW.extension_id IS DISTINCT FROM OLD.extension_id THEN
      RAISE EXCEPTION 'customers may only change the booking status to cancelled_by_customer'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_re_guard_booking_update ON public.mkt_realestate_bookings;
CREATE TRIGGER trg_re_guard_booking_update
  BEFORE UPDATE ON public.mkt_realestate_bookings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_re_guard_booking_update();