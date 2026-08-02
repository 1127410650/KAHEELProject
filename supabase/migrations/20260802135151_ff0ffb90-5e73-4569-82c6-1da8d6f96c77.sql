drop trigger if exists mkt_listings_force_account_country on public.mkt_listings;
drop trigger if exists mkt_business_force_account_country on public.mkt_business_profiles;

-- Name it so it fires before the city/country consistency checks.
create trigger aa_mkt_listings_force_account_country
before insert or update of country_id, city_id on public.mkt_listings
for each row execute function public.mkt_force_account_country();

create trigger aa_mkt_business_force_account_country
before insert or update of country_id, city_id on public.mkt_business_profiles
for each row execute function public.mkt_force_account_country();