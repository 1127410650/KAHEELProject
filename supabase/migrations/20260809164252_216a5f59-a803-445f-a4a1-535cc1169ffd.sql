ALTER TABLE public.mkt_ad_campaigns
  DROP CONSTRAINT IF EXISTS mkt_ad_campaigns_popup_mascot_check,
  ADD CONSTRAINT mkt_ad_campaigns_popup_mascot_check
    CHECK (popup_mascot IN ('auto','moto','lounge','wave','peek','parcel','boss','duo'));