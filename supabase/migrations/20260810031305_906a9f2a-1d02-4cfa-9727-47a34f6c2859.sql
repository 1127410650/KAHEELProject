ALTER TABLE public.mkt_demo_accounts ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.mkt_countries(id) ON DELETE SET NULL;

UPDATE public.mkt_demo_accounts d
SET country_id = c.country_id
FROM public.mkt_cities c
WHERE c.id = d.city_id AND d.country_id IS NULL;

CREATE OR REPLACE FUNCTION public.mkt_account_country_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.country_id from public.mkt_user_profiles p where p.user_id = _user_id and p.country_id is not null),
    (select d.country_id from public.mkt_demo_accounts d where d.id = _user_id and d.country_id is not null),
    (select c.id from public.mkt_countries c where c.iso2 = 'SA')
  )
$function$;