alter table public.mkt_listings disable trigger user;
update public.mkt_listings set status='published', deleted_at=null, published_at=coalesce(published_at, now()) where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
alter table public.mkt_listings enable trigger user;