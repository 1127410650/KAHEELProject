-- ============ helpers ============
create or replace function public.mkt_re_soft_delete_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'hard delete is not allowed on %; use soft delete', tg_table_name;
end $$;

-- ============ 1. providers ============
create table public.mkt_realestate_providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  tenant_id uuid,
  provider_type text not null default 'individual' check (provider_type in ('agency','hotel','individual')),
  provider_type_locked boolean not null default false,
  management_mode text not null default 'single_unit' check (management_mode in ('single_unit','multi_unit')),
  display_name text,
  phone text,
  whatsapp text,
  city text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified')),
  verified_at timestamptz,
  response_deadline_minutes integer not null default 60 check (response_deadline_minutes between 15 and 360),
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);
grant select, insert, update on public.mkt_realestate_providers to authenticated;
grant select on public.mkt_realestate_providers to anon;
grant all on public.mkt_realestate_providers to service_role;
alter table public.mkt_realestate_providers enable row level security;

-- ============ 7. staff (needed by helpers) ============
create table public.mkt_realestate_staff (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.mkt_realestate_providers(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'employee' check (role = 'employee'),
  full_name text,
  phone text,
  status text not null default 'active' check (status in ('active','suspended')),
  can_view_finance boolean not null default false check (can_view_finance = false),
  invited_by uuid,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, user_id)
);
grant select, insert, update on public.mkt_realestate_staff to authenticated;
grant all on public.mkt_realestate_staff to service_role;
alter table public.mkt_realestate_staff enable row level security;

create or replace function public.mkt_re_is_owner(_provider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mkt_realestate_providers p
    where p.id = _provider_id and p.owner_user_id = auth.uid() and p.deleted_at is null)
$$;

