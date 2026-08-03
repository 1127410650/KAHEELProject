-- ============================================================
-- Ad photos: full data model, safe ownership RPCs, orphan cleanup
-- ============================================================

ALTER TABLE public.mkt_listing_images
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS thumbnail_key text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS byte_size bigint,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.mkt_listing_images SET storage_key = url WHERE storage_key IS NULL;

ALTER TABLE public.mkt_listing_images
  DROP CONSTRAINT IF EXISTS mkt_listing_images_upload_status_chk;
ALTER TABLE public.mkt_listing_images
  ADD CONSTRAINT mkt_listing_images_upload_status_chk
  CHECK (upload_status IN ('pending', 'ready', 'failed'));

-- `url` stays the canonical key for existing readers; keep both in sync.
CREATE OR REPLACE FUNCTION public.mkt_listing_image_sync_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.storage_key IS NULL THEN NEW.storage_key := NEW.url; END IF;
  IF NEW.url IS NULL THEN NEW.url := NEW.storage_key; END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF TG_OP = 'UPDATE' THEN
    -- The owner may reorder and re-cover, never re-parent or re-attribute.
    IF NEW.listing_id <> OLD.listing_id THEN RAISE EXCEPTION 'listing_id_immutable'; END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by AND OLD.created_by IS NOT NULL
       AND NOT public.mkt_is_platform_admin() THEN
      RAISE EXCEPTION 'created_by_immutable';
    END IF;
    IF NEW.file_hash IS DISTINCT FROM OLD.file_hash AND OLD.file_hash IS NOT NULL
       AND NOT public.mkt_is_platform_admin() THEN
      RAISE EXCEPTION 'file_hash_immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mkt_listing_image_sync_keys ON public.mkt_listing_images;
CREATE TRIGGER mkt_listing_image_sync_keys
  BEFORE INSERT OR UPDATE ON public.mkt_listing_images
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_image_sync_keys();

-- one cover, no duplicate photo, per live ad
CREATE UNIQUE INDEX IF NOT EXISTS mkt_listing_images_one_cover
  ON public.mkt_listing_images(listing_id) WHERE is_cover AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mkt_listing_images_hash_uniq
  ON public.mkt_listing_images(listing_id, file_hash)
  WHERE file_hash IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mkt_listing_images_live_idx
  ON public.mkt_listing_images(listing_id, sort_order) WHERE deleted_at IS NULL;

-- ---------- orphan storage cleanup queue ----------
CREATE TABLE IF NOT EXISTS public.mkt_storage_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL DEFAULT 'marketplace',
  object_key text NOT NULL,
  reason text NOT NULL,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
GRANT SELECT ON public.mkt_storage_cleanup TO authenticated;
GRANT ALL ON public.mkt_storage_cleanup TO service_role;
ALTER TABLE public.mkt_storage_cleanup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cleanup admin read" ON public.mkt_storage_cleanup;
CREATE POLICY "cleanup admin read" ON public.mkt_storage_cleanup
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

CREATE INDEX IF NOT EXISTS mkt_storage_cleanup_pending
  ON public.mkt_storage_cleanup(enqueued_at) WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION public.mkt_enqueue_storage_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Never queue a key that a live row still points at.
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mkt_listing_images i
      WHERE i.storage_key = OLD.storage_key AND i.deleted_at IS NULL AND i.id <> OLD.id
    ) THEN
      INSERT INTO public.mkt_storage_cleanup(object_key, reason) VALUES (OLD.storage_key, 'row_deleted');
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO public.mkt_storage_cleanup(object_key, reason) VALUES (NEW.storage_key, 'soft_deleted');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mkt_listing_image_cleanup ON public.mkt_listing_images;
CREATE TRIGGER mkt_listing_image_cleanup
  AFTER UPDATE OR DELETE ON public.mkt_listing_images
  FOR EACH ROW EXECUTE FUNCTION public.mkt_enqueue_storage_cleanup();

