UPDATE public.notifications n
SET read_at = now()
WHERE n.read_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = n.request_id AND r.deleted_at IS NOT NULL
  );
