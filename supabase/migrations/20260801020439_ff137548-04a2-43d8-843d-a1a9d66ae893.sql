create or replace function public.can_view_property(_project_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.is_accountant()
      or (public.can_access_project(_project_id)
          and (public.has_perm('property.view')
               or public.has_perm('property.edit')
               or public.has_perm('property.approve')))
$$;

create or replace function public.can_view_property_documents(_project_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.is_accountant()
      or (public.can_view_property(_project_id)
          and (public.has_perm('property_documents.view')
               or public.has_perm('property_documents.upload')
               or public.has_perm('property_documents.manage')))
$$;

create or replace function public.can_view_property_services(_project_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.is_accountant()
      or (public.can_view_property(_project_id)
          and (public.has_perm('property_services.view')
               or public.has_perm('property_services.update')
               or public.has_perm('property_services.approve')))
$$;

grant execute on function public.can_view_property_documents(uuid) to authenticated;
grant execute on function public.can_view_property_services(uuid) to authenticated;

drop policy if exists doc_select on public.property_documents;
create policy doc_select on public.property_documents for select to authenticated
using (
  public.can_view_property_documents(project_id)
  and (deleted_at is null or public.is_accountant())
  and (
    visibility = 'project_shared'
    or (visibility = 'requester_private' and (created_by = auth.uid() or public.is_staff()))
    or (visibility = 'internal' and public.is_staff())
    or (visibility = 'sensitive' and (public.is_accountant() or public.has_perm('property_documents.manage')))
  )
);

drop policy if exists svc_select on public.property_services;
create policy svc_select on public.property_services for select to authenticated
using (public.can_view_property_services(project_id));

drop policy if exists svcres_select on public.property_service_results;
create policy svcres_select on public.property_service_results for select to authenticated
using (public.can_view_property_services(project_id));