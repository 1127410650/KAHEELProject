REVOKE ALL ON public.mkt_feature_flags FROM anon;
REVOKE ALL ON public.mkt_feature_overrides FROM anon;
REVOKE ALL ON public.mkt_platform_job_definitions FROM anon;
REVOKE ALL ON public.mkt_platform_job_queue FROM anon;
REVOKE ALL ON public.mkt_platform_slos FROM anon;
REVOKE ALL ON public.mkt_health_checks FROM anon;
REVOKE ALL ON public.mkt_health_runs FROM anon;
REVOKE ALL ON public.mkt_platform_runbooks FROM anon;
REVOKE ALL ON public.mkt_alert_rules FROM anon;
REVOKE ALL ON public.mkt_platform_incidents FROM anon;
REVOKE ALL ON public.mkt_incident_timeline FROM anon;
REVOKE ALL ON public.mkt_platform_dependencies FROM anon;

REVOKE EXECUTE ON FUNCTION public.mkt_touch_updated_at() FROM anon, authenticated, PUBLIC;