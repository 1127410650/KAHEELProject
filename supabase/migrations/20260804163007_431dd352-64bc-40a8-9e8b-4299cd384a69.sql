ALTER TABLE public.mkt_listings ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_listing_images ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_favorites ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_conversations ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_messages ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_notifications ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_user_activity ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_business_profiles ADD COLUMN IF NOT EXISTS qa_batch_id text;
ALTER TABLE public.mkt_business_officers ADD COLUMN IF NOT EXISTS qa_batch_id text;

CREATE INDEX IF NOT EXISTS mkt_listings_qa_batch_idx ON public.mkt_listings (qa_batch_id) WHERE qa_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_listing_images_qa_batch_idx ON public.mkt_listing_images (qa_batch_id) WHERE qa_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_conversations_qa_batch_idx ON public.mkt_conversations (qa_batch_id) WHERE qa_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_notifications_qa_batch_idx ON public.mkt_notifications (qa_batch_id) WHERE qa_batch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mkt_qa_cleanup(_batch_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_listings uuid[];
  v_result jsonb;
  v_n_listings int := 0;
  v_n_msgs int := 0;
  v_n_convs int := 0;
  v_n_notes int := 0;
  v_n_acts int := 0;
BEGIN
  IF _batch_id IS NULL OR btrim(_batch_id) = '' THEN
    RAISE EXCEPTION 'BATCH_ID_REQUIRED';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.mkt_is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_listings
    FROM public.mkt_listings WHERE qa_batch_id = _batch_id;

  DELETE FROM public.mkt_messages m
   WHERE m.qa_batch_id = _batch_id
      OR m.conversation_id IN (SELECT id FROM public.mkt_conversations WHERE qa_batch_id = _batch_id);
  GET DIAGNOSTICS v_n_msgs = ROW_COUNT;

  DELETE FROM public.mkt_conversations
   WHERE qa_batch_id = _batch_id OR listing_id = ANY(v_listings);
  GET DIAGNOSTICS v_n_convs = ROW_COUNT;

  DELETE FROM public.mkt_notifications WHERE qa_batch_id = _batch_id;
  GET DIAGNOSTICS v_n_notes = ROW_COUNT;

  DELETE FROM public.mkt_user_activity WHERE qa_batch_id = _batch_id OR ad_id = ANY(v_listings);
  GET DIAGNOSTICS v_n_acts = ROW_COUNT;

  DELETE FROM public.mkt_favorites WHERE qa_batch_id = _batch_id OR listing_id = ANY(v_listings);
  DELETE FROM public.mkt_listing_images WHERE qa_batch_id = _batch_id OR listing_id = ANY(v_listings);
  DELETE FROM public.mkt_listing_licenses WHERE listing_id = ANY(v_listings);
  DELETE FROM public.mkt_listing_status_history WHERE listing_id = ANY(v_listings);
  DELETE FROM public.mkt_listing_events WHERE listing_id = ANY(v_listings);
  DELETE FROM public.mkt_moderation_scans WHERE listing_id = ANY(v_listings);
  DELETE FROM public.mkt_admin_assignments
   WHERE kind IN ('listing_review') AND subject_id = ANY(v_listings);

  DELETE FROM public.mkt_listings WHERE qa_batch_id = _batch_id;
  GET DIAGNOSTICS v_n_listings = ROW_COUNT;

  DELETE FROM public.mkt_business_officers WHERE qa_batch_id = _batch_id;
  DELETE FROM public.mkt_business_profiles WHERE qa_batch_id = _batch_id;

  v_result := jsonb_build_object(
    'batch_id', _batch_id,
    'listings_deleted', v_n_listings,
    'messages_deleted', v_n_msgs,
    'conversations_deleted', v_n_convs,
    'notifications_deleted', v_n_notes,
    'activity_deleted', v_n_acts
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_qa_cleanup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_qa_cleanup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_qa_cleanup(text) TO service_role;