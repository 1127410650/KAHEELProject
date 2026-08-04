-- ===================== A) job run log =====================
CREATE TABLE IF NOT EXISTS public.mkt_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  source text NOT NULL DEFAULT 'cron',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  ok boolean NOT NULL DEFAULT true,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS mkt_job_runs_job_started_idx ON public.mkt_job_runs (job, started_at DESC);

GRANT SELECT ON public.mkt_job_runs TO authenticated;
GRANT ALL ON public.mkt_job_runs TO service_role;
ALTER TABLE public.mkt_job_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_job_runs_admin_read ON public.mkt_job_runs;
CREATE POLICY mkt_job_runs_admin_read ON public.mkt_job_runs
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- ===================== B) promotion end notice =====================
-- extend the existing sweep with an advertiser notice when a paid window ends
CREATE OR REPLACE FUNCTION public.mkt_sweep_promotion_notices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.listing_id, l.owner_user_id, l.title
      FROM public.mkt_listing_promotions p
      JOIN public.mkt_listings l ON l.id = p.listing_id
     WHERE p.status = 'ended' AND p.ended_at IS NOT NULL
       AND p.ended_at > now() - interval '2 days'
       AND coalesce((p.meta->>'end_notified')::boolean, false) = false
  LOOP
    PERFORM public.mkt_notify(r.owner_user_id, NULL, 'listing_promotion_ended',
      'انتهت فترة تمويل إعلانك', r.title);
    UPDATE public.mkt_listing_promotions
       SET meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('end_notified', true)
     WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mkt_sweep_promotion_notices() FROM PUBLIC, anon, authenticated;

-- ===================== C) the scheduled tick =====================
CREATE OR REPLACE FUNCTION public.mkt_run_scheduled_jobs(_source text DEFAULT 'cron')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE run_id uuid; t0 timestamptz := clock_timestamp(); res jsonb; promo_n integer := 0;
BEGIN
  INSERT INTO public.mkt_job_runs (job, source)
  VALUES ('listings_tick', CASE WHEN _source IN ('cron','manual','http') THEN _source ELSE 'cron' END)
  RETURNING id INTO run_id;

  BEGIN
    res := public.mkt_sweep_expired_listings();
    promo_n := public.mkt_sweep_promotion_notices();
    res := coalesce(res, '{}'::jsonb) || jsonb_build_object('promotion_notices', promo_n);

    UPDATE public.mkt_job_runs
       SET finished_at = now(), ok = true, result = res,
           duration_ms = (extract(epoch FROM clock_timestamp() - t0) * 1000)::int
     WHERE id = run_id;
    RETURN jsonb_build_object('run_id', run_id, 'ok', true, 'result', res);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.mkt_job_runs
       SET finished_at = now(), ok = false, error = SQLERRM,
           duration_ms = (extract(epoch FROM clock_timestamp() - t0) * 1000)::int
     WHERE id = run_id;
    RETURN jsonb_build_object('run_id', run_id, 'ok', false, 'error', SQLERRM);
  END;
END $$;
REVOKE ALL ON FUNCTION public.mkt_run_scheduled_jobs(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_run_scheduled_jobs(text) TO service_role;

-- platform admins may trigger a tick by hand from the console
CREATE OR REPLACE FUNCTION public.mkt_admin_run_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN public.mkt_run_scheduled_jobs('manual');
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_run_tick() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_run_tick() TO authenticated;

-- ===================== D) schedule it =====================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
DO $$
BEGIN
  PERFORM cron.unschedule('mkt_listings_tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.schedule('mkt_listings_tick', '*/15 * * * *',
    $cmd$SELECT public.mkt_run_scheduled_jobs('cron');$cmd$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron scheduling unavailable: %', SQLERRM;
END $$;

-- ===================== E) re-scan after an edit =====================
CREATE OR REPLACE FUNCTION public.mkt_listing_content_rescan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _scan jsonb; _dec text;
BEGIN
  IF OLD.status <> 'published' OR NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.keywords IS NOT DISTINCT FROM OLD.keywords THEN
    RETURN NEW;
  END IF;

  _scan := public.mkt_moderation_scan_listing(NEW.id, 'admin_rescan');
  _dec := _scan->>'decision';
  IF _dec = 'clean' THEN RETURN NEW; END IF;

  PERFORM public.mkt_set_listing_status(NEW.id, 'pending',
    CASE WHEN _dec = 'block' THEN 'moderation_blocked_suspected' ELSE 'moderation_review' END);
  PERFORM public.mkt_log_listing_event(NEW.id, 'edit_requires_review',
    jsonb_build_object('decision', _dec, 'scan_id', _scan->>'scan_id'));
  PERFORM public.mkt_notify(NEW.owner_user_id, NULL, 'listing_needs_review',
    'تم تعديل إعلانك ويحتاج إلى مراجعة قبل إعادة نشره', NEW.title);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zzz_mkt_listings_content_rescan ON public.mkt_listings;
CREATE TRIGGER zzz_mkt_listings_content_rescan
  AFTER UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_content_rescan();