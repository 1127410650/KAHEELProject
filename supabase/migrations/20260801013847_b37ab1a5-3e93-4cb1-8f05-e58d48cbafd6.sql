-- ===== helpers =====
create or replace function public.can_view_property(_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_accountant()
      or (public.can_access_project(_project_id)
          and (public.is_staff() or public.has_perm('property.view') or public.has_perm('projects.view_assigned')))
$$;

create or replace function public.can_edit_property(_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_accountant()
      or (public.can_access_project(_project_id) and public.has_perm('property.edit'))
$$;

create or replace function public.can_approve_property(_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_accountant()
      or (public.can_access_project(_project_id) and public.has_perm('property.approve'))
$$;

create or replace function public.property_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.property_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  _id := case when tg_op = 'DELETE' then (to_jsonb(old)->>'id')::uuid else (to_jsonb(new)->>'id')::uuid end;
  insert into public.audit_log(actor_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), tg_table_name, _id,
          case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'soft_delete' end,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ===== 1. project type =====
do $$ begin
  if not exists (select 1 from pg_type where typname = 'project_kind') then
    create type public.project_kind as enum ('real_estate','construction','maintenance','supply','general');
  end if;
end $$;

alter table public.projects
  add column if not exists project_type public.project_kind not null default 'general';

-- ===== 2. land & location =====
create table if not exists public.property_land (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  region text, amanah text, municipality text, city text, district text,
  plan_no text, block_no text, parcel_no text, property_no text,
  land_use text, land_area numeric(14,2),
  street_name text, street_width numeric(10,2),
  national_address text, postal_code text, additional_no text,
  map_url text, latitude numeric(10,7), longitude numeric(10,7),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_land to authenticated;
grant all on public.property_land to service_role;
alter table public.property_land enable row level security;
create policy "land_select" on public.property_land for select to authenticated using (public.can_view_property(project_id));
create policy "land_insert" on public.property_land for insert to authenticated with check (public.can_edit_property(project_id));
create policy "land_update" on public.property_land for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "land_delete" on public.property_land for delete to authenticated using (public.is_accountant());
create trigger property_land_touch before update on public.property_land for each row execute function public.property_touch();
create trigger property_land_audit after insert or update on public.property_land for each row execute function public.property_audit();

create table if not exists public.property_boundaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  side text not null check (side in ('north','south','east','west')),
  description text, length_m numeric(12,2), setback_m numeric(12,2), projection_m numeric(12,2), notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, side)
);
grant select, insert, update, delete on public.property_boundaries to authenticated;
grant all on public.property_boundaries to service_role;
alter table public.property_boundaries enable row level security;
create policy "bnd_select" on public.property_boundaries for select to authenticated using (public.can_view_property(project_id));
create policy "bnd_insert" on public.property_boundaries for insert to authenticated with check (public.can_edit_property(project_id));
create policy "bnd_update" on public.property_boundaries for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "bnd_delete" on public.property_boundaries for delete to authenticated using (public.can_edit_property(project_id));
create trigger property_boundaries_touch before update on public.property_boundaries for each row execute function public.property_touch();

create table if not exists public.property_coordinates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text, latitude numeric(10,7) not null, longitude numeric(10,7) not null, notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_coordinates to authenticated;
grant all on public.property_coordinates to service_role;
alter table public.property_coordinates enable row level security;
create policy "coord_select" on public.property_coordinates for select to authenticated using (public.can_view_property(project_id));
create policy "coord_insert" on public.property_coordinates for insert to authenticated with check (public.can_edit_property(project_id));
create policy "coord_update" on public.property_coordinates for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "coord_delete" on public.property_coordinates for delete to authenticated using (public.can_edit_property(project_id));

-- ===== 3. deeds =====
create table if not exists public.property_deeds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  doc_type text not null default 'deed',
  deed_no text, registry_property_no text, copy_no text,
  issue_date date, deed_date date, issuer text,
  doc_status text not null default 'active',
  verify_url text, qr_payload text, owner_registry_no text, notes text,
  version integer not null default 1,
  is_current boolean not null default true,
  previous_id uuid references public.property_deeds(id) on delete set null,
  attachment_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_deeds to authenticated;
grant all on public.property_deeds to service_role;
alter table public.property_deeds enable row level security;
create policy "deed_select" on public.property_deeds for select to authenticated using (public.can_view_property(project_id));
create policy "deed_insert" on public.property_deeds for insert to authenticated with check (public.can_edit_property(project_id));
create policy "deed_update" on public.property_deeds for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "deed_delete" on public.property_deeds for delete to authenticated using (public.is_accountant());
create trigger property_deeds_touch before update on public.property_deeds for each row execute function public.property_touch();
create trigger property_deeds_audit after insert or update on public.property_deeds for each row execute function public.property_audit();

-- new version supersedes previous without deleting it
create or replace function public.property_deed_add_version(_previous_id uuid, _payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _prev public.property_deeds; _new_id uuid;
begin
  select * into _prev from public.property_deeds where id = _previous_id;
  if not found then raise exception 'DEED_NOT_FOUND'; end if;
  if not public.can_edit_property(_prev.project_id) then raise exception 'NOT_ALLOWED'; end if;
  insert into public.property_deeds(project_id, doc_type, deed_no, registry_property_no, copy_no,
    issue_date, deed_date, issuer, doc_status, verify_url, qr_payload, owner_registry_no, notes,
    version, is_current, previous_id, attachment_id, created_by)
  values (_prev.project_id,
    coalesce(_payload->>'doc_type', _prev.doc_type),
    coalesce(_payload->>'deed_no', _prev.deed_no),
    coalesce(_payload->>'registry_property_no', _prev.registry_property_no),
    _payload->>'copy_no',
    nullif(_payload->>'issue_date','')::date,
    nullif(_payload->>'deed_date','')::date,
    coalesce(_payload->>'issuer', _prev.issuer),
    coalesce(_payload->>'doc_status','active'),
    _payload->>'verify_url', _payload->>'qr_payload',
    coalesce(_payload->>'owner_registry_no', _prev.owner_registry_no),
    _payload->>'notes',
    _prev.version + 1, true, _prev.id,
    nullif(_payload->>'attachment_id','')::uuid, auth.uid())
  returning id into _new_id;
  update public.property_deeds set is_current = false, doc_status = 'superseded' where id = _prev.id;
  return _new_id;
end $$;

-- ===== 4. owners =====
create table if not exists public.property_owners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid,
  full_name text not null,
  id_type text, id_number text, nationality text,
  share_percent numeric(6,3) not null default 0 check (share_percent >= 0 and share_percent <= 100),
  ownership_start date, ownership_end date,
  transfer_value numeric(14,2), purchase_date date, notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_owners to authenticated;
grant all on public.property_owners to service_role;
alter table public.property_owners enable row level security;
create policy "own_select" on public.property_owners for select to authenticated using (public.can_view_property(project_id));
create policy "own_insert" on public.property_owners for insert to authenticated with check (public.can_edit_property(project_id));
create policy "own_update" on public.property_owners for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "own_delete" on public.property_owners for delete to authenticated using (public.is_accountant());
create trigger property_owners_touch before update on public.property_owners for each row execute function public.property_touch();
create trigger property_owners_audit after insert or update on public.property_owners for each row execute function public.property_audit();

create or replace function public.property_owners_share_guard()
returns trigger language plpgsql set search_path = public as $$
declare _total numeric;
begin
  select coalesce(sum(share_percent),0) into _total
  from public.property_owners
  where project_id = new.project_id
    and coalesce(unit_id::text,'-') = coalesce(new.unit_id::text,'-')
    and ownership_end is null
    and id <> new.id;
  if _total + new.share_percent > 100.001 then
    raise exception 'OWNERSHIP_SHARE_EXCEEDS_100';
  end if;
  return new;
end $$;
create trigger property_owners_share before insert or update on public.property_owners
for each row execute function public.property_owners_share_guard();

-- masked id number for non-privileged users
create or replace function public.mask_id_number(_value text)
returns text language sql immutable set search_path = public as $$
  select case when _value is null or length(_value) < 4 then _value
              else repeat('*', greatest(length(_value)-4,0)) || right(_value, 4) end
$$;

-- ===== 5. building licenses =====
create table if not exists public.property_licenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  license_no text, license_type text, license_status text, request_type text,
  amanah text, municipality text, issue_date date, expiry_date date,
  holder_name text, holder_id text, ownership_doc_type text, ownership_doc_no text,
  plan_no text, parcel_no text, building_type text, building_use text, building_description text,
  land_area numeric(14,2), built_area numeric(14,2), build_ratio numeric(6,2),
  floors_count integer, units_count integer,
  design_office text, supervision_office text, contractor text,
  fees numeric(14,2), payment_no text, payment_date date,
  conditions text, notes text,
  attachment_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_licenses to authenticated;
grant all on public.property_licenses to service_role;
alter table public.property_licenses enable row level security;
create policy "lic_select" on public.property_licenses for select to authenticated using (public.can_view_property(project_id));
create policy "lic_insert" on public.property_licenses for insert to authenticated with check (public.can_edit_property(project_id));
create policy "lic_update" on public.property_licenses for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "lic_delete" on public.property_licenses for delete to authenticated using (public.is_accountant());
create trigger property_licenses_touch before update on public.property_licenses for each row execute function public.property_touch();
create trigger property_licenses_audit after insert or update on public.property_licenses for each row execute function public.property_audit();

create table if not exists public.property_license_components (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.property_licenses(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, usage text, units_count integer, floors_count integer,
  area numeric(14,2), notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_license_components to authenticated;
grant all on public.property_license_components to service_role;
alter table public.property_license_components enable row level security;
create policy "licc_select" on public.property_license_components for select to authenticated using (public.can_view_property(project_id));
create policy "licc_insert" on public.property_license_components for insert to authenticated with check (public.can_edit_property(project_id));
create policy "licc_update" on public.property_license_components for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "licc_delete" on public.property_license_components for delete to authenticated using (public.can_edit_property(project_id));

-- ===== 6. contracts =====
create table if not exists public.property_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, contract_no text, contract_type text,
  contract_date date, start_date date, end_date date,
  amount numeric(14,2), currency text not null default 'SAR',
  project_owner text, owner_name text, contractor text, engineering_office text,
  supervision_office text, insurance_company text, inspection_body text,
  status text not null default 'active', notes text,
  attachment_id uuid,
  version integer not null default 1,
  is_current boolean not null default true,
  previous_id uuid references public.property_contracts(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_contracts to authenticated;
grant all on public.property_contracts to service_role;
alter table public.property_contracts enable row level security;
create policy "ctr_select" on public.property_contracts for select to authenticated using (public.can_view_property(project_id));
create policy "ctr_insert" on public.property_contracts for insert to authenticated with check (public.can_edit_property(project_id));
create policy "ctr_update" on public.property_contracts for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "ctr_delete" on public.property_contracts for delete to authenticated using (public.is_accountant());
create trigger property_contracts_touch before update on public.property_contracts for each row execute function public.property_touch();
create trigger property_contracts_audit after insert or update on public.property_contracts for each row execute function public.property_audit();

-- ===== 7. plans =====
create table if not exists public.property_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid,
  name text not null,
  plan_type text not null default 'other',
  plan_no text, revision_no text, issue_date date, design_office text,
  review_status text not null default 'draft',
  attachment_id uuid, preview_attachment_id uuid, notes text,
  version integer not null default 1,
  is_current boolean not null default true,
  previous_id uuid references public.property_plans(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_plans to authenticated;
grant all on public.property_plans to service_role;
alter table public.property_plans enable row level security;
create policy "pln_select" on public.property_plans for select to authenticated using (public.can_view_property(project_id));
create policy "pln_insert" on public.property_plans for insert to authenticated with check (public.can_edit_property(project_id));
create policy "pln_update" on public.property_plans for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "pln_delete" on public.property_plans for delete to authenticated using (public.is_accountant());
create trigger property_plans_touch before update on public.property_plans for each row execute function public.property_touch();
create trigger property_plans_audit after insert or update on public.property_plans for each row execute function public.property_audit();

create or replace function public.property_plan_add_version(_previous_id uuid, _payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _prev public.property_plans; _new_id uuid;
begin
  select * into _prev from public.property_plans where id = _previous_id;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  if not public.can_edit_property(_prev.project_id) then raise exception 'NOT_ALLOWED'; end if;
  insert into public.property_plans(project_id, unit_id, name, plan_type, plan_no, revision_no,
    issue_date, design_office, review_status, attachment_id, preview_attachment_id, notes,
    version, is_current, previous_id, created_by)
  values (_prev.project_id, _prev.unit_id,
    coalesce(_payload->>'name', _prev.name),
    coalesce(_payload->>'plan_type', _prev.plan_type),
    coalesce(_payload->>'plan_no', _prev.plan_no),
    _payload->>'revision_no',
    nullif(_payload->>'issue_date','')::date,
    coalesce(_payload->>'design_office', _prev.design_office),
    coalesce(_payload->>'review_status','draft'),
    nullif(_payload->>'attachment_id','')::uuid,
    nullif(_payload->>'preview_attachment_id','')::uuid,
    _payload->>'notes',
    _prev.version + 1, true, _prev.id, auth.uid())
  returning id into _new_id;
  update public.property_plans set is_current = false where id = _prev.id;
  return _new_id;
end $$;

-- ===== 8. units, components, partition reports =====
create table if not exists public.property_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_no text not null, unit_code text, unit_type text, floor text, orientation text,
  total_area numeric(14,2), private_area numeric(14,2), shared_area numeric(14,2),
  land_share_area numeric(14,2), land_share_percent numeric(6,3),
  current_owner text, status text not null default 'available',
  transfer_value numeric(14,2), purchase_date date, notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, unit_no)
);
grant select, insert, update, delete on public.property_units to authenticated;
grant all on public.property_units to service_role;
alter table public.property_units enable row level security;
create policy "unit_select" on public.property_units for select to authenticated using (public.can_view_property(project_id));
create policy "unit_insert" on public.property_units for insert to authenticated with check (public.can_edit_property(project_id));
create policy "unit_update" on public.property_units for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "unit_delete" on public.property_units for delete to authenticated using (public.is_accountant());
create trigger property_units_touch before update on public.property_units for each row execute function public.property_touch();
create trigger property_units_audit after insert or update on public.property_units for each row execute function public.property_audit();

create table if not exists public.property_unit_components (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.property_units(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, quantity integer, area numeric(14,2),
  part_type text not null default 'private' check (part_type in ('private','shared','exclusive_shared')),
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_unit_components to authenticated;
grant all on public.property_unit_components to service_role;
alter table public.property_unit_components enable row level security;
create policy "uc_select" on public.property_unit_components for select to authenticated using (public.can_view_property(project_id));
create policy "uc_insert" on public.property_unit_components for insert to authenticated with check (public.can_edit_property(project_id));
create policy "uc_update" on public.property_unit_components for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "uc_delete" on public.property_unit_components for delete to authenticated using (public.can_edit_property(project_id));

create table if not exists public.property_partition_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.property_units(id) on delete set null,
  request_no text, report_no text, approved_at date,
  deed_no text, deed_area numeric(14,2), license_no text, engineering_office text,
  attachment_id uuid, notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_partition_reports to authenticated;
grant all on public.property_partition_reports to service_role;
alter table public.property_partition_reports enable row level security;
create policy "prt_select" on public.property_partition_reports for select to authenticated using (public.can_view_property(project_id));
create policy "prt_insert" on public.property_partition_reports for insert to authenticated with check (public.can_edit_property(project_id));
create policy "prt_update" on public.property_partition_reports for update to authenticated using (public.can_edit_property(project_id)) with check (public.can_edit_property(project_id));
create policy "prt_delete" on public.property_partition_reports for delete to authenticated using (public.is_accountant());
create trigger property_partition_touch before update on public.property_partition_reports for each row execute function public.property_touch();

-- ===== 9. services / meters =====
create table if not exists public.property_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.property_units(id) on delete set null,
  service_type text not null check (service_type in ('water','electricity','sewage','telecom','gas','other')),
  service_status text not null default 'not_started',
  account_no text, meter_no text, subscription_no text,
  request_no text, payment_no text,
  installed_at date, activated_at date, capacity text, notes text,
  source_request_id uuid references public.requests(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_services to authenticated;
grant all on public.property_services to service_role;
alter table public.property_services enable row level security;
create policy "svc_select" on public.property_services for select to authenticated using (public.can_view_property(project_id));
create policy "svc_insert" on public.property_services for insert to authenticated
  with check (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_services.update')));
create policy "svc_update" on public.property_services for update to authenticated
  using (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_services.update')))
  with check (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_services.update')));
create policy "svc_delete" on public.property_services for delete to authenticated using (public.is_accountant());
create trigger property_services_touch before update on public.property_services for each row execute function public.property_touch();
create trigger property_services_audit after insert or update on public.property_services for each row execute function public.property_audit();

create unique index if not exists property_services_meter_uniq
  on public.property_services (service_type, meter_no) where meter_no is not null;
create unique index if not exists property_services_account_uniq
  on public.property_services (service_type, account_no) where account_no is not null;
create unique index if not exists property_services_subscription_uniq
  on public.property_services (service_type, subscription_no) where subscription_no is not null;

-- ===== 10. service execution results (review -> approve -> apply) =====
create table if not exists public.property_service_results (
  id uuid primary key default gen_random_uuid(),
  source_request_id uuid not null references public.requests(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.property_units(id) on delete set null,
  service_type text not null check (service_type in ('water','electricity','sewage','telecom','gas','other')),
  service_status text not null default 'active',
  account_no text, meter_no text, subscription_no text,
  request_no text, payment_no text, capacity text,
  executed_at date, notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  applied_service_id uuid references public.property_services(id) on delete set null,
  applied_at timestamptz,
  decided_by uuid, decided_at timestamptz, decision_reason text,
  previous_value jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_service_results to authenticated;
grant all on public.property_service_results to service_role;
alter table public.property_service_results enable row level security;
create policy "svcres_select" on public.property_service_results for select to authenticated using (public.can_view_property(project_id));
create policy "svcres_insert" on public.property_service_results for insert to authenticated
  with check (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_services.update')));
create policy "svcres_update" on public.property_service_results for update to authenticated
  using (public.is_accountant() or (created_by = auth.uid() and status = 'pending'))
  with check (public.is_accountant() or (created_by = auth.uid() and status = 'pending'));
create policy "svcres_delete" on public.property_service_results for delete to authenticated using (public.is_accountant());
create trigger property_service_results_touch before update on public.property_service_results for each row execute function public.property_touch();
create trigger property_service_results_audit after insert or update on public.property_service_results for each row execute function public.property_audit();

-- project must match the source request's project; unit must belong to that project
create or replace function public.property_service_result_guard()
returns trigger language plpgsql set search_path = public as $$
declare _req_project uuid;
begin
  select project_id into _req_project from public.requests where id = new.source_request_id;
  if _req_project is null or _req_project <> new.project_id then
    raise exception 'RESULT_PROJECT_MISMATCH';
  end if;
  if new.unit_id is not null and not exists (
    select 1 from public.property_units u where u.id = new.unit_id and u.project_id = new.project_id
  ) then
    raise exception 'RESULT_UNIT_MISMATCH';
  end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.source_request_id <> old.source_request_id) then
    raise exception 'RESULT_SCOPE_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger property_service_result_guard_trg before insert or update on public.property_service_results
for each row execute function public.property_service_result_guard();

create or replace function public.property_service_result_decide(_id uuid, _approve boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _row public.property_service_results;
begin
  select * into _row from public.property_service_results where id = _id for update;
  if not found then raise exception 'RESULT_NOT_FOUND'; end if;
  if not (public.is_accountant() or (public.can_access_project(_row.project_id) and public.has_perm('property_services.approve')))
    then raise exception 'NOT_ALLOWED'; end if;
  if _row.status <> 'pending' then raise exception 'RESULT_ALREADY_DECIDED'; end if;
  if not _approve and coalesce(btrim(_reason),'') = '' then raise exception 'REASON_REQUIRED'; end if;
  update public.property_service_results
     set status = case when _approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), decision_reason = _reason
   where id = _id;
end $$;

create or replace function public.property_service_result_apply(_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _row public.property_service_results; _svc public.property_services; _svc_id uuid;
begin
  select * into _row from public.property_service_results where id = _id for update;
  if not found then raise exception 'RESULT_NOT_FOUND'; end if;
  if not (public.is_accountant() or (public.can_access_project(_row.project_id) and public.has_perm('property_services.approve')))
    then raise exception 'NOT_ALLOWED'; end if;
  if _row.status = 'applied' then raise exception 'RESULT_ALREADY_APPLIED'; end if;
  if _row.status <> 'approved' then raise exception 'RESULT_NOT_APPROVED'; end if;

  select * into _svc from public.property_services
   where project_id = _row.project_id
     and coalesce(unit_id::text,'-') = coalesce(_row.unit_id::text,'-')
     and service_type = _row.service_type
   limit 1;

  if found then
    update public.property_services set
      service_status = _row.service_status,
      account_no = coalesce(_row.account_no, account_no),
      meter_no = coalesce(_row.meter_no, meter_no),
      subscription_no = coalesce(_row.subscription_no, subscription_no),
      request_no = coalesce(_row.request_no, request_no),
      payment_no = coalesce(_row.payment_no, payment_no),
      capacity = coalesce(_row.capacity, capacity),
      installed_at = coalesce(_row.executed_at, installed_at),
      activated_at = coalesce(_row.executed_at, activated_at),
      notes = coalesce(_row.notes, notes),
      source_request_id = _row.source_request_id
    where id = _svc.id
    returning id into _svc_id;
    update public.property_service_results set previous_value = to_jsonb(_svc) where id = _id;
  else
    insert into public.property_services(project_id, unit_id, service_type, service_status,
      account_no, meter_no, subscription_no, request_no, payment_no, capacity,
      installed_at, activated_at, notes, source_request_id, created_by)
    values (_row.project_id, _row.unit_id, _row.service_type, _row.service_status,
      _row.account_no, _row.meter_no, _row.subscription_no, _row.request_no, _row.payment_no, _row.capacity,
      _row.executed_at, _row.executed_at, _row.notes, _row.source_request_id, auth.uid())
    returning id into _svc_id;
  end if;

  update public.property_service_results
     set status = 'applied', applied_service_id = _svc_id, applied_at = now()
   where id = _id;
  return _svc_id;
end $$;

-- ===== 11. document library =====
create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.property_units(id) on delete set null,
  doc_category text not null default 'other',
  title text,
  file_name text not null, file_size bigint, mime_type text, file_hash text,
  storage_path text not null,
  visibility text not null default 'project_shared'
    check (visibility in ('project_shared','requester_private','internal','sensitive')),
  doc_status text not null default 'active',
  version integer not null default 1,
  is_current boolean not null default true,
  previous_id uuid references public.property_documents(id) on delete set null,
  description text,
  source_request_id uuid references public.requests(id) on delete set null,
  deleted_at timestamptz, delete_reason text, deleted_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_documents to authenticated;
grant all on public.property_documents to service_role;
alter table public.property_documents enable row level security;

create policy "doc_select" on public.property_documents for select to authenticated using (
  public.can_view_property(project_id)
  and (deleted_at is null or public.is_accountant())
  and (
    visibility = 'project_shared'
    or (visibility = 'requester_private' and (created_by = auth.uid() or public.is_staff()))
    or (visibility = 'internal' and public.is_staff())
    or (visibility = 'sensitive' and (public.is_accountant() or public.has_perm('property_documents.manage')))
  )
);
create policy "doc_insert" on public.property_documents for insert to authenticated with check (
  created_by = auth.uid()
  and (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_documents.upload')))
);
-- only accountants / document managers may modify an existing document row
create policy "doc_update" on public.property_documents for update to authenticated
  using (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_documents.manage')))
  with check (public.is_accountant() or (public.can_access_project(project_id) and public.has_perm('property_documents.manage')));
create policy "doc_delete" on public.property_documents for delete to authenticated using (false);
create trigger property_documents_touch before update on public.property_documents for each row execute function public.property_touch();
create trigger property_documents_audit after insert or update on public.property_documents for each row execute function public.property_audit();

create unique index if not exists property_documents_hash_uniq
  on public.property_documents (project_id, file_hash) where file_hash is not null and deleted_at is null;

-- uploader may add a new version; the old one is kept
create or replace function public.property_document_add_version(_previous_id uuid, _payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _prev public.property_documents; _new_id uuid;
begin
  select * into _prev from public.property_documents where id = _previous_id;
  if not found then raise exception 'DOC_NOT_FOUND'; end if;
  if not (public.is_accountant() or (public.can_access_project(_prev.project_id) and public.has_perm('property_documents.upload')))
    then raise exception 'NOT_ALLOWED'; end if;
  insert into public.property_documents(project_id, unit_id, doc_category, title, file_name, file_size,
    mime_type, file_hash, storage_path, visibility, doc_status, version, is_current, previous_id,
    description, source_request_id, created_by)
  values (_prev.project_id, _prev.unit_id, _prev.doc_category,
    coalesce(_payload->>'title', _prev.title),
    _payload->>'file_name',
    nullif(_payload->>'file_size','')::bigint,
    _payload->>'mime_type',
    _payload->>'file_hash',
    _payload->>'storage_path',
    _prev.visibility, 'active', _prev.version + 1, true, _prev.id,
    _payload->>'description', _prev.source_request_id, auth.uid())
  returning id into _new_id;
  update public.property_documents set is_current = false where id = _prev.id;
  return _new_id;
end $$;

create table if not exists public.property_document_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.property_documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  action text not null check (action in ('edit','delete')),
  reason text not null,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed')),
  decided_by uuid, decided_at timestamptz, decision_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.property_document_requests to authenticated;
grant all on public.property_document_requests to service_role;
alter table public.property_document_requests enable row level security;
create policy "docreq_select" on public.property_document_requests for select to authenticated
  using (public.is_accountant() or (public.can_view_property(project_id) and created_by = auth.uid()));
create policy "docreq_insert" on public.property_document_requests for insert to authenticated
  with check (created_by = auth.uid() and public.can_view_property(project_id));
create policy "docreq_update" on public.property_document_requests for update to authenticated
  using (public.is_accountant()) with check (public.is_accountant());
create policy "docreq_delete" on public.property_document_requests for delete to authenticated using (false);
create trigger property_document_requests_touch before update on public.property_document_requests for each row execute function public.property_touch();

create or replace function public.property_document_request_decide(_id uuid, _approve boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _req public.property_document_requests; _doc public.property_documents;
begin
  select * into _req from public.property_document_requests where id = _id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if not (public.is_accountant() or public.has_perm('property_documents.manage')) then raise exception 'NOT_ALLOWED'; end if;
  if _req.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  if coalesce(btrim(_reason),'') = '' then raise exception 'REASON_REQUIRED'; end if;

  if not _approve then
    update public.property_document_requests
       set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = _reason
     where id = _id;
    return;
  end if;

  select * into _doc from public.property_documents where id = _req.document_id for update;
  if _req.action = 'delete' then
    update public.property_documents
       set deleted_at = now(), deleted_by = auth.uid(), delete_reason = _reason,
           doc_status = 'deleted', is_current = false
     where id = _doc.id;
  else
    update public.property_documents set
      title = coalesce(_req.payload->>'title', title),
      doc_category = coalesce(_req.payload->>'doc_category', doc_category),
      description = coalesce(_req.payload->>'description', description),
      visibility = coalesce(_req.payload->>'visibility', visibility)
    where id = _doc.id;
  end if;

  update public.property_document_requests
     set status = 'executed', decided_by = auth.uid(), decided_at = now(), decision_reason = _reason
   where id = _id;
end $$;

create or replace function public.property_document_restore(_document_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_accountant() then raise exception 'NOT_ALLOWED'; end if;
  update public.property_documents
     set deleted_at = null, deleted_by = null, delete_reason = null, doc_status = 'active', is_current = true
   where id = _document_id;
  insert into public.audit_log(actor_id, entity_type, entity_id, action, reason)
  values (auth.uid(), 'property_documents', _document_id, 'restore', _reason);
end $$;

-- ===== 12. completion score =====
create or replace function public.property_completion(_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  _sections jsonb := '[]'::jsonb; _done int := 0; _total int := 10; _ok boolean; _p public.projects;
begin
  if not public.can_view_property(_project_id) then raise exception 'NOT_ALLOWED'; end if;
  select * into _p from public.projects where id = _project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;

  _ok := coalesce(btrim(_p.name_ar),'') <> '' and coalesce(btrim(_p.code),'') <> '' and _p.supervisor_id is not null;
  _sections := _sections || jsonb_build_object('key','basic','done',_ok); _done := _done + _ok::int;

  select exists (select 1 from public.property_land l where l.project_id = _project_id
    and coalesce(btrim(l.city),'') <> '' and coalesce(btrim(l.district),'') <> '' and l.land_area is not null) into _ok;
  _sections := _sections || jsonb_build_object('key','land','done',_ok); _done := _done + _ok::int;

  select exists (select 1 from public.property_deeds d where d.project_id = _project_id
    and d.is_current and coalesce(btrim(d.deed_no),'') <> '') into _ok;
  _sections := _sections || jsonb_build_object('key','deed','done',_ok); _done := _done + _ok::int;

  select coalesce(sum(share_percent),0) >= 99.999 from public.property_owners
   where project_id = _project_id and unit_id is null and ownership_end is null into _ok;
  _sections := _sections || jsonb_build_object('key','owners','done',coalesce(_ok,false)); _done := _done + coalesce(_ok,false)::int;

  select exists (select 1 from public.property_licenses l where l.project_id = _project_id
    and coalesce(btrim(l.license_no),'') <> '') into _ok;
  _sections := _sections || jsonb_build_object('key','license','done',_ok); _done := _done + _ok::int;

  select exists (select 1 from public.property_contracts c where c.project_id = _project_id and c.is_current) into _ok;
  _sections := _sections || jsonb_build_object('key','contracts','done',_ok); _done := _done + _ok::int;

  select exists (select 1 from public.property_plans p where p.project_id = _project_id and p.is_current) into _ok;
  _sections := _sections || jsonb_build_object('key','plans','done',_ok); _done := _done + _ok::int;

  select exists (select 1 from public.property_units u where u.project_id = _project_id) into _ok;
  _sections := _sections || jsonb_build_object('key','units','done',_ok); _done := _done + _ok::int;

  select count(*) filter (where service_type in ('water','electricity','sewage') and service_status = 'active') = 3
    from public.property_services where project_id = _project_id and unit_id is null into _ok;
  _sections := _sections || jsonb_build_object('key','services','done',coalesce(_ok,false)); _done := _done + coalesce(_ok,false)::int;

  select exists (select 1 from public.property_documents d where d.project_id = _project_id and d.deleted_at is null) into _ok;
  _sections := _sections || jsonb_build_object('key','documents','done',_ok); _done := _done + _ok::int;

  return jsonb_build_object(
    'percent', round((_done::numeric / _total) * 100),
    'done', _done, 'total', _total, 'sections', _sections);
end $$;

-- compact card summary
create or replace function public.property_summary(_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _res jsonb;
begin
  if not public.can_view_property(_project_id) then raise exception 'NOT_ALLOWED'; end if;
  select jsonb_build_object(
    'property_no', (select property_no from public.property_land where project_id = _project_id),
    'district', (select district from public.property_land where project_id = _project_id),
    'plan_no', (select plan_no from public.property_land where project_id = _project_id),
    'parcel_no', (select parcel_no from public.property_land where project_id = _project_id),
    'land_area', (select land_area from public.property_land where project_id = _project_id),
    'deed_no', (select deed_no from public.property_deeds where project_id = _project_id and is_current limit 1),
    'license_no', (select license_no from public.property_licenses where project_id = _project_id order by created_at desc limit 1),
    'units_count', (select count(*) from public.property_units where project_id = _project_id),
    'supervisors_count', (select count(*) from public.project_supervisors where project_id = _project_id and is_active),
    'documents_count', (select count(*) from public.property_documents where project_id = _project_id and deleted_at is null),
    'open_requests', (select count(*) from public.requests where project_id = _project_id and deleted_at is null and status not in ('completed','cancelled','rejected')),
    'water', (select service_status from public.property_services where project_id = _project_id and unit_id is null and service_type = 'water' limit 1),
    'electricity', (select service_status from public.property_services where project_id = _project_id and unit_id is null and service_type = 'electricity' limit 1),
    'sewage', (select service_status from public.property_services where project_id = _project_id and unit_id is null and service_type = 'sewage' limit 1),
    'completion', public.property_completion(_project_id)
  ) into _res;
  return _res;
end $$;