-- 0) test-tenant set (name-marked only)
create temporary table _tt as
select id from public.tenants
where name_ar ilike '%test%' or coalesce(name_en,'') ilike '%test%'
   or name_ar ilike '%ctv%' or coalesce(name_en,'') ilike '%ctv%';

-- personal tenants belonging to test-only auth accounts
insert into _tt(id)
select t.id from public.tenants t
join public.tenant_memberships m on m.tenant_id = t.id
join auth.users u on u.id = m.user_id
where t.tenant_type = 'individual'
  and (u.email like '%@tahqaq.test' or u.email ilike 'test.%@example.com' or u.email ilike 'isolation-%')
  and t.id not in (select id from _tt);

-- 1) reverse approved test custody movements (no deletes, one reversal max)
insert into public.custody_transactions
  (tenant_id, supervisor_id, project_id, txn_type, amount, txn_date, status,
   reason, reversal_of_id, approved_by, approved_at, created_by)
select c.tenant_id, c.supervisor_id, c.project_id, 'reversal', c.amount, current_date, 'approved',
       'pre-release cleanup: reversal of test custody entry', c.id, c.approved_by, now(), c.created_by
from public.custody_transactions c
where c.tenant_id in (select id from _tt)
  and c.status = 'approved'
  and c.txn_type <> 'reversal'
  and c.deleted_at is null
  and not exists (
    select 1 from public.custody_transactions r
    where r.reversal_of_id = c.id and r.deleted_at is null
  );

-- 2) revoke pending test invitations
update public.tenant_invitations
set status = 'revoked', revoked_at = now(), updated_at = now()
where tenant_id in (select id from _tt) and status = 'pending';

-- 3) suspend test memberships
update public.tenant_memberships
set status = 'suspended', updated_at = now()
where tenant_id in (select id from _tt) and status <> 'suspended';

-- 4) archive test projects
update public.projects
set deleted_at = coalesce(deleted_at, now()),
    delete_reason = coalesce(delete_reason, 'pre-release cleanup: test data'),
    updated_at = now()
where tenant_id in (select id from _tt);

-- 5) archive test tenants
update public.tenants
set is_test = true, status = 'archived',
    deleted_at = coalesce(deleted_at, now()), updated_at = now()
where id in (select id from _tt);

-- 6) drop orphan memberships (auth user no longer exists)
delete from public.tenant_memberships m
where not exists (select 1 from auth.users u where u.id = m.user_id);

-- 7) drop roles/permissions left without an active membership
delete from public.user_roles ur
where not exists (
  select 1 from public.tenant_memberships m
  where m.user_id = ur.user_id and m.tenant_id = ur.tenant_id and m.status = 'active'
);
delete from public.user_permissions up
where not exists (
  select 1 from public.tenant_memberships m
  where m.user_id = up.user_id and m.tenant_id = up.tenant_id and m.status = 'active'
);
