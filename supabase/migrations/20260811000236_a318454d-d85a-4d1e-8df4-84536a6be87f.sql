-- 1) Fixed search_path on the soft-delete guard trigger function
CREATE OR REPLACE FUNCTION public.mkt_re_soft_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  raise exception 'hard delete is not allowed on %; use soft delete', tg_table_name;
end $function$;

-- 2) Narrow the real-estate photo bucket read policy
DROP POLICY IF EXISTS "re_photos_object_read" ON storage.objects;

CREATE POLICY "re_photos_object_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'mkt-realestate-photos'
  AND EXISTS (
    SELECT 1
    FROM public.mkt_realestate_photos p
    JOIN public.mkt_realestate_listings l ON l.id = p.listing_id
    WHERE p.storage_path = storage.objects.name
      AND p.deleted_at IS NULL
      AND l.deleted_at IS NULL
      AND l.status = 'published'
  )
);

CREATE POLICY "re_photos_object_owner_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'mkt-realestate-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.mkt_realestate_photos p
      JOIN public.mkt_realestate_listings l ON l.id = p.listing_id
      WHERE p.storage_path = storage.objects.name
        AND (
          l.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.mkt_realestate_staff s
            WHERE s.provider_id = l.provider_id
              AND s.user_id = auth.uid()
          )
        )
    )
  )
);