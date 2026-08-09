-- Approved owner of a directory place (from the existing claims table).
CREATE OR REPLACE FUNCTION public.mkt_guide_place_owner(_place_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.user_id
  FROM public.mkt_guide_place_claims c
  WHERE c.place_id = _place_id
    AND c.status = 'approved'
  ORDER BY c.reviewed_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1
$$;

CREATE TABLE public.mkt_guide_booking_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  place_slug text NOT NULL,
  place_name text,
  requester_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'intent',
  owner_claimed boolean NOT NULL DEFAULT false,
  requested_at timestamptz,
  contact_name text,
  contact_phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_guide_booking_intents_place_idx
  ON public.mkt_guide_booking_intents (place_id, created_at DESC);
CREATE INDEX mkt_guide_booking_intents_requester_idx
  ON public.mkt_guide_booking_intents (requester_id, created_at DESC);

GRANT INSERT, SELECT ON public.mkt_guide_booking_intents TO authenticated;
GRANT INSERT ON public.mkt_guide_booking_intents TO anon;
GRANT ALL ON public.mkt_guide_booking_intents TO service_role;

ALTER TABLE public.mkt_guide_booking_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_intents_insert_anyone"
  ON public.mkt_guide_booking_intents FOR INSERT TO anon, authenticated
  WITH CHECK (requester_id IS NULL OR requester_id = auth.uid());

CREATE POLICY "booking_intents_select_own"
  ON public.mkt_guide_booking_intents FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

CREATE POLICY "booking_intents_select_owner"
  ON public.mkt_guide_booking_intents FOR SELECT TO authenticated
  USING (public.mkt_guide_place_owner(place_id) = auth.uid());

CREATE POLICY "booking_intents_select_admin"
  ON public.mkt_guide_booking_intents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()));

CREATE TRIGGER mkt_guide_booking_intents_updated_at
  BEFORE UPDATE ON public.mkt_guide_booking_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();