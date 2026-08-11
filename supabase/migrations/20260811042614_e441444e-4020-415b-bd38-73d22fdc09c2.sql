-- Data API grants were missing on the content-studio tables: RLS policies existed
-- but PostgREST had no privileges, so every read/write failed with a permission
-- error. Grants are tuned to the policies already in place.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_page_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_page_locks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_page_redirects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_ad_placements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cms_campaign_placements TO authenticated;

-- anon gets SELECT only where a public read policy exists (published pages,
-- their published version, active placements, redirects). No anon grant on locks.
GRANT SELECT ON public.mkt_cms_pages TO anon;
GRANT SELECT ON public.mkt_cms_page_versions TO anon;
GRANT SELECT ON public.mkt_cms_page_redirects TO anon;
GRANT SELECT ON public.mkt_cms_ad_placements TO anon;
GRANT SELECT ON public.mkt_cms_campaign_placements TO anon;

GRANT ALL ON public.mkt_cms_pages TO service_role;
GRANT ALL ON public.mkt_cms_page_versions TO service_role;
GRANT ALL ON public.mkt_cms_page_locks TO service_role;
GRANT ALL ON public.mkt_cms_page_redirects TO service_role;
GRANT ALL ON public.mkt_cms_ad_placements TO service_role;
GRANT ALL ON public.mkt_cms_campaign_placements TO service_role;