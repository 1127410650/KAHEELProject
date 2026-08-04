-- ── Batch 2: storefront creation wizard (server-side) ───────────────────────
alter table public.mkt_storefronts
  add column if not exists draft_step smallint not null default 1,
  add column if not exists idempotency_key text;

create unique index if not exists mkt_storefronts_idem_key
  on public.mkt_storefronts (owner_user_id, idempotency_key)
  where idempotency_key is not null;

-- Full draft of the ACTIVE account's storefront (owner-only, RLS-independent read
-- is scoped by owner_user_id + the account key resolved server-side).
create or replace function public.mkt_store_draft(_account_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tenant uuid;
  v_id uuid;
  v_out jsonb;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select a.tenant_id into v_tenant
  from public.mkt_my_accounts() a
  where _account_key is null or a.account_key = _account_key
  limit 1;

  select s.id into v_id
  from public.mkt_storefronts s
  where s.deleted_at is null
    and s.owner_user_id = auth.uid()
    and s.tenant_id is not distinct from v_tenant
  limit 1;

  if v_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'store', to_jsonb(s) - 'qa_batch_id',
    'private', (
      select to_jsonb(p) - 'delivery_permit_doc_path'
             || jsonb_build_object('has_permit_doc', p.delivery_permit_doc_path is not null)
      from public.mkt_store_private p where p.storefront_id = s.id
    ),
    'branch', (
      select to_jsonb(b) from public.mkt_store_branches b
      where b.storefront_id = s.id and b.is_primary and b.deleted_at is null limit 1
    ),
    'hours', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.weekday)
      from public.mkt_store_hours h
      join public.mkt_store_branches b on b.id = h.branch_id
      where b.storefront_id = s.id and b.is_primary
    ), '[]'::jsonb),
    'zones', coalesce((
      select jsonb_agg(to_jsonb(z) order by z.created_at)
      from public.mkt_store_delivery_zones z
      join public.mkt_store_branches b on b.id = z.branch_id
      where b.storefront_id = s.id and b.is_primary
    ), '[]'::jsonb),
    'city_name', (select c.name_ar from public.mkt_cities c where c.id = s.city_id)
  ) into v_out
  from public.mkt_storefronts s where s.id = v_id;

  return v_out;
end;
$$;

