-- Explicitly deny all browser roles at the RLS layer in addition to the revoked
-- table privileges. Application access remains available only through the
-- reviewed, account-scoped SECURITY DEFINER APIs.

DROP POLICY IF EXISTS mkt_join_applications_no_direct_browser_access
  ON public.mkt_join_applications;
CREATE POLICY mkt_join_applications_no_direct_browser_access
  ON public.mkt_join_applications
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS mkt_join_documents_no_direct_browser_access
  ON public.mkt_join_application_documents;
CREATE POLICY mkt_join_documents_no_direct_browser_access
  ON public.mkt_join_application_documents
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS mkt_join_events_no_direct_browser_access
  ON public.mkt_join_application_events;
CREATE POLICY mkt_join_events_no_direct_browser_access
  ON public.mkt_join_application_events
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Cover every foreign key used by approval, audit and document cleanup paths.
CREATE INDEX IF NOT EXISTS mkt_join_applications_category_idx
  ON public.mkt_join_applications (provider_category_code)
  WHERE provider_category_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS mkt_join_applications_reviewer_idx
  ON public.mkt_join_applications (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS mkt_join_application_documents_owner_idx
  ON public.mkt_join_application_documents (owner_user_id);

CREATE INDEX IF NOT EXISTS mkt_join_application_events_actor_idx
  ON public.mkt_join_application_events (actor_user_id)
  WHERE actor_user_id IS NOT NULL;
