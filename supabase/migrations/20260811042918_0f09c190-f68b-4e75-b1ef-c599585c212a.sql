REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON
  public.mkt_cms_pages,
  public.mkt_cms_page_versions,
  public.mkt_cms_page_locks,
  public.mkt_cms_page_redirects,
  public.mkt_cms_ad_placements,
  public.mkt_cms_campaign_placements
FROM anon;

-- editing locks are internal operational state; visitors have no read policy for them
REVOKE SELECT ON public.mkt_cms_page_locks FROM anon;