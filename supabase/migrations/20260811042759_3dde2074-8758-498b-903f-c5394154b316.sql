DELETE FROM public.mkt_cms_page_versions
WHERE page_id IN (SELECT id FROM public.mkt_cms_pages WHERE slug = 'qa-batch9-draft');

DELETE FROM public.mkt_cms_pages WHERE slug = 'qa-batch9-draft';