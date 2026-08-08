-- Reconcile KAHEEL schema objects that duplicate newer canonical objects.
-- No rows, tables, functions, or active access paths are removed here.

drop policy if exists project_supervisors_select on public.project_supervisors;
drop policy if exists supervisors_select_allowed on public.supervisors;

drop index if exists public.mkt_messages_conversation_idx;

drop trigger if exists mkt_business_profiles_geo_match on public.mkt_business_profiles;
drop trigger if exists mkt_business_profiles_verification_guard on public.mkt_business_profiles;
drop trigger if exists mkt_listings_geo_match on public.mkt_listings;
drop trigger if exists mkt_user_profiles_geo_match on public.mkt_user_profiles;
