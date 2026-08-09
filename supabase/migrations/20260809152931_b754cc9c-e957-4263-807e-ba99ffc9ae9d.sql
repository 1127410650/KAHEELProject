ALTER TABLE public.mkt_ad_campaigns DROP CONSTRAINT mkt_ad_campaigns_placement_chk;
ALTER TABLE public.mkt_ad_campaigns ADD CONSTRAINT mkt_ad_campaigns_placement_chk
  CHECK (placement = ANY (ARRAY['home_banner'::text, 'welcome_takeover'::text, 'home_strip'::text]));