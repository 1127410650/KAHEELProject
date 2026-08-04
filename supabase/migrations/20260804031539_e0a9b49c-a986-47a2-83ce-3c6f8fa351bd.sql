ALTER TABLE public.mkt_listings DISABLE TRIGGER USER;

UPDATE public.mkt_listings
   SET duration_days = 7,
       expires_at = CASE
         WHEN expires_at IS NULL THEN NULL
         ELSE COALESCE(published_at, created_at) + interval '7 days'
       END
 WHERE duration_days IS DISTINCT FROM 7;

ALTER TABLE public.mkt_listings ENABLE TRIGGER USER;