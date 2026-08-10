alter table public.mkt_page_blocks drop constraint mkt_page_blocks_type_chk;
alter table public.mkt_page_blocks add constraint mkt_page_blocks_type_chk check (
  block_type = any (array[
    'hero_image','hero_gradient','search_field','text_strip','campaign_mosaic',
    'sponsored_banner','category_grid','listing_rail','type_cards','city_circles',
    'link_tile','design_banner','spacer','shape_layer','quick_tiles','pride_strip',
    'exclusive_offers','stories_rail','category_marquee','jeeb_li'
  ])
);

insert into public.mkt_page_blocks (page, block_type, settings, sort_order, hidden)
values
  ('market.home','stories_rail','{}'::jsonb,21,false),
  ('market.home','category_marquee','{}'::jsonb,22,false),
  ('market.home','jeeb_li','{}'::jsonb,23,false);