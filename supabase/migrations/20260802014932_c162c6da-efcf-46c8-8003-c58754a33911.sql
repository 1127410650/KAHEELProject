-- Marketplace media bucket policies (private bucket, signed URLs).
CREATE POLICY mkt_media_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'mkt-media'
    AND (storage.foldername(name))[1] IN ('listings', 'businesses')
  );

CREATE POLICY mkt_media_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'mkt-media' AND owner = auth.uid());

CREATE POLICY mkt_media_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mkt-media' AND owner = auth.uid());

CREATE POLICY mkt_media_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mkt-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'mkt-media' AND owner = auth.uid());

CREATE POLICY mkt_media_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mkt-media' AND owner = auth.uid());