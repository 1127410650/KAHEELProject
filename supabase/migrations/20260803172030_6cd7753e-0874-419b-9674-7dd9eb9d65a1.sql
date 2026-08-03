GRANT SELECT ON public.mkt_listings TO anon, authenticated;
GRANT INSERT ON public.mkt_listings TO authenticated;
GRANT ALL ON public.mkt_listings TO service_role;

-- editable fields only: lifecycle columns stay under the approved operations
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mkt_listings'
      AND column_name NOT IN (
        'id','owner_user_id','tenant_id','advertiser_type','slug','status',
        'expires_at','published_at','views_count','shares_count',
        'contact_requests_count','deleted_at','paused_at','last_renewed_at',
        'expiry_notice_stage','created_at','latitude_public','longitude_public')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.mkt_listings TO authenticated', c.column_name);
  END LOOP;
END $$;