-- Storefront visual identity.
-- Additive only: existing storefronts keep working with the general theme.

alter table public.mkt_storefronts
  add column if not exists theme_id text;

update public.mkt_storefronts
set theme_id = 'general'
where theme_id is null;

alter table public.mkt_storefronts
  alter column theme_id set default 'general',
  alter column theme_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mkt_storefronts_theme_id_check'
      and conrelid = 'public.mkt_storefronts'::regclass
  ) then
    alter table public.mkt_storefronts
      add constraint mkt_storefronts_theme_id_check
      check (theme_id in (
        'general', 'women', 'men', 'kids', 'games', 'clubs', 'restaurant',
        'cars', 'real-estate', 'electronics', 'furniture', 'contracting',
        'agriculture', 'handmade', 'factory', 'wholesale'
      ));
  end if;
end;
$$;

-- Save the visual theme only for the active account's own storefront.
-- If the storefront draft does not exist yet, reuse the guarded mkt_store_save
-- function to create the same single draft row; ownership and tenant are still
-- resolved from auth.uid() on the server.
create or replace function public.mkt_store_theme_save(
  _account_key text,
  _theme_id text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tenant uuid;
  v_id uuid;
  v_type text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if _theme_id not in (
    'general', 'women', 'men', 'kids', 'games', 'clubs', 'restaurant',
    'cars', 'real-estate', 'electronics', 'furniture', 'contracting',
    'agriculture', 'handmade', 'factory', 'wholesale'
  ) then
    raise exception 'invalid storefront theme';
  end if;

  select a.tenant_id into v_tenant
  from public.mkt_my_accounts() a
  where a.account_key = _account_key
  limit 1;

  if not found then
    raise exception 'account not allowed';
  end if;

  if v_tenant is not null and not public.mkt_can_publish_as_business(v_tenant) then
    raise exception 'not allowed to publish as this business';
  end if;

  select s.id into v_id
  from public.mkt_storefronts s
  where s.deleted_at is null
    and s.owner_user_id = auth.uid()
    and s.tenant_id is not distinct from v_tenant
  limit 1;

  if v_id is null then
    v_type := case
      when _theme_id = 'restaurant' then 'restaurant'
      when _theme_id in ('clubs', 'contracting') then 'services'
      else 'retail'
    end;

    v_id := public.mkt_store_save(
      _account_key,
      jsonb_build_object(
        'name_ar', 'متجر',
        'store_type', v_type
      ),
      1,
      'theme-bootstrap:' || _account_key
    );
  end if;

  update public.mkt_storefronts s
  set theme_id = _theme_id,
      updated_at = now()
  where s.id = v_id
    and s.owner_user_id = auth.uid()
    and s.tenant_id is not distinct from v_tenant;

  if not found then
    raise exception 'store account mismatch';
  end if;

  return v_id;
end;
$$;

-- Public-safe theme lookup. It exposes only the approved visual theme id and
-- follows the same visibility rule as the public storefront payload.
create or replace function public.mkt_store_theme_public(_slug text)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_status text;
  v_theme text;
begin
  select s.id, s.status, s.theme_id
    into v_id, v_status, v_theme
  from public.mkt_storefronts s
  where s.slug = _slug
    and s.deleted_at is null
  limit 1;

  if v_id is null then
    return null;
  end if;

  if v_status <> 'published' and not public.mkt_store_manage(v_id) then
    return null;
  end if;

  return coalesce(v_theme, 'general');
end;
$$;

revoke all on function public.mkt_store_theme_save(text, text) from public, anon;
grant execute on function public.mkt_store_theme_save(text, text) to authenticated;

revoke all on function public.mkt_store_theme_public(text) from public;
grant execute on function public.mkt_store_theme_public(text) to anon, authenticated;
