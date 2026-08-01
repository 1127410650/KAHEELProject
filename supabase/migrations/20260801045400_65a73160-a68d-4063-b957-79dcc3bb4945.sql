
CREATE POLICY "app_settings_tenant_isolation" ON public.app_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_tenant_id());
