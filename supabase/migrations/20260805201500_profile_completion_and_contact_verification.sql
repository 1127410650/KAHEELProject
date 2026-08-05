-- Private account-completion data is isolated from the general profiles table.
-- Public marketplace views never read this table.
create table if not exists public.profile_private_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_year smallint,
  gender text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  ad_personalization_consent boolean not null default false,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_private_birth_year_check
    check (birth_year is null or birth_year between 1900 and 2100),
  constraint profile_private_gender_check
    check (gender is null or gender in ('male', 'female'))
);

alter table public.profile_private_details enable row level security;
revoke all on table public.profile_private_details from public, anon;
grant select, insert, update on table public.profile_private_details to authenticated;

drop policy if exists profile_private_select_own on public.profile_private_details;
create policy profile_private_select_own
  on public.profile_private_details for select to authenticated
  using (user_id = auth.uid());

drop policy if exists profile_private_insert_own on public.profile_private_details;
create policy profile_private_insert_own
  on public.profile_private_details for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profile_private_update_own on public.profile_private_details;
create policy profile_private_update_own
  on public.profile_private_details for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Server-only seed used after public signup. The browser cannot choose a user id.
create or replace function public.profile_seed_public_signup(
  _user_id uuid,
  _name text,
  _email text,
  _phone text
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles
     set full_name = nullif(trim(_name), ''),
         email = nullif(lower(trim(_email)), ''),
         phone = nullif(trim(_phone), '')
   where user_id = _user_id;

  insert into public.profile_private_details (user_id)
  values (_user_id)
  on conflict (user_id) do update
    set email_verified_at = null,
        phone_verified_at = null,
        profile_completed_at = null,
        updated_at = now();
end;
$$;
revoke all on function public.profile_seed_public_signup(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.profile_seed_public_signup(uuid, text, text, text) to service_role;

create or replace function public.profile_completion_get()
returns table (
  full_name text,
  email text,
  phone text,
  birth_year smallint,
  gender text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  ad_personalization_consent boolean,
  is_complete boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.full_name,
    p.email,
    p.phone,
    d.birth_year,
    d.gender,
    d.email_verified_at,
    d.phone_verified_at,
    coalesce(d.ad_personalization_consent, false),
    (
      nullif(trim(p.full_name), '') is not null
      and nullif(trim(p.email), '') is not null
      and nullif(trim(p.phone), '') is not null
      and d.birth_year is not null
      and d.gender is not null
      and d.email_verified_at is not null
      and d.phone_verified_at is not null
    ) as is_complete
  from public.profiles p
  left join public.profile_private_details d on d.user_id = p.user_id
  where p.user_id = auth.uid();
$$;
revoke all on function public.profile_completion_get() from public, anon;
grant execute on function public.profile_completion_get() to authenticated;

create or replace function public.profile_completion_save(
  _email text,
  _phone text,
  _birth_year smallint,
  _gender text,
  _ad_personalization_consent boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  current_private public.profile_private_details%rowtype;
  clean_email text := nullif(lower(trim(coalesce(_email, ''))), '');
  clean_phone text := nullif(trim(coalesce(_phone, '')), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if clean_email is null or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[[:alpha:]]{2,}$' then
    raise exception 'INVALID_EMAIL';
  end if;
  if clean_phone is null or clean_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_PHONE';
  end if;
  if _birth_year is null or _birth_year < 1900 or _birth_year > extract(year from current_date)::int then
    raise exception 'INVALID_BIRTH_YEAR';
  end if;
  if _gender not in ('male', 'female') then raise exception 'INVALID_GENDER'; end if;

  select * into current_profile from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.profile_private_details (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into current_private
    from public.profile_private_details
   where user_id = auth.uid()
   for update;

  update public.profiles
     set email = clean_email,
         phone = clean_phone
   where user_id = auth.uid();

  update public.profile_private_details
     set birth_year = _birth_year,
         gender = _gender,
         ad_personalization_consent = coalesce(_ad_personalization_consent, false),
         email_verified_at = case
           when clean_email is not distinct from current_profile.email then current_private.email_verified_at
           else null
         end,
         phone_verified_at = case
           when clean_phone is not distinct from current_profile.phone then current_private.phone_verified_at
           else null
         end,
         profile_completed_at = null,
         updated_at = now()
   where user_id = auth.uid();
end;
$$;
revoke all on function public.profile_completion_save(text, text, smallint, text, boolean) from public, anon;
grant execute on function public.profile_completion_save(text, text, smallint, text, boolean) to authenticated;

-- Synchronize verification only from Auth's confirmed values. The browser cannot
-- mark a contact as verified by itself.
create or replace function public.profile_sync_verification()
returns table (email_verified boolean, phone_verified boolean, is_complete boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_row auth.users%rowtype;
  profile_row public.profiles%rowtype;
  private_row public.profile_private_details%rowtype;
  email_ok boolean := false;
  phone_ok boolean := false;
  complete_now boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into auth_row from auth.users where id = auth.uid();
  select * into profile_row from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.profile_private_details (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into private_row
    from public.profile_private_details
   where user_id = auth.uid()
   for update;

  email_ok := profile_row.email is not null
    and lower(profile_row.email) = lower(coalesce(auth_row.email, ''))
    and auth_row.email_confirmed_at is not null;
  phone_ok := profile_row.phone is not null
    and profile_row.phone = coalesce(auth_row.phone, '')
    and auth_row.phone_confirmed_at is not null;
  complete_now := email_ok and phone_ok
    and private_row.birth_year is not null
    and private_row.gender is not null
    and nullif(trim(profile_row.full_name), '') is not null;

  update public.profile_private_details
     set email_verified_at = case when email_ok then coalesce(email_verified_at, now()) else null end,
         phone_verified_at = case when phone_ok then coalesce(phone_verified_at, now()) else null end,
         profile_completed_at = case when complete_now then coalesce(profile_completed_at, now()) else null end,
         updated_at = now()
   where user_id = auth.uid();

  return query select email_ok, phone_ok, complete_now;
end;
$$;
revoke all on function public.profile_sync_verification() from public, anon;
grant execute on function public.profile_sync_verification() to authenticated;
