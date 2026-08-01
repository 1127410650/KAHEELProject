DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email='test-account-flow-1@example.com';
  DELETE FROM public.tenant_invitations WHERE email='test-account-flow-1@example.com';
  IF _uid IS NOT NULL THEN
    DELETE FROM public.user_permissions WHERE user_id=_uid;
    DELETE FROM public.user_roles WHERE user_id=_uid;
    DELETE FROM public.project_members WHERE user_id=_uid;
    DELETE FROM public.tenant_memberships WHERE user_id=_uid;
    UPDATE public.tenants SET deleted_at=now() WHERE personal_user_id=_uid;
  END IF;
END $$;