-- 1) Tenant-scoped identity review: only while an open verification request exists
CREATE OR REPLACE FUNCTION public.mkt_can_review_identity_for(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _tenant_id IS NOT NULL
     AND public.mkt_can_review_identity()
     AND EXISTS (
       SELECT 1 FROM public.mkt_verification_requests r
        WHERE r.tenant_id = _tenant_id
          AND coalesce(r.status,'pending') NOT IN ('approved','rejected','cancelled','withdrawn')
     )
$function$;

-- 2) Registry: principals of the business, or a scoped reviewer
DROP POLICY IF EXISTS mkt_business_registry_read ON public.mkt_business_registry;
CREATE POLICY mkt_business_registry_read
ON public.mkt_business_registry
FOR SELECT TO authenticated
USING (
  public.mkt_is_business_principal(tenant_id)
  OR public.mkt_can_review_identity_for(tenant_id)
);

-- 3) Officers: principals, the officer themself, or a scoped reviewer
DROP POLICY IF EXISTS mkt_business_officers_read ON public.mkt_business_officers;
CREATE POLICY mkt_business_officers_read
ON public.mkt_business_officers
FOR SELECT TO authenticated
USING (
  public.mkt_is_business_principal(tenant_id)
  OR user_id = auth.uid()
  OR public.mkt_can_review_identity_for(tenant_id)
);

-- 4) Column-level: id_number is never readable through the Data API
REVOKE SELECT ON public.mkt_business_officers FROM authenticated;
REVOKE SELECT ON public.mkt_business_officers FROM anon;
GRANT SELECT (
  id, tenant_id, user_id, full_name, id_type, id_last2, capacity, relation,
  phone, email, authorization_expires_on, is_primary, created_by, created_at, updated_at
) ON public.mkt_business_officers TO authenticated;

-- 5) Audit reviewer access to official business data
CREATE OR REPLACE FUNCTION public.mkt_log_registry_review(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _tenant_id IS NULL OR auth.uid() IS NULL THEN RETURN; END IF;
  IF public.mkt_is_business_principal(_tenant_id) THEN RETURN; END IF;
  INSERT INTO public.mkt_store_audit (actor_user_id, action, target_type, target_id, note)
  VALUES (auth.uid(), 'registry.review_read', 'tenant', _tenant_id,
          'reviewer read official business data');
EXCEPTION WHEN others THEN
  RETURN;
END;
$function$;

-- 6) Call signaling hygiene: purge expired signaling rows automatically
CREATE OR REPLACE FUNCTION public.mkt_call_signals_purge_expired()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.mkt_call_signals WHERE expires_at <= now();
$function$;

ALTER TABLE public.mkt_call_signals
  ALTER COLUMN expires_at SET NOT NULL;
