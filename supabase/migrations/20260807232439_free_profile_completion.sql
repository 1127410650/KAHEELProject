-- KAHEEL free profile-completion mode:
-- email verification remains the only verification requirement;
-- phone is stored as a contact number after format validation, without SMS.

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
    ) as is_complete
  from public.profiles p
  left join public.profile_private_details d on d.user_id = p.user_id
  where p.user_id = auth.uid();
$$;

revoke all on function public.profile_completion_get() from public, anon;
grant execute on function public.profile_completion_get() to authenticated;

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

  complete_now := email_ok
    and nullif(trim(profile_row.phone), '') is not null
    and private_row.birth_year is not null
    and private_row.gender is not null
    and nullif(trim(profile_row.full_name), '') is not null;

  update public.profile_private_details
     set email_verified_at = case when email_ok then coalesce(email_verified_at, now()) else null end,
         phone_verified_at = case when phone_ok then coalesce(phone_verified_at, now()) else phone_verified_at end,
         profile_completed_at = case when complete_now then coalesce(profile_completed_at, now()) else null end,
         updated_at = now()
   where user_id = auth.uid();

  return query select email_ok, phone_ok, complete_now;
end;
$$;

revoke all on function public.profile_sync_verification() from public, anon;
grant execute on function public.profile_sync_verification() to authenticated;
