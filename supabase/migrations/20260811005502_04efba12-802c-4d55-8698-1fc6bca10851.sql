CREATE OR REPLACE FUNCTION public.mkt_message_reports_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.message_id := OLD.message_id;
    NEW.conversation_id := OLD.conversation_id;
    NEW.reporter_user_id := OLD.reporter_user_id;
    NEW.created_at := OLD.created_at;
    IF NEW.status <> OLD.status THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_message_reports_guard() FROM PUBLIC, anon;