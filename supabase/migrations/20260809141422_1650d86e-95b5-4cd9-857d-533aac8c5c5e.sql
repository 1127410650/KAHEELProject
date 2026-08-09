CREATE TABLE public.mkt_guide_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid REFERENCES public.mkt_guide_places(id) ON DELETE CASCADE,
  place_slug text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  batch_id uuid,
  note text,
  sent_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_guide_outreach_channel_chk CHECK (channel IN ('whatsapp','share','copy','email'))
);

CREATE INDEX mkt_guide_outreach_place_idx ON public.mkt_guide_outreach (place_slug, created_at DESC);
CREATE INDEX mkt_guide_outreach_sender_idx ON public.mkt_guide_outreach (sent_by, created_at DESC);

GRANT SELECT, INSERT ON public.mkt_guide_outreach TO authenticated;
GRANT ALL ON public.mkt_guide_outreach TO service_role;

ALTER TABLE public.mkt_guide_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_guide_outreach_insert_own ON public.mkt_guide_outreach
  FOR INSERT TO authenticated
  WITH CHECK (sent_by = auth.uid());

CREATE POLICY mkt_guide_outreach_select_own_or_admin ON public.mkt_guide_outreach
  FOR SELECT TO authenticated
  USING (sent_by = auth.uid() OR public.mkt_is_platform_admin());

CREATE POLICY "mkt_media_public_folder_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mkt-media' AND name LIKE 'public/%');