-- ---------- atomic, ownership-checked photo operations ----------
CREATE OR REPLACE FUNCTION public.mkt_listing_images_reorder(_listing uuid, _ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_can_manage_listing(_listing) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_ids) AS x(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mkt_listing_images i
      WHERE i.id = x.id AND i.listing_id = _listing AND i.deleted_at IS NULL)
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_listing::text, 0));
  UPDATE public.mkt_listing_images i
     SET sort_order = s.pos - 1
    FROM (SELECT id, row_number() OVER () AS pos FROM unnest(_ids) AS id) s
   WHERE i.id = s.id AND i.listing_id = _listing;
  PERFORM public.mkt_log_listing_event(_listing, 'images_reordered',
          jsonb_build_object('count', coalesce(array_length(_ids, 1), 0)));
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_image_set_cover(_listing uuid, _image uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.mkt_can_manage_listing(_listing) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_listing_images
                  WHERE id = _image AND listing_id = _listing AND deleted_at IS NULL
                    AND upload_status = 'ready')
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_listing::text, 0));
  UPDATE public.mkt_listing_images SET is_cover = false
   WHERE listing_id = _listing AND is_cover AND id <> _image;
  UPDATE public.mkt_listing_images SET is_cover = true WHERE id = _image;
  UPDATE public.mkt_listings l
     SET cover_image_url = (SELECT storage_key FROM public.mkt_listing_images WHERE id = _image)
   WHERE l.id = _listing;
  PERFORM public.mkt_log_listing_event(_listing, 'image_cover_changed', '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.mkt_listing_image_delete(_listing uuid, _image uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _was_cover boolean; _next uuid;
BEGIN
  IF NOT public.mkt_can_manage_listing(_listing) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT is_cover INTO _was_cover FROM public.mkt_listing_images
   WHERE id = _image AND listing_id = _listing AND deleted_at IS NULL;
  IF _was_cover IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_listing::text, 0));
  UPDATE public.mkt_listing_images
     SET deleted_at = now(), is_cover = false
   WHERE id = _image;

  IF _was_cover THEN
    SELECT id INTO _next FROM public.mkt_listing_images
     WHERE listing_id = _listing AND deleted_at IS NULL AND upload_status = 'ready'
     ORDER BY sort_order, created_at LIMIT 1;
    IF _next IS NOT NULL THEN
      UPDATE public.mkt_listing_images SET is_cover = true WHERE id = _next;
    END IF;
  END IF;

  UPDATE public.mkt_listings l
     SET cover_image_url = (SELECT storage_key FROM public.mkt_listing_images
                             WHERE listing_id = _listing AND is_cover AND deleted_at IS NULL LIMIT 1)
   WHERE l.id = _listing;
  PERFORM public.mkt_log_listing_event(_listing, 'image_deleted', '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.mkt_listing_images_reorder(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_image_set_cover(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_listing_image_delete(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_images_reorder(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_image_set_cover(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_listing_image_delete(uuid, uuid) TO authenticated;

-- ---------- server-side photo policy on submit ----------
CREATE OR REPLACE FUNCTION public.mkt_listing_images_required(_listing uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT NOT COALESCE(ty.is_request, false)
       AND COALESCE(root.slug, c.slug) IN ('real-estate', 'equipment', 'building-materials', 'factories')
      FROM public.mkt_listings l
      LEFT JOIN public.mkt_categories c ON c.id = l.category_id
      LEFT JOIN public.mkt_categories root ON root.id = c.parent_id
      LEFT JOIN public.mkt_listing_types ty ON ty.code = l.type_code
     WHERE l.id = _listing
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.mkt_listing_submit(_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _st text; _dur smallint; _ready int; _bad int; _cover int;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status, duration_days INTO _st, _dur FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st NOT IN ('draft','rejected','expired','archived') THEN RAISE EXCEPTION 'invalid_state'; END IF;

  SELECT count(*) FILTER (WHERE upload_status = 'ready'),
         count(*) FILTER (WHERE upload_status <> 'ready'),
         count(*) FILTER (WHERE is_cover)
    INTO _ready, _bad, _cover
    FROM public.mkt_listing_images WHERE listing_id = _id AND deleted_at IS NULL;

  IF _bad > 0 THEN RAISE EXCEPTION 'IMAGES_INCOMPLETE'; END IF;
  IF _ready > 20 THEN RAISE EXCEPTION 'IMAGES_TOO_MANY'; END IF;
  IF _ready = 0 AND public.mkt_listing_images_required(_id) THEN RAISE EXCEPTION 'IMAGE_REQUIRED'; END IF;
  IF _ready > 0 AND _cover <> 1 THEN
    UPDATE public.mkt_listing_images SET is_cover = false WHERE listing_id = _id AND is_cover;
    UPDATE public.mkt_listing_images SET is_cover = true
     WHERE id = (SELECT id FROM public.mkt_listing_images
                  WHERE listing_id = _id AND deleted_at IS NULL
                  ORDER BY sort_order, created_at LIMIT 1);
  END IF;

  PERFORM public.mkt_set_listing_status(_id, 'pending', NULL);
  UPDATE public.mkt_listings
     SET rejection_reason = NULL, expiry_notice_stage = 0
   WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'submitted', jsonb_build_object('duration_days', _dur, 'images', _ready));
  RETURN 'pending';
END $$;

REVOKE ALL ON FUNCTION public.mkt_listing_images_required(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_images_required(uuid) TO authenticated;