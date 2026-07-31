GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.invoices_internal_no_seq TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON SEQUENCE public.invoices_internal_no_seq TO service_role;

GRANT SELECT, INSERT ON public.invoice_status_history TO authenticated;
GRANT ALL ON public.invoice_status_history TO service_role;