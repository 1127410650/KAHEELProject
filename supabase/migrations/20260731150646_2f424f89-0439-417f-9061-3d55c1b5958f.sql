REVOKE ALL ON FUNCTION public.request_exists(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.project_exists(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.project_membership_set(uuid, uuid, text, date, date) FROM anon;
REVOKE ALL ON FUNCTION public.project_membership_end(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.request_convert_to_project(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.request_post_message(uuid, text, uuid, text, text, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_request_scope() FROM anon, authenticated, PUBLIC;