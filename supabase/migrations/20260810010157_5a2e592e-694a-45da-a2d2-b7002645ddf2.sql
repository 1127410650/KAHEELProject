alter table public.mkt_listings add column if not exists is_demo boolean not null default false;
alter table public.mkt_storefronts add column if not exists is_demo boolean not null default false;
alter table public.mkt_stories add column if not exists is_demo boolean not null default false;
alter table public.mkt_exclusive_offers add column if not exists is_demo boolean not null default false;
alter table public.mkt_store_items add column if not exists is_demo boolean not null default false;

create index if not exists mkt_listings_is_demo_idx on public.mkt_listings (is_demo) where is_demo;
create index if not exists mkt_storefronts_is_demo_idx on public.mkt_storefronts (is_demo) where is_demo;
create index if not exists mkt_store_items_is_demo_idx on public.mkt_store_items (is_demo) where is_demo;