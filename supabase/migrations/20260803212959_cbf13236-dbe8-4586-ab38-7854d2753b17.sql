-- verification only: soft-delete the newest test photo so the cleanup trigger fires
UPDATE public.mkt_listing_images i
   SET deleted_at = now(), is_cover = false
 WHERE i.id = (SELECT id FROM public.mkt_listing_images WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1);