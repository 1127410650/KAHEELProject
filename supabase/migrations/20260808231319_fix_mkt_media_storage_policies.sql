-- Restore the narrowly-scoped marketplace media policies that were lost from
-- the live storage.objects policy set. The bucket remains private: public media
-- is served only through short-lived signed URLs and only when the object is
-- referenced by a currently published marketplace record.

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.mkt_public_media_can_read(_storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN _storage_path LIKE 'listings/%' THEN EXISTS (
      SELECT 1
      FROM public.mkt_listing_images image
      JOIN public.mkt_listings listing ON listing.id = image.listing_id
      WHERE (
          image.storage_key = _storage_path
          OR image.thumbnail_key = _storage_path
          OR image.url = _storage_path
        )
        AND image.deleted_at IS NULL
        AND image.upload_status = 'ready'
        AND listing.status = 'published'
        AND listing.deleted_at IS NULL
        AND (listing.expires_at IS NULL OR listing.expires_at > now())
    )
    WHEN _storage_path LIKE 'business/%'
      OR _storage_path LIKE 'businesses/%' THEN EXISTS (
      SELECT 1
      FROM public.mkt_business_profiles profile
      WHERE profile.logo_url = _storage_path
        AND profile.is_published
    )
    WHEN _storage_path LIKE 'stores/%' THEN EXISTS (
      SELECT 1
      FROM public.mkt_storefronts storefront
      WHERE public.mkt_store_visible(storefront.id)
        AND (
          storefront.logo_path = _storage_path
          OR storefront.cover_path = _storage_path
          OR EXISTS (
            SELECT 1
            FROM public.mkt_store_items item
            WHERE item.storefront_id = storefront.id
              AND item.image_path = _storage_path
              AND item.deleted_at IS NULL
              AND item.is_available
          )
        )
    )
    ELSE false
  END;
$function$;

REVOKE ALL ON FUNCTION app_private.mkt_public_media_can_read(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.mkt_public_media_can_read(text)
  TO anon, authenticated, service_role;

-- The join-application table deliberately has no browser grants. Keep the
-- table hidden and perform the staff-only registration check behind this
-- non-exposed, parameter-only predicate instead of reading the table directly
-- from a storage.objects policy.
CREATE OR REPLACE FUNCTION app_private.mkt_join_document_staff_can_read(
  _storage_path text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL
      OR NOT public.mkt_admin_can('docs.view_sensitive') THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.mkt_join_application_documents document
      WHERE document.storage_path = _storage_path
    )
  END;
$function$;

REVOKE ALL ON FUNCTION app_private.mkt_join_document_staff_can_read(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mkt_join_document_staff_can_read(text)
  TO authenticated, service_role;

DROP POLICY IF EXISTS mkt_media_public_read ON storage.objects;
CREATE POLICY mkt_media_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'mkt-media'
    AND app_private.mkt_public_media_can_read(name)
    AND storage.allow_any_operation(
      ARRAY['object.get_authenticated_info', 'object.get_authenticated']
    )
  );

DROP POLICY IF EXISTS mkt_media_owner_read ON storage.objects;
CREATE POLICY mkt_media_owner_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND coalesce(owner_id, owner::text) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS mkt_media_owner_insert ON storage.objects;
CREATE POLICY mkt_media_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'mkt-media'
    AND coalesce(owner_id, owner::text) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS mkt_media_owner_update ON storage.objects;
CREATE POLICY mkt_media_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND coalesce(owner_id, owner::text) = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'mkt-media'
    AND coalesce(owner_id, owner::text) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS mkt_media_owner_delete ON storage.objects;
CREATE POLICY mkt_media_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND coalesce(owner_id, owner::text) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS mkt_join_documents_staff_read ON storage.objects;
CREATE POLICY mkt_join_documents_staff_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND (storage.foldername(name))[1] = 'join-applications'
    AND app_private.mkt_join_document_staff_can_read(name)
    AND storage.allow_any_operation(
      ARRAY['object.get_authenticated_info', 'object.get_authenticated']
    )
  );
