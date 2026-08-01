DO $$
DECLARE r RECORD; v_target uuid;
BEGIN
  FOR r IN
    SELECT p.user_id, p.active_tenant_id,
      (SELECT count(*) FROM public.tenant_memberships m
         JOIN public.tenants t2 ON t2.id = m.tenant_id
        WHERE m.user_id = p.user_id AND m.status = 'active'
          AND t2.status = 'active' AND t2.deleted_at IS NULL) AS active_cnt,
      (SELECT m.tenant_id FROM public.tenant_memberships m
         JOIN public.tenants t2 ON t2.id = m.tenant_id
        WHERE m.user_id = p.user_id AND m.status = 'active'
          AND t2.status = 'active' AND t2.deleted_at IS NULL
        LIMIT 1) AS only_tenant
    FROM public.profiles p
    JOIN public.tenants t ON t.id = p.active_tenant_id
    WHERE t.status <> 'active' OR t.deleted_at IS NOT NULL
  LOOP
    v_target := CASE WHEN r.active_cnt = 1 THEN r.only_tenant ELSE NULL END;

    INSERT INTO public.audit_log (actor_id, entity_type, entity_id, action, old_value, new_value, reason, tenant_id)
    VALUES (NULL, 'profile', r.user_id, 'repair_active_tenant',
      jsonb_build_object('active_tenant_id', r.active_tenant_id),
      jsonb_build_object('active_tenant_id', v_target),
      'operational closure: archived tenant pointer cleared', r.active_tenant_id);

    UPDATE public.profiles SET active_tenant_id = v_target WHERE user_id = r.user_id;
  END LOOP;
END $$;