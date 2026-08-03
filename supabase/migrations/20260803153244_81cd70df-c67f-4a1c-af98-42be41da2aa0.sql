-- Visitors must never trigger the admin-check function (EXECUTE is revoked for
-- anon), so the public read policy is split from the admin read policy.
DROP POLICY IF EXISTS "active activities are publicly readable" ON public.mkt_activities;
CREATE POLICY "active activities are publicly readable"
  ON public.mkt_activities FOR SELECT TO anon, authenticated
  USING (is_active AND merged_into_id IS NULL);
CREATE POLICY "admins read all activities"
  ON public.mkt_activities FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());

DROP POLICY IF EXISTS "activity groups are publicly readable" ON public.mkt_activity_groups;
CREATE POLICY "activity groups are publicly readable"
  ON public.mkt_activity_groups FOR SELECT TO anon, authenticated
  USING (is_active);
CREATE POLICY "admins read all activity groups"
  ON public.mkt_activity_groups FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin());