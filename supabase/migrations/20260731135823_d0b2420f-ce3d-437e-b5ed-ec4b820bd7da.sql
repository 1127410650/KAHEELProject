REVOKE EXECUTE ON FUNCTION public.approve_attachment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_supervisor_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_perm(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_decide(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_execute(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_reassign(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_request_reminder(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_request_ownership() FROM anon, authenticated, PUBLIC;
CREATE POLICY "login_attempts no client access" ON public.login_attempts
  FOR SELECT TO authenticated USING (false);