insert into public.custody_transactions
  (tenant_id, supervisor_id, project_id, txn_type, amount, txn_date, status,
   reason, reversal_of_id, approved_by, approved_at, created_by)
select c.tenant_id, c.supervisor_id, c.project_id, 'reversal', c.amount, current_date, 'approved',
       'pre-release cleanup: reversal of CTV test custody entry', c.id, c.approved_by, now(), c.created_by
from public.custody_transactions c
join public.projects p on p.id = c.project_id
where p.code in ('CTV1','CTV2')
  and c.status = 'approved' and c.txn_type <> 'reversal' and c.deleted_at is null
  and not exists (select 1 from public.custody_transactions r where r.reversal_of_id = c.id and r.deleted_at is null);

update public.requests r
set deleted_at = coalesce(r.deleted_at, now()),
    delete_reason = coalesce(r.delete_reason, 'CTV test data cleanup before release')
from public.projects p
where p.id = r.project_id and p.code in ('CTV1','CTV2');

update public.projects
set deleted_at = coalesce(deleted_at, now()),
    delete_reason = coalesce(delete_reason, 'CTV test project cleanup before release'),
    updated_at = now()
where code in ('CTV1','CTV2');
