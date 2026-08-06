-- Helper: who may see a business's financial/identity records
CREATE OR REPLACE FUNCTION public.mkt_is_business_principal(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    _tenant_id IS NOT NULL AND (
      public.has_tenant_role(_tenant_id, 'owner')
      OR public.has_tenant_role(_tenant_id, 'admin')
      OR public.has_tenant_role(_tenant_id, 'accountant')
    )
  ) OR public.mkt_is_platform_admin()
$$;

-- Bank accounts: business rows only for principals, personal rows only for the owner
DROP POLICY IF EXISTS mkt_bank_accounts_read ON public.mkt_bank_accounts;
CREATE POLICY mkt_bank_accounts_read ON public.mkt_bank_accounts
FOR SELECT TO authenticated
USING (
  ((tenant_id IS NULL) AND (owner_user_id = auth.uid()))
  OR ((tenant_id IS NOT NULL) AND public.mkt_is_business_principal(tenant_id))
);

-- Business officers: full ID numbers only for principals, the officer, or reviewers
DROP POLICY IF EXISTS mkt_business_officers_read ON public.mkt_business_officers;
CREATE POLICY mkt_business_officers_read ON public.mkt_business_officers
FOR SELECT TO authenticated
USING (
  public.mkt_is_business_principal(tenant_id)
  OR user_id = auth.uid()
  OR public.mkt_can_review_identity()
);