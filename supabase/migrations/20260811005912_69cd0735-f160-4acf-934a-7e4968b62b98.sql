CREATE SEQUENCE public.mkt_support_ticket_seq;

CREATE TABLE public.mkt_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no text NOT NULL UNIQUE DEFAULT 'SUP-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.mkt_support_ticket_seq')::text, 5, '0'),
  requester_user_id uuid NOT NULL DEFAULT auth.uid(),
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'app',
  unit text NOT NULL DEFAULT 'market',
  subject_kind text,
  subject_id uuid,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'normal',
  assignee uuid,
  first_response_at timestamptz,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_support_tickets_status_chk CHECK (status IN ('new','processing','awaiting_customer','closed')),
  CONSTRAINT mkt_support_tickets_priority_chk CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT mkt_support_tickets_unit_chk CHECK (unit IN ('market','aqar','services','errands','guide','account','billing')),
  CONSTRAINT mkt_support_tickets_channel_chk CHECK (channel IN ('app','email','phone','whatsapp'))
);

CREATE INDEX mkt_support_tickets_status_idx ON public.mkt_support_tickets (status, created_at DESC);
CREATE INDEX mkt_support_tickets_requester_idx ON public.mkt_support_tickets (requester_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mkt_support_tickets TO authenticated;
GRANT ALL ON public.mkt_support_tickets TO service_role;

ALTER TABLE public.mkt_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester opens own ticket"
ON public.mkt_support_tickets FOR INSERT TO authenticated
WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "requester reads own tickets"
ON public.mkt_support_tickets FOR SELECT TO authenticated
USING (requester_user_id = auth.uid());

CREATE POLICY "support reads all tickets"
ON public.mkt_support_tickets FOR SELECT TO authenticated
USING (public.mkt_admin_can('support.view'));

CREATE POLICY "support updates tickets"
ON public.mkt_support_tickets FOR UPDATE TO authenticated
USING (public.mkt_admin_can('support.manage'))
WITH CHECK (public.mkt_admin_can('support.manage'));

CREATE OR REPLACE FUNCTION public.mkt_support_tickets_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.requester_user_id := OLD.requester_user_id;
  NEW.ref_no := OLD.ref_no;
  NEW.created_at := OLD.created_at;
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    NEW.closed_at := now();
    NEW.closed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_support_tickets_guard() FROM PUBLIC, anon;

CREATE TRIGGER mkt_support_tickets_guard_trg
BEFORE UPDATE ON public.mkt_support_tickets
FOR EACH ROW EXECUTE FUNCTION public.mkt_support_tickets_guard();

CREATE TRIGGER mkt_support_tickets_touch
BEFORE UPDATE ON public.mkt_support_tickets
FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

CREATE TABLE public.mkt_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.mkt_support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_support_messages_ticket_idx ON public.mkt_support_messages (ticket_id, created_at);

GRANT SELECT, INSERT ON public.mkt_support_messages TO authenticated;
GRANT ALL ON public.mkt_support_messages TO service_role;

ALTER TABLE public.mkt_support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester reads public ticket replies"
ON public.mkt_support_messages FOR SELECT TO authenticated
USING (
  is_internal = false
  AND EXISTS (
    SELECT 1 FROM public.mkt_support_tickets tk
    WHERE tk.id = ticket_id AND tk.requester_user_id = auth.uid()
  )
);

CREATE POLICY "support reads all ticket replies"
ON public.mkt_support_messages FOR SELECT TO authenticated
USING (public.mkt_admin_can('support.view'));

CREATE POLICY "requester replies to own open ticket"
ON public.mkt_support_messages FOR INSERT TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND is_internal = false
  AND EXISTS (
    SELECT 1 FROM public.mkt_support_tickets tk
    WHERE tk.id = ticket_id
      AND tk.requester_user_id = auth.uid()
      AND tk.status <> 'closed'
  )
);

CREATE POLICY "support replies to tickets"
ON public.mkt_support_messages FOR INSERT TO authenticated
WITH CHECK (author_user_id = auth.uid() AND public.mkt_admin_can('support.manage'));