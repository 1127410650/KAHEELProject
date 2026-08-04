alter table public.mkt_messages
  add column if not exists kind text not null default 'text',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists reply_to_id uuid references public.mkt_messages(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists moderation_state text not null default 'clean';

alter table public.mkt_messages alter column body set default '';

alter table public.mkt_messages drop constraint if exists mkt_messages_kind_chk;
alter table public.mkt_messages add constraint mkt_messages_kind_chk
  check (kind in ('text','image','video','audio','file','location','contact','bank_request','bank_share','system'));

create index if not exists mkt_messages_conv_created_idx
  on public.mkt_messages (conversation_id, created_at);

create table if not exists public.mkt_message_hides (
  message_id uuid not null references public.mkt_messages(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
grant select, insert, delete on public.mkt_message_hides to authenticated;
grant all on public.mkt_message_hides to service_role;
alter table public.mkt_message_hides enable row level security;
drop policy if exists mkt_message_hides_own on public.mkt_message_hides;
create policy mkt_message_hides_own on public.mkt_message_hides
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.mkt_conversation_state (
  conversation_id uuid not null references public.mkt_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  muted boolean not null default false,
  hidden_at timestamptz,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
grant select, insert, update, delete on public.mkt_conversation_state to authenticated;
grant all on public.mkt_conversation_state to service_role;
alter table public.mkt_conversation_state enable row level security;
drop policy if exists mkt_conversation_state_own on public.mkt_conversation_state;
create policy mkt_conversation_state_own on public.mkt_conversation_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.mkt_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  bank_name text not null,
  beneficiary_name text not null,
  iban text not null,
  status text not null default 'pending' check (status in ('pending','verified','suspended')),
  verified_at timestamptz,
  verified_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mkt_bank_accounts_unique_idx
  on public.mkt_bank_accounts (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(replace(iban,' ','')))
  where deleted_at is null;

grant select, insert, update on public.mkt_bank_accounts to authenticated;
grant all on public.mkt_bank_accounts to service_role;
alter table public.mkt_bank_accounts enable row level security;

drop policy if exists mkt_bank_accounts_read on public.mkt_bank_accounts;
create policy mkt_bank_accounts_read on public.mkt_bank_accounts
  for select to authenticated
  using (
    (tenant_id is null and owner_user_id = auth.uid())
    or (tenant_id is not null and public.is_tenant_member(tenant_id))
  );

drop policy if exists mkt_bank_accounts_insert on public.mkt_bank_accounts;
create policy mkt_bank_accounts_insert on public.mkt_bank_accounts
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (tenant_id is null or public.mkt_can_manage_business(tenant_id))
  );

drop policy if exists mkt_bank_accounts_update on public.mkt_bank_accounts;
create policy mkt_bank_accounts_update on public.mkt_bank_accounts
  for update to authenticated
  using (
    (tenant_id is null and owner_user_id = auth.uid())
    or (tenant_id is not null and public.mkt_can_manage_business(tenant_id))
  )
  with check (
    (tenant_id is null and owner_user_id = auth.uid())
    or (tenant_id is not null and public.mkt_can_manage_business(tenant_id))
  );

create table if not exists public.mkt_chat_audit (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  actor_user_id uuid,
  conversation_id uuid,
  message_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.mkt_chat_audit to authenticated;
grant all on public.mkt_chat_audit to service_role;
alter table public.mkt_chat_audit enable row level security;
drop policy if exists mkt_chat_audit_admin on public.mkt_chat_audit;
create policy mkt_chat_audit_admin on public.mkt_chat_audit
  for select to authenticated using (public.mkt_admin_can('reports.view'));