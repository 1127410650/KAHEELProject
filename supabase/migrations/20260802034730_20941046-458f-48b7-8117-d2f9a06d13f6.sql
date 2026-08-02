GRANT EXECUTE ON FUNCTION public.mkt_report_staff_can_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_report_is_reporter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_report_is_advertiser(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_report_conflict(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_staff_has(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_is_super_admin() TO authenticated;

DROP POLICY IF EXISTS mkt_report_files_staff_read ON storage.objects;
CREATE POLICY mkt_report_files_staff_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'mkt-media'
  AND (storage.foldername(name))[1] = 'reports'
  AND EXISTS (
    SELECT 1 FROM public.mkt_report_files f
    WHERE f.storage_path = storage.objects.name
      AND public.mkt_report_staff_can_view(f.report_id)
  )
);