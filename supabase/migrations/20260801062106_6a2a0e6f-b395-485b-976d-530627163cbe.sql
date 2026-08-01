INSERT INTO public.tenant_invitations (tenant_id, email, token_hash, invited_role, invitation_type, status, expires_at, invited_by)
SELECT t.id, 'test-account-flow-1@example.com', encode(digest('TESTFLOWEXPIRED','sha256'),'hex'), 'employee','employee','pending','2025-01-01T00:00:00Z', m.user_id
FROM public.tenants t JOIN public.tenant_memberships m ON m.tenant_id=t.id AND m.role='owner'
WHERE t.tenant_type='company' AND t.status='active' LIMIT 1;
INSERT INTO public.tenant_invitations (tenant_id, email, token_hash, invited_role, invitation_type, status, expires_at, invited_by)
SELECT t.id, 'test-account-flow-1@example.com', encode(digest('TESTFLOWREVOKED','sha256'),'hex'), 'employee','employee','revoked','2027-01-01T00:00:00Z', m.user_id
FROM public.tenants t JOIN public.tenant_memberships m ON m.tenant_id=t.id AND m.role='owner'
WHERE t.tenant_type='company' AND t.status='active' LIMIT 1;