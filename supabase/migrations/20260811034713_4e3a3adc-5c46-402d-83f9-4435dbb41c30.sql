-- ═══ استقبال أحداث التتبع ═══════════════════════════════════════════════
-- دالة واحدة تستقبل دفعة أحداث من عميل الموقع. تعمل بـ SECURITY DEFINER لأن
-- مخطط analytics غير مكشوف عبر Data API، ولا تُعيد أي بيانات للمُرسل.
create or replace function public.mkt_analytics_ingest(
  _events jsonb,
  _is_test boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public, analytics
as $$
declare
  _item jsonb;
  _actor uuid := auth.uid();
  _internal boolean := false;
  _inserted integer := 0;
  _name text;
  _event_id uuid;
  _occurred timestamptz;
begin
  if _events is null or jsonb_typeof(_events) <> 'array' then
    return 0;
  end if;

  -- حركة الفريق تُعلَّم داخلية وتُستثنى من الأرقام الافتراضية.
  if _actor is not null then
    select exists (select 1 from public.mkt_platform_admins where user_id = _actor)
      into _internal;
  end if;

  for _item in
    select value from jsonb_array_elements(_events) with ordinality as t(value, ord)
    where ord <= 20
  loop
    _name := nullif(left(coalesce(_item->>'name', ''), 60), '');
    if _name is null or _name !~ '^[a-z][a-z0-9_.]{1,58}$' then
      continue;
    end if;

    begin
      _event_id := (_item->>'event_id')::uuid;
    exception when others then
      _event_id := gen_random_uuid();
    end;

    _occurred := coalesce((_item->>'occurred_at')::timestamptz, now());
    if _occurred > now() + interval '5 minutes' or _occurred < now() - interval '1 day' then
      _occurred := now();
    end if;

    insert into analytics.events_raw (
      event_id, occurred_at, name, surface, route_path, entity_kind, entity_id,
      actor_id, session_key, device, referrer_host, props, is_test, is_internal
    )
    values (
      _event_id,
      _occurred,
      _name,
      nullif(left(coalesce(_item->>'surface',''), 40), ''),
      nullif(left(coalesce(_item->>'route_path',''), 200), ''),
      nullif(left(coalesce(_item->>'entity_kind',''), 40), ''),
      case when (_item->>'entity_id') ~ '^[0-9a-f-]{36}$' then (_item->>'entity_id')::uuid end,
      _actor,
      nullif(left(coalesce(_item->>'session_key',''), 64), ''),
      nullif(left(coalesce(_item->>'device',''), 12), ''),
      nullif(left(coalesce(_item->>'referrer_host',''), 120), ''),
      case
        when jsonb_typeof(_item->'props') = 'object'
          and length(coalesce(_item->'props','{}'::jsonb)::text) <= 2000
        then _item->'props'
        else '{}'::jsonb
      end,
      coalesce(_is_test, false),
      _internal
    )
    on conflict (event_id) do nothing;

    _inserted := _inserted + 1;
  end loop;

  return _inserted;
end;
$$;

revoke all on function public.mkt_analytics_ingest(jsonb, boolean) from public;
grant execute on function public.mkt_analytics_ingest(jsonb, boolean) to anon, authenticated, service_role;

-- ═══ تقارير المدير ══════════════════════════════════════════════════════
create or replace function public.mkt_analytics_report(
  _days integer default 30,
  _include_internal boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, analytics
as $$
declare
  _from date := (now() at time zone 'Asia/Riyadh')::date - greatest(1, least(coalesce(_days, 30), 180));
  _out jsonb;
begin
  if not public.mkt_admin_can('analytics.view') then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'from', _from,
    'totals', (
      select jsonb_build_object(
        'events', count(*),
        'sessions', count(distinct session_key),
        'visitors', count(distinct coalesce(actor_id::text, session_key))
      )
      from analytics.events_raw
      where occurred_at >= _from
        and is_test = false
        and is_demo = false
        and (_include_internal or is_internal = false)
    ),
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.day)
      from (
        select (occurred_at at time zone 'Asia/Riyadh')::date as day,
               count(*)::bigint as events,
               count(distinct session_key)::bigint as sessions
        from analytics.events_raw
        where occurred_at >= _from
          and is_test = false and is_demo = false
          and (_include_internal or is_internal = false)
        group by 1
      ) d
    ), '[]'::jsonb),
    'top_routes', coalesce((
      select jsonb_agg(row_to_json(r) order by r.events desc)
      from (
        select route_path, count(*)::bigint as events
        from analytics.events_raw
        where occurred_at >= _from and route_path is not null
          and is_test = false and is_demo = false
          and (_include_internal or is_internal = false)
        group by 1 order by 2 desc limit 15
      ) r
    ), '[]'::jsonb),
    'top_events', coalesce((
      select jsonb_agg(row_to_json(e) order by e.events desc)
      from (
        select name, count(*)::bigint as events
        from analytics.events_raw
        where occurred_at >= _from
          and is_test = false and is_demo = false
          and (_include_internal or is_internal = false)
        group by 1 order by 2 desc limit 15
      ) e
    ), '[]'::jsonb),
    'test_events', (
      select count(*) from analytics.events_raw where is_test = true
    )
  ) into _out;

  return _out;
end;
$$;

revoke all on function public.mkt_analytics_report(integer, boolean) from public;
grant execute on function public.mkt_analytics_report(integer, boolean) to authenticated, service_role;

-- حذف بيانات وضع الاختبار عند إغلاق الاختبارات.
create or replace function public.mkt_analytics_purge_test()
returns integer
language plpgsql
security definer
set search_path = public, analytics
as $$
declare _n integer;
begin
  if not public.mkt_admin_can('analytics.view') then
    raise exception 'FORBIDDEN';
  end if;
  delete from analytics.events_raw where is_test = true;
  get diagnostics _n = row_count;
  return _n;
end;
$$;

revoke all on function public.mkt_analytics_purge_test() from public;
grant execute on function public.mkt_analytics_purge_test() to authenticated, service_role;