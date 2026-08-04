CREATE OR REPLACE FUNCTION public.mkt_conversations_list()
RETURNS TABLE(
  id uuid,
  listing_id uuid,
  listing_title text,
  listing_slug text,
  listing_cover text,
  peer_name text,
  last_message_at timestamptz,
  last_kind text,
  last_body text,
  last_mine boolean,
  unread_count integer,
  muted boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH mine AS (
    SELECT c.*
      FROM public.mkt_conversations c
     WHERE public.mkt_can_view_conversation(c.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.mkt_conversation_state s
          WHERE s.conversation_id = c.id AND s.user_id = auth.uid()
            AND s.hidden_at IS NOT NULL)
  )
  SELECT c.id,
         l.id,
         l.title,
         l.slug,
         l.cover_image_url,
         coalesce(
           CASE
             WHEN c.seller_tenant_id IS NOT NULL AND c.buyer_user_id = auth.uid()
               THEN (SELECT b.display_name_ar FROM public.mkt_business_profiles b
                      WHERE b.tenant_id = c.seller_tenant_id)
             ELSE (SELECT p.display_name FROM public.mkt_user_profiles p
                    WHERE p.user_id = CASE WHEN c.buyer_user_id = auth.uid()
                                           THEN c.seller_user_id ELSE c.buyer_user_id END)
           END, 'مستخدم') AS peer_name,
         c.last_message_at,
         lm.kind,
         CASE WHEN lm.deleted_at IS NOT NULL THEN '' ELSE lm.body END,
         lm.sender_user_id = auth.uid(),
         (SELECT count(*)::int FROM public.mkt_messages m
           WHERE m.conversation_id = c.id
             AND m.sender_user_id <> auth.uid()
             AND m.deleted_at IS NULL
             AND m.created_at > coalesce(
                   (SELECT s.last_read_at FROM public.mkt_conversation_state s
                     WHERE s.conversation_id = c.id AND s.user_id = auth.uid()),
                   '-infinity'::timestamptz)),
         coalesce((SELECT s.muted FROM public.mkt_conversation_state s
                    WHERE s.conversation_id = c.id AND s.user_id = auth.uid()), false)
    FROM mine c
    LEFT JOIN public.mkt_listings l ON l.id = c.listing_id
    LEFT JOIN LATERAL (
      SELECT m.kind, m.body, m.sender_user_id, m.deleted_at
        FROM public.mkt_messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC
       LIMIT 1) lm ON true
   ORDER BY c.last_message_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.mkt_conversations_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_conversations_list() FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_conversations_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_conversation_mark_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN
    RAISE EXCEPTION 'restricted';
  END IF;
  INSERT INTO public.mkt_conversation_state (conversation_id, user_id, last_read_at)
  VALUES (_conversation_id, auth.uid(), now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = now();
END $$;

REVOKE ALL ON FUNCTION public.mkt_conversation_mark_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_conversation_mark_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mkt_conversation_mark_read(uuid) TO authenticated;