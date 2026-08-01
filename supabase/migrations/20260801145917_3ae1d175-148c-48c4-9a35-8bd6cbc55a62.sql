-- 1) Personal workspaces are no longer provisioned on demand.
CREATE OR REPLACE FUNCTION public.ensure_personal_tenant()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _tid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- Read-only from now on: signing in must never create a workspace. New members
  -- get access from an invitation or from an administrator creating the user.
  SELECT id INTO _tid FROM public.tenants
   WHERE personal_user_id = _uid AND deleted_at IS NULL;

  RETURN _tid;
END $function$;

REVOKE EXECUTE ON FUNCTION public.ensure_personal_tenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_personal_tenant() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_personal_tenant() FROM authenticated;

-- 2) Every new workspace is recorded: who, when, and where it came from.
CREATE OR REPLACE FUNCTION public.log_tenant_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE _source text;
BEGIN
  _source := CASE
    WHEN NEW.personal_user_id IS NOT NULL THEN 'personal_tenant'
    WHEN auth.uid() IS NULL THEN 'server_or_migration'
    ELSE 'admin_action'
  END;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, new_value, reason, tenant_id)
  VALUES (
    coalesce(auth.uid(), NEW.created_by),
    'tenant', NEW.id, 'create',
    jsonb_build_object(
      'tenant_type', NEW.tenant_type,
      'source', _source,
      'is_personal', NEW.personal_user_id IS NOT NULL,
      'created_at', NEW.created_at
    ),
    'tenant created via ' || _source,
    NEW.id
  );
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_log_tenant_creation ON public.tenants;
CREATE TRIGGER trg_log_tenant_creation
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.log_tenant_creation();

-- 3) System administrator must set a new password on next sign-in.
--    The existing password is neither changed nor revealed here.
UPDATE public.profiles SET must_change_password = true, updated_at = now()
WHERE lower(email) = 'o11339911@gmail.com';