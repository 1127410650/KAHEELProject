DO $$
DECLARE t uuid; l uuid;
  adv uuid := 'c8609fe8-0e00-48b9-a961-cc19fe39b752';
  cfl uuid := '37151595-67e9-436e-b719-7a3fdd1168aa';
  stf uuid := '561e765a-90f0-42b5-9634-75ff35696702';
  adm uuid := '0c96561f-ee40-411a-9166-4e29ee38cad1';
  cat uuid := 'c163ed6c-693b-4f5f-8508-60628e2a5d22';
BEGIN
  INSERT INTO public.mkt_platform_admins (user_id) VALUES (adm) ON CONFLICT DO NOTHING;

  INSERT INTO public.mkt_staff_permissions (user_id, perm)
  SELECT stf, p FROM unnest(ARRAY['reports.inbox_view','reports.assign','reports.triage','reports.message_reporter',
    'reports.message_advertiser','reports.notes','reports.close','reports.reopen','reports.merge',
    'listings.hide','listings.suspend','accounts.restrict','appeals.review']) AS p
  ON CONFLICT DO NOTHING;

  INSERT INTO public.tenants (name_ar, name_en, tenant_type, status, is_test, created_by)
  VALUES ('QA منشأة اختبار البلاغات', 'QA Reports Test Business', 'company', 'active', true, adv)
  RETURNING id INTO t;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (t, adv, 'accountant', 'active'), (t, cfl, 'employee', 'active');

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (adv, 'accountant', t), (cfl, 'employee', t)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET active_tenant_id = t, full_name = COALESCE(full_name, 'QA advertiser') WHERE user_id = adv;
  UPDATE public.profiles SET active_tenant_id = t, full_name = COALESCE(full_name, 'QA conflict staff') WHERE user_id = cfl;
  UPDATE public.profiles SET full_name = COALESCE(full_name, 'QA reporter') WHERE user_id = '72bbb63a-2d7c-451f-9d88-89ff6a8453fe';
  UPDATE public.profiles SET full_name = COALESCE(full_name, 'QA review staff') WHERE user_id = stf;
  UPDATE public.profiles SET full_name = COALESCE(full_name, 'QA platform admin') WHERE user_id = adm;

  -- Act as the QA platform admin so the marketplace verification/publish guards accept the seed rows.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm::text, 'role', 'authenticated')::text, true);

  INSERT INTO public.mkt_business_profiles (tenant_id, slug, display_name_ar, display_name_en, headline, about, city, region, categories, is_published, verification_status, verified_at, verified_by)
  VALUES (t, 'qa-reports-test-' || substr(t::text, 1, 8), 'QA منشأة اختبار البلاغات', 'QA Reports Test Business',
          'منشأة اختبار داخلي', 'بيانات اختبار لمرحلة البلاغات فقط.', 'الرياض', 'الرياض', ARRAY[cat], true, 'verified', now(), adm);

  INSERT INTO public.mkt_listings (owner_user_id, tenant_id, type_code, category_id, title, summary, description, price, city, region, status, published_at)
  VALUES (adv, t, 'service', cat, 'QA إعلان اختبار البلاغات', 'إعلان اختبار داخلي لمرحلة البلاغات',
          'هذا إعلان اختبار داخلي لا يمثل خدمة حقيقية.', 1000, 'الرياض', 'الرياض', 'published', now())
  RETURNING id INTO l;

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'qa tenant=% listing=%', t, l;
END $$;