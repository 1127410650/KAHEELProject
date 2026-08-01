UPDATE public.tenants
   SET status = 'archived', deleted_at = COALESCE(deleted_at, now())
 WHERE name_ar IN ('TEST-TENANT-A','TEST-TENANT-B','PROBE');

DELETE FROM public.tenant_memberships m
 USING public.tenants t
 WHERE m.tenant_id = t.id AND t.status = 'archived';

UPDATE public.profiles p
   SET active_tenant_id = NULL
 WHERE p.active_tenant_id IN (SELECT id FROM public.tenants WHERE status = 'archived');