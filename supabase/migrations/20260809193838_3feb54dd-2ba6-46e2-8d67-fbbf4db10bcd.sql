-- 1) column-level: phone leaves the Data API entirely
REVOKE SELECT ON public.mkt_errand_captains FROM authenticated;
GRANT SELECT (
  id, user_id, display_name, vehicle, status, is_online,
  rating_avg, rating_count, jobs_done, created_at, updated_at, last_seen_at
) ON public.mkt_errand_captains TO authenticated;

-- 2) signed-in users may read the public card of approved captains
CREATE POLICY "approved captain cards are readable"
  ON public.mkt_errand_captains FOR SELECT TO authenticated
  USING (status = 'approved');

-- 3) platform admins oversee the whole service
CREATE POLICY "admins manage captains"
  ON public.mkt_errand_captains FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY "admins manage errand requests"
  ON public.mkt_errand_requests FOR ALL TO authenticated
  USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY "admins read errand offers"
  ON public.mkt_errand_offers FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

CREATE POLICY "admins read errand events"
  ON public.mkt_errand_events FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());