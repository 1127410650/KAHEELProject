alter table public.mkt_stories drop constraint mkt_stories_image_prefix_chk;
alter table public.mkt_stories add constraint mkt_stories_image_prefix_chk
  check (image_path is null or image_path like 'public/stories/%' or image_path ~ '^asset:[a-z0-9-]{1,40}$');

update public.mkt_stories set image_path = 'asset:restaurants' where slug = 'demo-restaurants-offer';
update public.mkt_stories set image_path = 'asset:groceries' where slug = 'demo-groceries-offer';
update public.mkt_stories set mascot = 'kaheel', mascot_pose = 'present' where slug = 'demo-kaheel-welcome';
update public.mkt_stories set mascot = 'kaheelan', mascot_pose = 'mustache' where slug = 'demo-kaheelan-joke';