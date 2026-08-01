CREATE POLICY request_messages_insert_scoped
ON public.request_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_access_request(request_id)
  AND (
    public.is_staff()
    OR (visibility = 'shared' AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_messages.request_id
        AND (r.requester_id = auth.uid() OR r.created_by = auth.uid())
    ))
  )
);

CREATE POLICY request_messages_update_own
ON public.request_messages
FOR UPDATE TO authenticated
USING (author_id = auth.uid() AND public.can_access_request(request_id))
WITH CHECK (author_id = auth.uid() AND public.can_access_request(request_id));
