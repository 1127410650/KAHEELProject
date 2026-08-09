-- 1) Delivery receipts -------------------------------------------------------
ALTER TABLE public.mkt_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS mkt_messages_conv_created_idx
  ON public.mkt_messages (conversation_id, created_at);

-- 2) Typing indicator table ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_typing (
  conversation_id uuid NOT NULL REFERENCES public.mkt_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  typing_until timestamptz NOT NULL DEFAULT now() + interval '6 seconds',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_typing TO authenticated;
GRANT ALL ON public.mkt_typing TO service_role;

ALTER TABLE public.mkt_typing ENABLE ROW LEVEL SECURITY;

-- Read: only the two sides of that exact conversation, never a third user.
DROP POLICY IF EXISTS mkt_typing_party_read ON public.mkt_typing;
CREATE POLICY mkt_typing_party_read ON public.mkt_typing
  FOR SELECT TO authenticated
  USING (public.mkt_can_view_conversation(conversation_id));

-- Write: only your own row, and only inside a conversation you belong to.
DROP POLICY IF EXISTS mkt_typing_own_write ON public.mkt_typing;
CREATE POLICY mkt_typing_own_write ON public.mkt_typing
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.mkt_can_view_conversation(conversation_id));

DROP POLICY IF EXISTS mkt_typing_own_update ON public.mkt_typing;
CREATE POLICY mkt_typing_own_update ON public.mkt_typing
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.mkt_can_view_conversation(conversation_id))
  WITH CHECK (user_id = auth.uid() AND public.mkt_can_view_conversation(conversation_id));

DROP POLICY IF EXISTS mkt_typing_own_delete ON public.mkt_typing;
CREATE POLICY mkt_typing_own_delete ON public.mkt_typing
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mkt_typing_ping(_conversation_id uuid, _seconds integer DEFAULT 6)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN
    RAISE EXCEPTION 'restricted';
  END IF;
  INSERT INTO public.mkt_typing (conversation_id, user_id, typing_until, updated_at)
  VALUES (_conversation_id, auth.uid(),
          now() + make_interval(secs => greatest(0, least(coalesce(_seconds, 6), 30))), now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET typing_until = excluded.typing_until, updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.mkt_typing_ping(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_typing_ping(uuid, integer) TO authenticated;

-- Whether the peer is typing right now; never leaks anything else.
CREATE OR REPLACE FUNCTION public.mkt_typing_peer(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_typing t
     WHERE t.conversation_id = _conversation_id
       AND t.user_id <> auth.uid()
       AND t.typing_until > now()
       AND public.mkt_can_view_conversation(_conversation_id)
  )
$$;

REVOKE ALL ON FUNCTION public.mkt_typing_peer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_typing_peer(uuid) TO authenticated;

-- 3) Receipts are set through definer functions only, per viewer -------------
CREATE OR REPLACE FUNCTION public.mkt_conversation_mark_delivered(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN
    RAISE EXCEPTION 'restricted';
  END IF;
  UPDATE public.mkt_messages m
     SET delivered_at = now()
   WHERE m.conversation_id = _conversation_id
     AND m.sender_user_id <> auth.uid()
     AND m.delivered_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.mkt_conversation_mark_delivered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_conversation_mark_delivered(uuid) TO authenticated;

-- Reading a thread also stamps the peer's messages as delivered + read.
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

  UPDATE public.mkt_messages m
     SET delivered_at = coalesce(m.delivered_at, now()),
         read_at = coalesce(m.read_at, now())
   WHERE m.conversation_id = _conversation_id
     AND m.sender_user_id <> auth.uid()
     AND m.read_at IS NULL;
END $$;

-- 4) Message list exposes the receipt timestamps ------------------------------
DROP FUNCTION IF EXISTS public.mkt_messages_list(uuid, integer);
CREATE OR REPLACE FUNCTION public.mkt_messages_list(_conversation_id uuid, _limit integer DEFAULT 200)
RETURNS TABLE(id uuid, sender_user_id uuid, kind text, body text, payload jsonb,
              reply_to_id uuid, created_at timestamptz, delivered_at timestamptz,
              read_at timestamptz, deleted_at timestamptz, mine boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.id, m.sender_user_id, m.kind,
         CASE WHEN m.deleted_at IS NOT NULL THEN '' ELSE m.body END,
         CASE WHEN m.deleted_at IS NOT NULL THEN '{}'::jsonb ELSE m.payload END,
         m.reply_to_id, m.created_at, m.delivered_at, m.read_at, m.deleted_at,
         m.sender_user_id = auth.uid()
    FROM public.mkt_messages m
   WHERE m.conversation_id = _conversation_id
     AND public.mkt_can_view_conversation(_conversation_id)
     AND NOT EXISTS (SELECT 1 FROM public.mkt_message_hides h
                      WHERE h.message_id = m.id AND h.user_id = auth.uid())
   ORDER BY m.created_at
   LIMIT greatest(1, least(_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.mkt_messages_list(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_messages_list(uuid, integer) TO authenticated;

-- 5) Tighten direct message writes to the sender only ------------------------
DROP POLICY IF EXISTS mkt_messages_update_own ON public.mkt_messages;
CREATE POLICY mkt_messages_update_own ON public.mkt_messages
  FOR UPDATE TO authenticated
  USING (sender_user_id = auth.uid() AND public.mkt_can_view_conversation(conversation_id))
  WITH CHECK (sender_user_id = auth.uid() AND public.mkt_can_view_conversation(conversation_id));

-- 6) Realtime: live messages and typing, still filtered by the same RLS ------
ALTER TABLE public.mkt_messages REPLICA IDENTITY FULL;
ALTER TABLE public.mkt_typing REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND tablename = 'mkt_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mkt_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND tablename = 'mkt_typing') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mkt_typing;
  END IF;
END $$;