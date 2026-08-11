CREATE TABLE public.mkt_message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mkt_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.mkt_conversations(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL DEFAULT auth.uid(),
  reason_code text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'normal',
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision text,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_message_reports_status_chk CHECK (status IN ('open','reviewed','dismissed','actioned')),
  CONSTRAINT mkt_message_reports_severity_chk CHECK (severity IN ('low','normal','high')),
  CONSTRAINT mkt_message_reports_unique_reporter UNIQUE (message_id, reporter_user_id)
);

CREATE INDEX mkt_message_reports_status_idx ON public.mkt_message_reports (status, created_at DESC);
CREATE INDEX mkt_message_reports_conversation_idx ON public.mkt_message_reports (conversation_id);

GRANT SELECT, INSERT ON public.mkt_message_reports TO authenticated;
GRANT UPDATE ON public.mkt_message_reports TO authenticated;
GRANT ALL ON public.mkt_message_reports TO service_role;

ALTER TABLE public.mkt_message_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporter inserts own message report"
ON public.mkt_message_reports FOR INSERT TO authenticated
WITH CHECK (
  reporter_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.mkt_messages m
    JOIN public.mkt_conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id
      AND m.conversation_id = mkt_message_reports.conversation_id
      AND (c.buyer_user_id = auth.uid() OR c.seller_user_id = auth.uid())
      AND m.sender_user_id <> auth.uid()
  )
);

CREATE POLICY "reporter reads own message reports"
ON public.mkt_message_reports FOR SELECT TO authenticated
USING (reporter_user_id = auth.uid());

CREATE POLICY "admins read message reports"
ON public.mkt_message_reports FOR SELECT TO authenticated
USING (public.mkt_admin_can('reports.view'));

CREATE POLICY "admins update message reports"
ON public.mkt_message_reports FOR UPDATE TO authenticated
USING (public.mkt_admin_can('reports.manage'))
WITH CHECK (public.mkt_admin_can('reports.manage'));

CREATE TRIGGER mkt_message_reports_touch
BEFORE UPDATE ON public.mkt_message_reports
FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- freeze reporter identity and audit trail fields
CREATE OR REPLACE FUNCTION public.mkt_message_reports_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.message_id := OLD.message_id;
    NEW.conversation_id := OLD.conversation_id;
    NEW.reporter_user_id := OLD.reporter_user_id;
    NEW.created_at := OLD.created_at;
    IF NEW.status <> OLD.status THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_message_reports_guard_trg
BEFORE UPDATE ON public.mkt_message_reports
FOR EACH ROW EXECUTE FUNCTION public.mkt_message_reports_guard();

-- admin listing of reported conversations
CREATE OR REPLACE FUNCTION public.mkt_admin_message_reports(
  _status text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  status text,
  severity text,
  reason_code text,
  note text,
  created_at timestamptz,
  reviewed_at timestamptz,
  decision text,
  decision_note text,
  conversation_id uuid,
  message_id uuid,
  message_body text,
  message_created_at timestamptz,
  message_moderation_state text,
  message_deleted_at timestamptz,
  sender_user_id uuid,
  reporter_user_id uuid,
  listing_id uuid,
  reports_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT r.id, r.status, r.severity, r.reason_code, r.note, r.created_at,
         r.reviewed_at, r.decision, r.decision_note,
         r.conversation_id, r.message_id,
         m.body, m.created_at, m.moderation_state, m.deleted_at,
         m.sender_user_id, r.reporter_user_id, c.listing_id,
         (SELECT count(*) FROM public.mkt_message_reports r2 WHERE r2.conversation_id = r.conversation_id)
  FROM public.mkt_message_reports r
  JOIN public.mkt_messages m ON m.id = r.message_id
  JOIN public.mkt_conversations c ON c.id = r.conversation_id
  WHERE public.mkt_admin_can('reports.view')
    AND (_status IS NULL OR r.status = _status)
  ORDER BY (r.status = 'open') DESC, r.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 50), 200)) OFFSET greatest(0, coalesce(_offset, 0))
$$;

-- admin decision on a reported message
CREATE OR REPLACE FUNCTION public.mkt_admin_message_report_review(
  _id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_report public.mkt_message_reports;
BEGIN
  IF NOT public.mkt_admin_can('reports.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _action NOT IN ('dismiss','hide_message','keep_reviewed') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO v_report FROM public.mkt_message_reports WHERE id = _id;
  IF v_report.id IS NULL THEN
    RAISE EXCEPTION 'report_not_found';
  END IF;

  IF _action = 'hide_message' THEN
    UPDATE public.mkt_messages
       SET moderation_state = 'hidden',
           deleted_at = coalesce(deleted_at, now()),
           deleted_by = auth.uid()
     WHERE id = v_report.message_id;
  END IF;

  UPDATE public.mkt_message_reports
     SET status = CASE _action WHEN 'dismiss' THEN 'dismissed'
                              WHEN 'hide_message' THEN 'actioned'
                              ELSE 'reviewed' END,
         decision = _action,
         decision_note = _note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = _id;

  INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, message_id, meta)
  VALUES ('message_report_review', auth.uid(), v_report.conversation_id, v_report.message_id,
          jsonb_build_object('report_id', _id, 'action', _action, 'note', _note));
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_admin_message_reports(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mkt_admin_message_report_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_message_reports(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_admin_message_report_review(uuid, text, text) TO authenticated;