REVOKE ALL ON TABLE public.mkt_message_reports FROM anon;
REVOKE ALL ON TABLE public.mkt_message_reports FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mkt_message_reports TO authenticated;
GRANT ALL ON public.mkt_message_reports TO service_role;