DO $$
DECLARE t uuid;
  stf uuid := '561e765a-90f0-42b5-9634-75ff35696702';
  rep uuid := '72bbb63a-2d7c-451f-9d88-89ff6a8453fe';
BEGIN
  DELETE FROM public.mkt_staff_permissions WHERE user_id = stf;
  INSERT INTO public.mkt_staff_permissions (user_id, perm)
  SELECT stf, p FROM unnest(ARRAY[
    'reports.inbox_view','reports.review','reports.assign','reports.message_reporter',
    'reports.message_advertiser','reports.add_internal_note','reports.close','reports.reopen',
    'reports.escalate','reports.merge','reports.audit_view',
    'ads.moderation_hide','ads.moderation_suspend','accounts.restrict','appeals.review']) AS p
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = rep) THEN
    INSERT INTO public.tenants (name_ar, name_en, tenant_type, status, is_test, created_by, personal_user_id)
    VALUES ('QA مبلّغ اختبار', 'QA Reporter Test', 'individual', 'active', true, rep, rep)
    RETURNING id INTO t;
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES (t, rep, 'accountant', 'active');
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (rep, 'accountant', t)
    ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET active_tenant_id = t WHERE user_id = rep;
  END IF;
END $$;