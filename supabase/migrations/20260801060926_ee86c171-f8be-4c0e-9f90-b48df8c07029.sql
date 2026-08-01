-- Pending invitations addressed to the signed-in user's email (no raw token exposure)
CREATE OR REPLACE FUNCTION public.my_invitations()
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name_ar text,
  tenant_name_en text,
  invited_role text,
  invitation_type text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id,
         i.tenant_id,
         t.name_ar,
         t.name_en,
         i.invited_role,
         i.invitation_type,
         i.expires_at,
         i.created_at
  FROM public.tenant_invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND lower(i.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    AND auth.uid() IS NOT NULL
  ORDER BY i.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.my_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invitations() TO authenticated;

-- Accept an invitation by id, only when it targets the caller's own email
CREATE OR REPLACE FUNCTION public.invitation_accept_by_id(_id uuid)
RETURNS TABLE (tenant_id uuid, activated boolean, memberships integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.tenant_invitations;
  v_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_inv FROM public.tenant_invitations WHERE id = _id;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITATION_REVOKED';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITATION_USED';
  END IF;
  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;

  RETURN QUERY SELECT * FROM public.invitation_accept(v_inv.token_hash_source_unavailable());
EXCEPTION
  WHEN undefined_function THEN
    -- fall back to inline acceptance when token cannot be reconstructed
    RAISE;
END;
$$;
