CREATE POLICY mkt_verification_docs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mkt-media'
    AND (storage.foldername(name))[1] = 'verification'
    AND public.mkt_can_manage_business(((storage.foldername(name))[2])::uuid)
  );