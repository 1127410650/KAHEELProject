ALTER TABLE public.mkt_ad_campaigns
  ADD COLUMN IF NOT EXISTS popup_side TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS popup_mascot TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.mkt_ad_campaigns
  DROP CONSTRAINT IF EXISTS mkt_ad_campaigns_popup_side_check,
  ADD CONSTRAINT mkt_ad_campaigns_popup_side_check
    CHECK (popup_side IN ('auto','bottom','top','left','right'));

ALTER TABLE public.mkt_ad_campaigns
  DROP CONSTRAINT IF EXISTS mkt_ad_campaigns_popup_mascot_check,
  ADD CONSTRAINT mkt_ad_campaigns_popup_mascot_check
    CHECK (popup_mascot IN ('auto','moto','lounge','wave','peek'));