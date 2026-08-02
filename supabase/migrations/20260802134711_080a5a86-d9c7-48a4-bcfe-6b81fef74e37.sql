-- Country of any location-bearing row is derived from the account, never from the client.
create or replace function public.mkt_account_country_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.country_id from public.mkt_user_profiles p where p.user_id = _user_id and p.country_id is not null),
    (select c.id from public.mkt_countries c where c.iso2 = 'SA')
  )
$$;

revoke all on function public.mkt_account_country_id(uuid) from public, anon;
grant execute on function public.mkt_account_country_id(uuid) to authenticated, service_role;

create or replace function public.mkt_force_account_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _country uuid;
begin
  if tg_table_name = 'mkt_listings' then
    _owner := coalesce(new.owner_user_id, auth.uid());
  else
    _owner := auth.uid();
  end if;

  if _owner is null then
    return new;
  end if;

  _country := public.mkt_account_country_id(_owner);
  if _country is null then
    return new;
  end if;

  new.country_id := _country;

  if new.city_id is not null and not exists (
    select 1 from public.mkt_cities ci
    where ci.id = new.city_id and ci.country_id = _country
  ) then
    raise exception 'city_not_in_account_country';
  end if;

  return new;
end;
$$;

revoke all on function public.mkt_force_account_country() from public, anon;

drop trigger if exists mkt_listings_force_account_country on public.mkt_listings;
create trigger mkt_listings_force_account_country
before insert or update of country_id, city_id on public.mkt_listings
for each row execute function public.mkt_force_account_country();

drop trigger if exists mkt_business_force_account_country on public.mkt_business_profiles;
create trigger mkt_business_force_account_country
before insert or update of country_id, city_id on public.mkt_business_profiles
for each row execute function public.mkt_force_account_country();