create or replace function public.mkt_re_is_member(_provider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mkt_re_is_owner(_provider_id)
     or exists (select 1 from public.mkt_realestate_staff s
       where s.provider_id = _provider_id and s.user_id = auth.uid()
         and s.status = 'active' and s.deleted_at is null)
$$;

create or replace function public.mkt_re_listing_member(_listing_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (select 1 from public.mkt_realestate_listings l
    where l.id = _listing_id and public.mkt_re_is_member(l.provider_id)) into ok;
  return ok;
end $$;

create or replace function public.mkt_re_listing_published(_listing_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (select 1 from public.mkt_realestate_listings l
    where l.id = _listing_id and l.status = 'published' and l.deleted_at is null) into ok;
  return ok;
end $$;

create policy "re_providers_public_read" on public.mkt_realestate_providers
  for select to anon, authenticated using (deleted_at is null);
create policy "re_providers_owner_insert" on public.mkt_realestate_providers
  for insert to authenticated with check (owner_user_id = auth.uid());
create policy "re_providers_owner_update" on public.mkt_realestate_providers
  for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "re_providers_admin_all" on public.mkt_realestate_providers
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

create policy "re_staff_member_read" on public.mkt_realestate_staff
  for select to authenticated using (
    user_id = auth.uid() or public.mkt_re_is_member(provider_id) or public.mkt_is_platform_admin());
create policy "re_staff_owner_write" on public.mkt_realestate_staff
  for insert to authenticated with check (
    public.mkt_re_is_owner(provider_id)
    and exists (select 1 from public.mkt_realestate_providers p
      where p.id = provider_id and p.provider_type in ('agency','hotel')));
create policy "re_staff_owner_update" on public.mkt_realestate_staff
  for update to authenticated using (public.mkt_re_is_owner(provider_id))
  with check (public.mkt_re_is_owner(provider_id));
create policy "re_staff_admin_all" on public.mkt_realestate_staff
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

-- ============ 3. exchange rates ============
create table public.mkt_realestate_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'USD' check (base_currency = 'USD'),
  quote_currency text not null check (quote_currency in ('SYP')),
  rate numeric(18,4) not null check (rate > 0),
  is_active boolean not null default true,
  note text,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.mkt_realestate_exchange_rates to anon, authenticated;
grant all on public.mkt_realestate_exchange_rates to service_role;
alter table public.mkt_realestate_exchange_rates enable row level security;
create policy "re_rates_public_read" on public.mkt_realestate_exchange_rates
  for select to anon, authenticated using (deleted_at is null);
create policy "re_rates_admin_all" on public.mkt_realestate_exchange_rates
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());
create unique index mkt_re_rates_active_uniq on public.mkt_realestate_exchange_rates(quote_currency)
  where is_active and deleted_at is null;

-- ============ 2 + 3. listings ============
create table public.mkt_realestate_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.mkt_realestate_providers(id) on delete cascade,
  owner_user_id uuid not null,
  deal_track text not null check (deal_track in ('daily_rent','long_rent','sale')),
  property_type text not null check (property_type in ('apartment','house','villa','land','shop','warehouse','office','farm','chalet','building','hotel_room','other')),
  title text not null,
  description text,
  country_code text not null default 'SY',
  city text not null,
  district text not null,
  address_text text,
  latitude double precision,
  longitude double precision,
  area_sqm numeric(12,2),
  rooms smallint,
  bathrooms smallint,
  build_year smallint,
  is_furnished boolean not null default false,
  floor_no smallint,
  amenities text[] not null default '{}',
  price numeric(18,2) not null check (price >= 0),
  price_currency text not null check (price_currency in ('SYP','USD')),
  price_period text check (price_period in ('night','month','year','total')),
  currency_display text not null default 'both' check (currency_display in ('both','entered_only')),
  price_usd_sort numeric(18,2),
  status text not null default 'draft' check (status in ('draft','pending','published','hidden','deleted')),
  published_at timestamptz,
  views_count integer not null default 0,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.mkt_realestate_listings to authenticated;
grant select on public.mkt_realestate_listings to anon;
grant all on public.mkt_realestate_listings to service_role;
alter table public.mkt_realestate_listings enable row level security;
create index mkt_re_listings_browse on public.mkt_realestate_listings(status, deal_track, city, created_at desc);
create index mkt_re_listings_provider on public.mkt_realestate_listings(provider_id);
create index mkt_re_listings_sort_price on public.mkt_realestate_listings(price_usd_sort);

create policy "re_listings_public_read" on public.mkt_realestate_listings
  for select to anon, authenticated using (status = 'published' and deleted_at is null);
create policy "re_listings_member_read" on public.mkt_realestate_listings
  for select to authenticated using (public.mkt_re_is_member(provider_id) or public.mkt_is_platform_admin());
create policy "re_listings_member_insert" on public.mkt_realestate_listings
  for insert to authenticated with check (public.mkt_re_is_member(provider_id) and owner_user_id is not null);
create policy "re_listings_member_update" on public.mkt_realestate_listings
  for update to authenticated using (public.mkt_re_is_member(provider_id)) with check (public.mkt_re_is_member(provider_id));
create policy "re_listings_admin_all" on public.mkt_realestate_listings
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

-- derived sort price in USD (manual rate only)
create or replace function public.mkt_re_sync_sort_price()
returns trigger language plpgsql security definer set search_path = public as $$
declare r numeric;
begin
  if new.price_currency = 'USD' then
    new.price_usd_sort := new.price;
  else
    select rate into r from public.mkt_realestate_exchange_rates
      where quote_currency = new.price_currency and is_active and deleted_at is null limit 1;
    new.price_usd_sort := case when r is null or r = 0 then null else round(new.price / r, 2) end;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger mkt_re_listings_sort_price before insert or update on public.mkt_realestate_listings
  for each row execute function public.mkt_re_sync_sort_price();

-- lock provider type at first listing
create or replace function public.mkt_re_lock_provider_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.mkt_realestate_providers set provider_type_locked = true, updated_at = now()
   where id = new.provider_id and provider_type_locked = false;
  return new;
end $$;
create trigger mkt_re_listings_lock_type after insert on public.mkt_realestate_listings
  for each row execute function public.mkt_re_lock_provider_type();

-- ============ 4. room types ============
create table public.mkt_realestate_room_types (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mkt_realestate_listings(id) on delete cascade,
  name text not null,
  price numeric(18,2) not null check (price >= 0),
  price_currency text not null check (price_currency in ('SYP','USD')),
  availability text not null default 'available' check (availability in ('available','full')),
  sort_order smallint not null default 0,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.mkt_realestate_room_types to authenticated;
grant select on public.mkt_realestate_room_types to anon;
grant all on public.mkt_realestate_room_types to service_role;
alter table public.mkt_realestate_room_types enable row level security;
create policy "re_rooms_public_read" on public.mkt_realestate_room_types
  for select to anon, authenticated using (deleted_at is null and public.mkt_re_listing_published(listing_id));
create policy "re_rooms_member_read" on public.mkt_realestate_room_types
  for select to authenticated using (public.mkt_re_listing_member(listing_id) or public.mkt_is_platform_admin());
create policy "re_rooms_member_insert" on public.mkt_realestate_room_types
  for insert to authenticated with check (public.mkt_re_listing_member(listing_id));
create policy "re_rooms_member_update" on public.mkt_realestate_room_types
  for update to authenticated using (public.mkt_re_listing_member(listing_id)) with check (public.mkt_re_listing_member(listing_id));
create policy "re_rooms_admin_all" on public.mkt_realestate_room_types
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

-- ============ 5. photos ============
create table public.mkt_realestate_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mkt_realestate_listings(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 8388608),
  magic_verified boolean not null default false,
  width integer,
  height integer,
  sort_order smallint not null default 0,
  is_cover boolean not null default false,
  uploaded_by uuid,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.mkt_realestate_photos to authenticated;
grant select on public.mkt_realestate_photos to anon;
grant all on public.mkt_realestate_photos to service_role;
alter table public.mkt_realestate_photos enable row level security;
create policy "re_photos_public_read" on public.mkt_realestate_photos
  for select to anon, authenticated using (deleted_at is null and public.mkt_re_listing_published(listing_id));
create policy "re_photos_member_read" on public.mkt_realestate_photos
  for select to authenticated using (public.mkt_re_listing_member(listing_id) or public.mkt_is_platform_admin());
create policy "re_photos_member_insert" on public.mkt_realestate_photos
  for insert to authenticated with check (public.mkt_re_listing_member(listing_id) and magic_verified = true);
create policy "re_photos_member_update" on public.mkt_realestate_photos
  for update to authenticated using (public.mkt_re_listing_member(listing_id)) with check (public.mkt_re_listing_member(listing_id));
create policy "re_photos_admin_all" on public.mkt_realestate_photos
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

create or replace function public.mkt_re_photos_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  select count(*) into c from public.mkt_realestate_photos
    where listing_id = new.listing_id and deleted_at is null;
  if c >= 15 then
    raise exception 'max 15 photos per listing';
  end if;
  return new;
end $$;
create trigger mkt_re_photos_limit_trg before insert on public.mkt_realestate_photos
  for each row execute function public.mkt_re_photos_limit();

-- ============ 6. bookings ============
create table public.mkt_realestate_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mkt_realestate_listings(id) on delete cascade,
  provider_id uuid not null references public.mkt_realestate_providers(id) on delete cascade,
  room_type_id uuid references public.mkt_realestate_room_types(id) on delete set null,
  customer_user_id uuid not null,
  customer_name text,
  customer_phone text,
  check_in date,
  check_out date,
  guests smallint,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','auto_cancelled','cancelled_by_customer')),
  decided_at timestamptz,
  decided_by uuid,
  decision_reason text,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out is null or check_in is null or check_out > check_in)
);
grant select, insert, update on public.mkt_realestate_bookings to authenticated;
grant all on public.mkt_realestate_bookings to service_role;
alter table public.mkt_realestate_bookings enable row level security;
create index mkt_re_bookings_listing on public.mkt_realestate_bookings(listing_id, status, check_in, check_out);
create index mkt_re_bookings_expiry on public.mkt_realestate_bookings(status, expires_at);
create policy "re_bookings_read" on public.mkt_realestate_bookings
  for select to authenticated using (
    customer_user_id = auth.uid() or public.mkt_re_is_member(provider_id) or public.mkt_is_platform_admin());
create policy "re_bookings_customer_insert" on public.mkt_realestate_bookings
  for insert to authenticated with check (customer_user_id = auth.uid() and status = 'pending');
create policy "re_bookings_customer_cancel" on public.mkt_realestate_bookings
  for update to authenticated using (customer_user_id = auth.uid()) with check (customer_user_id = auth.uid());
create policy "re_bookings_admin_all" on public.mkt_realestate_bookings
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

-- set expiry from provider deadline
create or replace function public.mkt_re_booking_set_expiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare m integer;
begin
  select response_deadline_minutes into m from public.mkt_realestate_providers where id = new.provider_id;
  new.expires_at := now() + make_interval(mins => coalesce(m, 60));
  return new;
end $$;
create trigger mkt_re_bookings_expiry_trg before insert on public.mkt_realestate_bookings
  for each row execute function public.mkt_re_booking_set_expiry();

-- provider decision (sensitive write, definer only)
create or replace function public.mkt_re_booking_decide(_booking_id uuid, _accept boolean, _reason text default null)
returns public.mkt_realestate_bookings
language plpgsql security definer set search_path = public as $$
declare b public.mkt_realestate_bookings; mode text;
begin
  select * into b from public.mkt_realestate_bookings where id = _booking_id and deleted_at is null;
  if b.id is null then raise exception 'booking not found'; end if;
  if not (public.mkt_re_is_member(b.provider_id) or public.mkt_is_platform_admin()) then
    raise exception 'not allowed';
  end if;
  if b.status <> 'pending' then raise exception 'booking already decided'; end if;
  if b.expires_at <= now() then
    update public.mkt_realestate_bookings set status = 'auto_cancelled', updated_at = now()
      where id = b.id returning * into b;
    return b;
  end if;
  update public.mkt_realestate_bookings
     set status = case when _accept then 'accepted' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid(), decision_reason = _reason, updated_at = now()
   where id = b.id returning * into b;

  select management_mode into mode from public.mkt_realestate_providers where id = b.provider_id;
  if _accept and mode = 'single_unit' and b.check_in is not null and b.check_out is not null then
    update public.mkt_realestate_bookings
       set status = 'rejected', decided_at = now(), decision_reason = 'auto: dates taken', updated_at = now()
     where listing_id = b.listing_id and id <> b.id and status = 'pending' and deleted_at is null
       and check_in is not null and check_out is not null
       and check_in < b.check_out and check_out > b.check_in;
  end if;
  return b;
end $$;
revoke all on function public.mkt_re_booking_decide(uuid, boolean, text) from public;
grant execute on function public.mkt_re_booking_decide(uuid, boolean, text) to authenticated, service_role;

create or replace function public.mkt_re_expire_bookings()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.mkt_realestate_bookings set status = 'auto_cancelled', updated_at = now()
   where status = 'pending' and expires_at <= now() and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mkt_re_expire_bookings() from public;
grant execute on function public.mkt_re_expire_bookings() to authenticated, service_role;

-- ============ 8. verification ============
create table public.mkt_realestate_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.mkt_realestate_providers(id) on delete cascade,
  owner_user_id uuid not null,
  requested_type text not null check (requested_type in ('agency','hotel','individual')),
  legal_name text,
  license_no text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.mkt_realestate_verifications to authenticated;
grant all on public.mkt_realestate_verifications to service_role;
alter table public.mkt_realestate_verifications enable row level security;
create policy "re_verif_owner_read" on public.mkt_realestate_verifications
  for select to authenticated using (owner_user_id = auth.uid() or public.mkt_is_platform_admin());
create policy "re_verif_owner_insert" on public.mkt_realestate_verifications
  for insert to authenticated with check (owner_user_id = auth.uid() and public.mkt_re_is_owner(provider_id) and status = 'pending');
create policy "re_verif_owner_update" on public.mkt_realestate_verifications
  for update to authenticated using (owner_user_id = auth.uid() and status = 'pending')
  with check (owner_user_id = auth.uid());
create policy "re_verif_admin_all" on public.mkt_realestate_verifications
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

create table public.mkt_realestate_verification_files (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.mkt_realestate_verifications(id) on delete cascade,
  owner_user_id uuid not null,
  storage_path text not null unique,
  doc_type text not null check (doc_type in ('commercial_register','license','id_card','ownership_deed','other')),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  magic_verified boolean not null default false,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.mkt_realestate_verification_files to authenticated;
grant all on public.mkt_realestate_verification_files to service_role;
alter table public.mkt_realestate_verification_files enable row level security;
create policy "re_verif_files_owner_read" on public.mkt_realestate_verification_files
  for select to authenticated using (owner_user_id = auth.uid() or public.mkt_is_platform_admin());
create policy "re_verif_files_owner_insert" on public.mkt_realestate_verification_files
  for insert to authenticated with check (owner_user_id = auth.uid() and magic_verified = true);
create policy "re_verif_files_owner_update" on public.mkt_realestate_verification_files
  for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "re_verif_files_admin_all" on public.mkt_realestate_verification_files
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

-- manual admin approval only; requires uploaded docs
create or replace function public.mkt_re_verification_review(_verification_id uuid, _approve boolean, _note text default null)
returns public.mkt_realestate_verifications
language plpgsql security definer set search_path = public as $$
declare v public.mkt_realestate_verifications; docs integer;
begin
  if not public.mkt_is_platform_admin() then raise exception 'not allowed'; end if;
  select * into v from public.mkt_realestate_verifications where id = _verification_id and deleted_at is null;
  if v.id is null then raise exception 'request not found'; end if;
  if v.status <> 'pending' then raise exception 'already reviewed'; end if;
  select count(*) into docs from public.mkt_realestate_verification_files
    where verification_id = v.id and deleted_at is null;
  if _approve and docs = 0 then raise exception 'documents required before approval'; end if;
  update public.mkt_realestate_verifications
     set status = case when _approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note, updated_at = now()
   where id = v.id returning * into v;
  update public.mkt_realestate_providers
     set verification_status = case when _approve then 'verified' else 'unverified' end,
         verified_at = case when _approve then now() else null end, updated_at = now()
   where id = v.provider_id;
  return v;
end $$;
revoke all on function public.mkt_re_verification_review(uuid, boolean, text) from public;
grant execute on function public.mkt_re_verification_review(uuid, boolean, text) to authenticated, service_role;

-- ============ 9. promotions (existing wallet) ============
create table public.mkt_realestate_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mkt_realestate_listings(id) on delete cascade,
  provider_id uuid not null references public.mkt_realestate_providers(id) on delete cascade,
  wallet_id uuid not null references public.mkt_ad_credit_wallets(id) on delete restrict,
  duration_days smallint not null check (duration_days > 0),
  points_spent integer not null check (points_spent >= 0),
  status text not null default 'active' check (status in ('active','ended','refunded','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  created_by uuid,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.mkt_realestate_promotions to authenticated;
grant select on public.mkt_realestate_promotions to anon;
grant all on public.mkt_realestate_promotions to service_role;
alter table public.mkt_realestate_promotions enable row level security;
create policy "re_promos_public_read" on public.mkt_realestate_promotions
  for select to anon, authenticated using (deleted_at is null and status = 'active');
create policy "re_promos_member_read" on public.mkt_realestate_promotions
  for select to authenticated using (public.mkt_re_is_member(provider_id) or public.mkt_is_platform_admin());
create policy "re_promos_admin_all" on public.mkt_realestate_promotions
  for all to authenticated using (public.mkt_is_platform_admin()) with check (public.mkt_is_platform_admin());

create table public.mkt_realestate_promotion_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mkt_realestate_listings(id) on delete cascade,
  promotion_id uuid references public.mkt_realestate_promotions(id) on delete set null,
  event_type text not null check (event_type in ('impression','click','share','contact')),
  session_hash text,
  created_at timestamptz not null default now()
);
grant select, insert on public.mkt_realestate_promotion_events to authenticated;
grant insert on public.mkt_realestate_promotion_events to anon;
grant all on public.mkt_realestate_promotion_events to service_role;
alter table public.mkt_realestate_promotion_events enable row level security;
create index mkt_re_promo_events_listing on public.mkt_realestate_promotion_events(listing_id, event_type, created_at desc);
create policy "re_promo_events_insert" on public.mkt_realestate_promotion_events
  for insert to anon, authenticated with check (true);
create policy "re_promo_events_member_read" on public.mkt_realestate_promotion_events
  for select to authenticated using (public.mkt_re_listing_member(listing_id) or public.mkt_is_platform_admin());

-- charge one shared wallet (no separate wallet)
create or replace function public.mkt_re_promote_listing(_listing_id uuid, _days integer, _points integer)
returns public.mkt_realestate_promotions
language plpgsql security definer set search_path = public as $$
declare l public.mkt_realestate_listings; w uuid; p public.mkt_realestate_promotions;
begin
  select * into l from public.mkt_realestate_listings where id = _listing_id and deleted_at is null;
  if l.id is null then raise exception 'listing not found'; end if;
  if not public.mkt_re_is_member(l.provider_id) then raise exception 'not allowed'; end if;
  if _days is null or _days <= 0 then raise exception 'invalid duration'; end if;
  perform public.mkt_ad_credit_consume(_points, 'realestate_promotion', _listing_id, null);
  select id into w from public.mkt_ad_credit_wallets where owner_user_id = auth.uid() limit 1;
  insert into public.mkt_realestate_promotions
    (listing_id, provider_id, wallet_id, duration_days, points_spent, ends_at, created_by)
  values (l.id, l.provider_id, w, _days, _points, now() + make_interval(days => _days), auth.uid())
  returning * into p;
  return p;
end $$;
revoke all on function public.mkt_re_promote_listing(uuid, integer, integer) from public;
grant execute on function public.mkt_re_promote_listing(uuid, integer, integer) to authenticated, service_role;

-- ============ no hard delete anywhere ============
create trigger mkt_re_no_delete_providers before delete on public.mkt_realestate_providers for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_staff before delete on public.mkt_realestate_staff for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_rates before delete on public.mkt_realestate_exchange_rates for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_listings before delete on public.mkt_realestate_listings for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_rooms before delete on public.mkt_realestate_room_types for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_photos before delete on public.mkt_realestate_photos for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_bookings before delete on public.mkt_realestate_bookings for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_verif before delete on public.mkt_realestate_verifications for each statement execute function public.mkt_re_soft_delete_guard();
create trigger mkt_re_no_delete_verif_files before delete on public.mkt_realestate_verification_files for each statement execute function public.mkt_re_soft_delete_guard();

-- ============ updated_at ============
create trigger mkt_re_touch_providers before update on public.mkt_realestate_providers for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_staff before update on public.mkt_realestate_staff for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_rates before update on public.mkt_realestate_exchange_rates for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_rooms before update on public.mkt_realestate_room_types for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_photos before update on public.mkt_realestate_photos for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_bookings before update on public.mkt_realestate_bookings for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_verif before update on public.mkt_realestate_verifications for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_verif_files before update on public.mkt_realestate_verification_files for each row execute function public.mkt_touch_updated_at();
create trigger mkt_re_touch_promos before update on public.mkt_realestate_promotions for each row execute function public.mkt_touch_updated_at();

-- ============ storage policies ============
create policy "re_photos_object_member_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mkt-realestate-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "re_photos_object_member_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'mkt-realestate-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "re_photos_object_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'mkt-realestate-photos');

create policy "re_verify_object_owner_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mkt-realestate-verify' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "re_verify_object_owner_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'mkt-realestate-verify'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.mkt_is_platform_admin()));
create policy "re_verify_object_admin_all" on storage.objects
  for all to authenticated using (
    bucket_id = 'mkt-realestate-verify' and public.mkt_is_platform_admin())
  with check (bucket_id = 'mkt-realestate-verify' and public.mkt_is_platform_admin());