ALTER TABLE public.mkt_page_blocks DROP CONSTRAINT mkt_page_blocks_type_chk;

ALTER TABLE public.mkt_page_blocks
  ADD CONSTRAINT mkt_page_blocks_type_chk CHECK (block_type IN (
    'hero_image','hero_gradient','search_field','text_strip','campaign_mosaic',
    'sponsored_banner','category_grid','listing_rail','type_cards','city_circles',
    'link_tile','design_banner','spacer','shape_layer',
    'quick_tiles','pride_strip','exclusive_offers'
  ));