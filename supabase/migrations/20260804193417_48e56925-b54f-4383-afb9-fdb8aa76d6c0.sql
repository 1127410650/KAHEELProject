DO $$
DECLARE v_a uuid := '221ccf76-17e0-42b9-a504-48cf204b9e32';
        v_c uuid := 'e75ef438-6b61-47de-b0fd-6f1ea4cc4a2f';
        v_t uuid;
BEGIN
  INSERT INTO public.tenants (name_ar, name_en, tenant_type, status, is_test, created_by)
  VALUES ('منشأة اختبار التبديل', 'QA Switch Establishment', 'company', 'active', true, v_a)
  RETURNING id INTO v_t;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, joined_at, created_by)
  VALUES (v_t, v_a, 'owner', 'active', now(), v_a);

  INSERT INTO public.mkt_business_profiles (tenant_id, slug, display_name_ar, display_name_en, categories, is_published, verification_status, city, qa_batch_id)
  VALUES (v_t, 'qa-switch-establishment', 'منشأة اختبار التبديل', 'QA Switch Establishment', '{}', true, 'unverified', 'الرياض', 'qa-switch-2026-08-04-v1');

  INSERT INTO public.mkt_platform_admins (user_id, platform_role, granted_reason, created_by)
  VALUES (v_c, 'platform_admin', 'qa-switch-2026-08-04-v1 admin isolation proof', v_c)
  ON CONFLICT (user_id) DO UPDATE SET platform_role = 'platform_admin';
END $$;