-- Create-or-update the ACTIVE account's single storefront. The browser never
-- supplies ownership, country, slug or status: all four are derived server-side.
create or replace function public.mkt_store_save(
  _account_key text,
  _patch jsonb,
  _step smallint default null,
  _idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tenant uuid;
  v_can boolean;
  v_id uuid;
  v_country uuid;
  v_base text;
  v_slug text;
  v_n int := 0;
  v_city uuid;
  v_type text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select a.tenant_id, a.can_publish into v_tenant, v_can
  from public.mkt_my_accounts() a
  where a.account_key = _account_key
  limit 1;

  if not found then
    raise exception 'account not allowed';
  end if;
  if v_tenant is not null and not public.mkt_can_publish_as_business(v_tenant) then
    raise exception 'not allowed to publish as this business';
  end if;

  v_country := public.mkt_account_country_id(auth.uid());

  select s.id into v_id
  from public.mkt_storefronts s
  where s.deleted_at is null
    and s.owner_user_id = auth.uid()
    and s.tenant_id is not distinct from v_tenant
  limit 1;

  -- Idempotent create: a replayed request returns the same row.
  if v_id is null and _idempotency_key is not null then
    select s.id into v_id from public.mkt_storefronts s
    where s.owner_user_id = auth.uid() and s.idempotency_key = _idempotency_key
      and s.deleted_at is null;
  end if;

  v_type := coalesce(nullif(_patch->>'store_type', ''), 'retail');
  if v_type not in ('restaurant','retail','services','mixed') then
    raise exception 'invalid store type';
  end if;

  -- City must belong to the account country (never trusted from the browser).
  if _patch ? 'city_id' and nullif(_patch->>'city_id','') is not null then
    v_city := (_patch->>'city_id')::uuid;
    if not exists (
      select 1 from public.mkt_cities c
      where c.id = v_city and c.country_id = v_country and c.is_active
    ) then
      raise exception 'city does not belong to the account country';
    end if;
  end if;

  if v_id is null then
    v_base := nullif(regexp_replace(lower(coalesce(_patch->>'name_en', _patch->>'name_ar', 'store')),
                     '[^a-z0-9\u0600-\u06ff]+', '-', 'g'), '');
    v_base := trim(both '-' from coalesce(v_base, 'store'));
    if v_base = '' then v_base := 'store'; end if;
    v_slug := v_base;
    while exists (select 1 from public.mkt_storefronts s where s.slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n::text;
    end loop;

    insert into public.mkt_storefronts (
      owner_user_id, tenant_id, store_type, slug, name_ar, country_id, status,
      draft_step, idempotency_key,
      currency_code
    ) values (
      auth.uid(), v_tenant, v_type, v_slug,
      coalesce(nullif(_patch->>'name_ar',''), 'متجر'), v_country, 'draft',
      coalesce(_step, 1), _idempotency_key,
      coalesce((select c.currency_code from public.mkt_countries c where c.id = v_country), 'SAR')
    )
    returning id into v_id;
  end if;

  update public.mkt_storefronts s set
    store_type = v_type,
    cuisine_id = case when _patch ? 'cuisine_id'
                      then nullif(_patch->>'cuisine_id','')::uuid else s.cuisine_id end,
    name_ar = coalesce(nullif(_patch->>'name_ar',''), s.name_ar),
    name_en = case when _patch ? 'name_en' then nullif(_patch->>'name_en','') else s.name_en end,
    short_description_ar = case when _patch ? 'short_description_ar'
      then nullif(_patch->>'short_description_ar','') else s.short_description_ar end,
    short_description_en = case when _patch ? 'short_description_en'
      then nullif(_patch->>'short_description_en','') else s.short_description_en end,
    logo_path = case when _patch ? 'logo_path' then nullif(_patch->>'logo_path','') else s.logo_path end,
    cover_path = case when _patch ? 'cover_path' then nullif(_patch->>'cover_path','') else s.cover_path end,
    city_id = case when _patch ? 'city_id' then v_city else s.city_id end,
    district = case when _patch ? 'district' then nullif(_patch->>'district','') else s.district end,
    address_text = case when _patch ? 'address_text' then nullif(_patch->>'address_text','') else s.address_text end,
    latitude = case when _patch ? 'latitude' then nullif(_patch->>'latitude','')::double precision else s.latitude end,
    longitude = case when _patch ? 'longitude' then nullif(_patch->>'longitude','')::double precision else s.longitude end,
    location_precision = case when _patch ? 'location_precision'
      then coalesce(nullif(_patch->>'location_precision',''), 'approximate') else s.location_precision end,
    public_phone_enabled = coalesce((_patch->>'public_phone_enabled')::boolean, s.public_phone_enabled),
    chat_enabled = coalesce((_patch->>'chat_enabled')::boolean, s.chat_enabled),
    call_enabled = coalesce((_patch->>'call_enabled')::boolean, s.call_enabled),
    pickup_enabled = coalesce((_patch->>'pickup_enabled')::boolean, s.pickup_enabled),
    merchant_delivery_enabled = coalesce((_patch->>'merchant_delivery_enabled')::boolean, s.merchant_delivery_enabled),
    minimum_order_amount = greatest(0, coalesce((_patch->>'minimum_order_amount')::numeric, s.minimum_order_amount)),
    delivery_fee = greatest(0, coalesce((_patch->>'delivery_fee')::numeric, s.delivery_fee)),
    estimated_delivery_minutes_min = case when _patch ? 'estimated_delivery_minutes_min'
      then nullif(_patch->>'estimated_delivery_minutes_min','')::int else s.estimated_delivery_minutes_min end,
    estimated_delivery_minutes_max = case when _patch ? 'estimated_delivery_minutes_max'
      then nullif(_patch->>'estimated_delivery_minutes_max','')::int else s.estimated_delivery_minutes_max end,
    is_open_manually = coalesce((_patch->>'is_open_manually')::boolean, s.is_open_manually),
    accepts_orders = coalesce((_patch->>'accepts_orders')::boolean, s.accepts_orders),
    draft_step = coalesce(_step, s.draft_step),
    updated_at = now()
  where s.id = v_id;

  -- Private-only fields (phone, permit) never live on the public table.
  insert into public.mkt_store_private (storefront_id) values (v_id)
  on conflict (storefront_id) do nothing;

  update public.mkt_store_private p set
    contact_phone = case when _patch ? 'contact_phone' then nullif(_patch->>'contact_phone','') else p.contact_phone end,
    delivery_phone = case when _patch ? 'delivery_phone' then nullif(_patch->>'delivery_phone','') else p.delivery_phone end,
    delivery_permit_number = case when _patch ? 'delivery_permit_number'
      then nullif(_patch->>'delivery_permit_number','') else p.delivery_permit_number end,
    delivery_permit_expires_on = case when _patch ? 'delivery_permit_expires_on'
      then nullif(_patch->>'delivery_permit_expires_on','')::date else p.delivery_permit_expires_on end,
    delivery_permit_doc_path = case when _patch ? 'delivery_permit_doc_path'
      then nullif(_patch->>'delivery_permit_doc_path','') else p.delivery_permit_doc_path end,
    delivery_declaration_accepted_at = case
      when (_patch->>'delivery_declaration')::boolean is true then coalesce(p.delivery_declaration_accepted_at, now())
      when (_patch->>'delivery_declaration')::boolean is false then null
      else p.delivery_declaration_accepted_at end,
    updated_at = now()
  where p.storefront_id = v_id;

  -- Keep the primary branch in sync with the storefront location.
  update public.mkt_store_branches b set
    city_id = (select s.city_id from public.mkt_storefronts s where s.id = v_id),
    country_id = (select s.country_id from public.mkt_storefronts s where s.id = v_id),
    district = (select s.district from public.mkt_storefronts s where s.id = v_id),
    address_text = (select s.address_text from public.mkt_storefronts s where s.id = v_id),
    latitude = (select s.latitude from public.mkt_storefronts s where s.id = v_id),
    longitude = (select s.longitude from public.mkt_storefronts s where s.id = v_id),
    pickup_enabled = (select s.pickup_enabled from public.mkt_storefronts s where s.id = v_id),
    delivery_enabled = (select s.merchant_delivery_enabled from public.mkt_storefronts s where s.id = v_id),
    updated_at = now()
  where b.storefront_id = v_id and b.is_primary;

  return v_id;
end;
$$;

-- Working hours for the primary branch.
create or replace function public.mkt_store_hours_save(_storefront_id uuid, _rows jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_branch uuid;
  r jsonb;
begin
  if not public.mkt_store_manage(_storefront_id) then
    raise exception 'not allowed';
  end if;

  select b.id into v_branch from public.mkt_store_branches b
  where b.storefront_id = _storefront_id and b.is_primary limit 1;
  if v_branch is null then raise exception 'branch missing'; end if;

  for r in select * from jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) loop
    if (r->>'is_closed')::boolean is not true
       and nullif(r->>'opens_at','') is not null
       and nullif(r->>'closes_at','') is not null
       and (r->>'opens_at')::time = (r->>'closes_at')::time then
      raise exception 'invalid working hours';
    end if;

    insert into public.mkt_store_hours (branch_id, weekday, is_closed, opens_at, closes_at, second_opens_at, second_closes_at)
    values (
      v_branch, (r->>'weekday')::smallint,
      coalesce((r->>'is_closed')::boolean, false),
      nullif(r->>'opens_at','')::time, nullif(r->>'closes_at','')::time,
      nullif(r->>'second_opens_at','')::time, nullif(r->>'second_closes_at','')::time
    )
    on conflict (branch_id, weekday) do update set
      is_closed = excluded.is_closed,
      opens_at = excluded.opens_at,
      closes_at = excluded.closes_at,
      second_opens_at = excluded.second_opens_at,
      second_closes_at = excluded.second_closes_at,
      updated_at = now();
  end loop;
end;
$$;

-- Merchant delivery zones for the primary branch (full replace).
create or replace function public.mkt_store_zones_save(_storefront_id uuid, _rows jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_branch uuid;
  r jsonb;
begin
  if not public.mkt_store_manage(_storefront_id) then
    raise exception 'not allowed';
  end if;

  select b.id into v_branch from public.mkt_store_branches b
  where b.storefront_id = _storefront_id and b.is_primary limit 1;
  if v_branch is null then raise exception 'branch missing'; end if;

  delete from public.mkt_store_delivery_zones where branch_id = v_branch;

  for r in select * from jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) loop
    insert into public.mkt_store_delivery_zones (
      branch_id, city_id, district, radius_km, delivery_fee, minimum_order_amount,
      estimated_minutes_min, estimated_minutes_max, is_active
    ) values (
      v_branch,
      nullif(r->>'city_id','')::uuid,
      nullif(r->>'district',''),
      greatest(0, coalesce(nullif(r->>'radius_km','')::numeric, 0)),
      greatest(0, coalesce(nullif(r->>'delivery_fee','')::numeric, 0)),
      greatest(0, coalesce(nullif(r->>'minimum_order_amount','')::numeric, 0)),
      nullif(r->>'estimated_minutes_min','')::int,
      nullif(r->>'estimated_minutes_max','')::int,
      coalesce((r->>'is_active')::boolean, true)
    );
  end loop;
end;
$$;

-- Submit for review: every requirement is re-checked on the server.
create or replace function public.mkt_store_submit(_storefront_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.mkt_storefronts;
  v_decl timestamptz;
  v_missing text[] := '{}';
  v_open int;
begin
  if not public.mkt_store_manage(_storefront_id) then
    raise exception 'not allowed';
  end if;

  select * into s from public.mkt_storefronts where id = _storefront_id and deleted_at is null;
  if s.id is null then raise exception 'store not found'; end if;
  if s.status not in ('draft','pending_review') then
    raise exception 'store already submitted';
  end if;

  select p.delivery_declaration_accepted_at into v_decl
  from public.mkt_store_private p where p.storefront_id = s.id;

  if coalesce(trim(s.name_ar), '') = '' then v_missing := v_missing || 'name'; end if;
  if s.city_id is null then v_missing := v_missing || 'city'; end if;
  if s.latitude is null or s.longitude is null then v_missing := v_missing || 'location'; end if;
  if not s.pickup_enabled and not s.merchant_delivery_enabled then v_missing := v_missing || 'fulfilment'; end if;
  if s.merchant_delivery_enabled and v_decl is null then v_missing := v_missing || 'declaration'; end if;

  select count(*) into v_open
  from public.mkt_store_hours h
  join public.mkt_store_branches b on b.id = h.branch_id
  where b.storefront_id = s.id and b.is_primary and not h.is_closed;
  if coalesce(v_open, 0) = 0 then v_missing := v_missing || 'hours'; end if;

  if array_length(v_missing, 1) is not null then
    return jsonb_build_object('ok', false, 'missing', to_jsonb(v_missing));
  end if;

  update public.mkt_storefronts set status = 'pending_review', draft_step = 7, updated_at = now()
  where id = s.id;

  insert into public.mkt_store_audit (storefront_id, actor_user_id, action, details)
  values (s.id, auth.uid(), 'store.submit_review', jsonb_build_object('from', s.status));

  return jsonb_build_object('ok', true);
end;
$$;

-- Open/closed computed with the STORE country timezone (never the visitor clock).
create or replace function public.mkt_store_open_state(_storefront_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tz text := 'Asia/Riyadh';
  v_local timestamp;
  v_dow smallint;
  v_time time;
  h public.mkt_store_hours;
  v_open boolean := false;
  v_closes time;
  v_next_day smallint;
  v_next_open time;
  i int;
  v_accepts boolean;
begin
  if not public.mkt_store_visible(_storefront_id) and not public.mkt_store_manage(_storefront_id) then
    return null;
  end if;

  select s.accepts_orders and s.is_open_manually into v_accepts
  from public.mkt_storefronts s where s.id = _storefront_id;

  v_local := (now() at time zone v_tz);
  v_dow := extract(dow from v_local)::smallint;
  v_time := v_local::time;

  select h2.* into h from public.mkt_store_hours h2
  join public.mkt_store_branches b on b.id = h2.branch_id
  where b.storefront_id = _storefront_id and b.is_primary and h2.weekday = v_dow
  limit 1;

  if h.branch_id is not null and not h.is_closed then
    if h.opens_at is null and h.closes_at is null then
      v_open := true;
    elsif h.opens_at is not null and h.closes_at is not null
          and v_time >= h.opens_at and v_time < h.closes_at then
      v_open := true; v_closes := h.closes_at;
    elsif h.second_opens_at is not null and h.second_closes_at is not null
          and v_time >= h.second_opens_at and v_time < h.second_closes_at then
      v_open := true; v_closes := h.second_closes_at;
    end if;
  end if;

  if not v_open then
    for i in 0..7 loop
      v_next_day := ((v_dow + i) % 7)::smallint;
      select h2.* into h from public.mkt_store_hours h2
      join public.mkt_store_branches b on b.id = h2.branch_id
      where b.storefront_id = _storefront_id and b.is_primary and h2.weekday = v_next_day
      limit 1;
      if h.branch_id is not null and not h.is_closed and h.opens_at is not null then
        if i > 0 or h.opens_at > v_time then
          v_next_open := h.opens_at;
          exit;
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'open', v_open and coalesce(v_accepts, false),
    'accepts_orders', coalesce(v_accepts, false),
    'closes_at', v_closes,
    'next_open_weekday', case when v_open then null else v_next_day end,
    'next_open_at', case when v_open then null else v_next_open end,
    'timezone', v_tz,
    'server_time', to_char(v_local, 'HH24:MI')
  );
end;
$$;

revoke all on function public.mkt_store_draft(text) from public, anon;
revoke all on function public.mkt_store_save(text, jsonb, smallint, text) from public, anon;
revoke all on function public.mkt_store_hours_save(uuid, jsonb) from public, anon;
revoke all on function public.mkt_store_zones_save(uuid, jsonb) from public, anon;
revoke all on function public.mkt_store_submit(uuid) from public, anon;
grant execute on function public.mkt_store_draft(text) to authenticated;
grant execute on function public.mkt_store_save(text, jsonb, smallint, text) to authenticated;
grant execute on function public.mkt_store_hours_save(uuid, jsonb) to authenticated;
grant execute on function public.mkt_store_zones_save(uuid, jsonb) to authenticated;
grant execute on function public.mkt_store_submit(uuid) to authenticated;
grant execute on function public.mkt_store_open_state(uuid) to anon, authenticated;