-- Lightweight, market-only activity log used solely to personalise suggestions.
CREATE TABLE public.mkt_user_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  ad_id uuid NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  category_id uuid NULL REFERENCES public.mkt_categories(id) ON DELETE SET NULL,
  search_query text NULL,
  city_id uuid NULL REFERENCES public.mkt_cities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_user_activity_event_type_check
    CHECK (event_type IN ('search', 'view_ad', 'favorite', 'open_category')),
  CONSTRAINT mkt_user_activity_query_len CHECK (search_query IS NULL OR char_length(search_query) <= 80)
);

CREATE INDEX mkt_user_activity_user_created_idx
  ON public.mkt_user_activity (user_id, created_at DESC);
CREATE INDEX mkt_user_activity_user_category_idx
  ON public.mkt_user_activity (user_id, category_id);

GRANT SELECT, INSERT, DELETE ON public.mkt_user_activity TO authenticated;
GRANT ALL ON public.mkt_user_activity TO service_role;

ALTER TABLE public.mkt_user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own market activity"
  ON public.mkt_user_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users record their own market activity"
  ON public.mkt_user_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users clear their own market activity"
  ON public.mkt_user_activity FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Normalise the stored query and keep the log short: 90 days, max 300 events.
CREATE OR REPLACE FUNCTION public.mkt_activity_normalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.search_query IS NOT NULL THEN
    NEW.search_query := nullif(left(btrim(regexp_replace(NEW.search_query, '\s+', ' ', 'g')), 80), '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aa_mkt_activity_normalize
  BEFORE INSERT ON public.mkt_user_activity
  FOR EACH ROW EXECUTE FUNCTION public.mkt_activity_normalize();

CREATE OR REPLACE FUNCTION public.mkt_activity_prune()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mkt_user_activity
  WHERE user_id = NEW.user_id
    AND created_at < now() - interval '90 days';

  DELETE FROM public.mkt_user_activity a
  WHERE a.user_id = NEW.user_id
    AND a.id NOT IN (
      SELECT b.id FROM public.mkt_user_activity b
      WHERE b.user_id = NEW.user_id
      ORDER BY b.created_at DESC
      LIMIT 300
    );
  RETURN NULL;
END;
$$;

CREATE TRIGGER zz_mkt_activity_prune
  AFTER INSERT ON public.mkt_user_activity
  FOR EACH ROW EXECUTE FUNCTION public.mkt_activity_prune();

REVOKE EXECUTE ON FUNCTION public.mkt_activity_normalize() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_activity_prune() FROM anon, authenticated;

-- Opt-out switch for activity-based suggestions (on by default).
ALTER TABLE public.mkt_user_profiles
  ADD COLUMN IF NOT EXISTS personalize_suggestions boolean NOT NULL DEFAULT true;
