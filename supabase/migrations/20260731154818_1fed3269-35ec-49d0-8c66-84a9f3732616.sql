CREATE OR REPLACE FUNCTION public.request_can_transition(_from text, _to text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE f text := CASE WHEN _from = 'new' THEN 'awaiting_reply' ELSE _from END;
BEGIN
  IF f = _to THEN RETURN true; END IF;
  RETURN CASE f
    WHEN 'awaiting_reply'     THEN _to IN ('under_review','assigned','cancelled','rejected')
    WHEN 'under_review'       THEN _to IN ('assigned','processing','needs_info','awaiting_approval','cancelled','rejected')
    WHEN 'assigned'           THEN _to IN ('processing','needs_info','awaiting_approval','cancelled','rejected')
    WHEN 'processing'          THEN _to IN ('needs_info','awaiting_approval','awaiting_payment','cancelled','rejected')
    WHEN 'needs_info'          THEN _to IN ('supervisor_replied','cancelled','rejected')
    WHEN 'supervisor_replied'  THEN _to IN ('review_after_info','cancelled')
    WHEN 'review_after_info'   THEN _to IN ('processing','needs_info','awaiting_approval','cancelled','rejected')
    WHEN 'awaiting_approval'   THEN _to IN ('approved','rejected','needs_info','cancelled')
    WHEN 'approved'            THEN _to IN ('awaiting_execution','executing','executed','cancelled')
    WHEN 'awaiting_execution'  THEN _to IN ('executing','executed','awaiting_payment','cancelled')
    WHEN 'executing'           THEN _to IN ('executed','awaiting_payment','cancelled')
    WHEN 'executed'            THEN _to IN ('completed','awaiting_payment')
    WHEN 'awaiting_payment'    THEN _to IN ('paid','cancelled')
    WHEN 'paid'                THEN _to IN ('executed','completed')
    ELSE false
  END;
END $function$;