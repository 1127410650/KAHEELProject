ALTER VIEW public.custody_balances SET (security_invoker = true);
GRANT SELECT ON public.custody_balances TO authenticated;
GRANT ALL ON public.custody_balances TO service_role;