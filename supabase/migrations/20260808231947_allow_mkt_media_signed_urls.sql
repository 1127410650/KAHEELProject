-- Storage's signed-URL endpoint in the live project does not set either of the
-- operation names used by storage.allow_any_operation(). Keep authorization on
-- the exact published/registered object instead of filtering by operation.

DROP POLICY IF EXISTS mkt_media_public_read ON storage.objects;
CREATE POLICY mkt_media_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'mkt-media'
    AND app_private.mkt_public_media_can_read(name)
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
  );
