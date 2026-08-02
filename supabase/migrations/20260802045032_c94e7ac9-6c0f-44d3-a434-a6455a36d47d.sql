-- 1) Individual (personal) public marketplace identity
CREATE TABLE IF NOT EXISTS public.mkt_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  headline text,
  about text,
  city text,
  region text,
  avatar_url text,
  public_phone text,
  public_email text,
  public_whatsapp text,
  show_phone boolean NOT NULL DEFAULT false,
  show_email boolean NOT NULL DEFAULT false,
  show_whatsapp boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'none',
  is_published boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_user_profiles_username_format CHECK (username ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  CONSTRAINT mkt_user_profiles_verification CHECK (verification_status IN ('none','pending','verified','rejected','revoked'))
);

GRANT SELECT ON public.mkt_user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_user_profiles TO authenticated;
GRANT ALL ON public.mkt_user_profiles TO service_role;
ALTER TABLE public.mkt_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_user_profiles_public_read ON public.mkt_user_profiles;
CREATE POLICY mkt_user_profiles_public_read ON public.mkt_user_profiles
  FOR SELECT TO anon USING (is_published);
DROP POLICY IF EXISTS mkt_user_profiles_auth_read ON public.mkt_user_profiles;
CREATE POLICY mkt_user_profiles_auth_read ON public.mkt_user_profiles
  FOR SELECT TO authenticated
  USING (is_published OR user_id = auth.uid() OR public.mkt_is_platform_admin());
DROP POLICY IF EXISTS mkt_user_profiles_own_insert ON public.mkt_user_profiles;
CREATE POLICY mkt_user_profiles_own_insert ON public.mkt_user_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS mkt_user_profiles_own_update ON public.mkt_user_profiles;
CREATE POLICY mkt_user_profiles_own_update ON public.mkt_user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.mkt_is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR public.mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public.mkt_user_profile_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  NEW.updated_at := now();
  NEW.username := lower(btrim(NEW.username));
  IF TG_OP = 'INSERT' THEN
    IF NOT public.mkt_is_platform_admin() THEN
      NEW.verification_status := 'none';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.joined_at := OLD.joined_at;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND NOT public.mkt_is_platform_admin() THEN
      RAISE EXCEPTION 'Only marketplace administrators can change verification status';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS mkt_user_profiles_before_write ON public.mkt_user_profiles;
CREATE TRIGGER mkt_user_profiles_before_write BEFORE INSERT OR UPDATE ON public.mkt_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_user_profile_before_write();

-- 2) Advertiser identity on listings (unforgeable, derived from tenant_id)
ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS advertiser_type text
  GENERATED ALWAYS AS (CASE WHEN tenant_id IS NULL THEN 'individual' ELSE 'business' END) STORED;

CREATE INDEX IF NOT EXISTS mkt_listings_advertiser_type_idx ON public.mkt_listings (advertiser_type);
CREATE INDEX IF NOT EXISTS mkt_listings_owner_published_idx ON public.mkt_listings (owner_user_id, published_at DESC);

-- 3) Publishing capability for a business identity
CREATE OR REPLACE FUNCTION public.mkt_can_publish_as_business(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT public.is_tenant_member(_tenant_id) AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = _tenant_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('owner','accountant','employee','service_provider')
  );
$$;
REVOKE ALL ON FUNCTION public.mkt_can_publish_as_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_can_publish_as_business(uuid) TO authenticated;

-- 4) All registered users may publish; verification is a badge, not a gate.
CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  -- Review decisions belong to platform admins only.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('published','rejected','suspended')
     AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Only marketplace administrators can approve, reject or suspend listings';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.mkt_is_platform_admin() THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'The advertiser of a listing cannot be changed';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'The advertising identity of a listing cannot be changed';
    END IF;
  END IF;

  -- Publishing under a business name requires an active membership with publishing rights.
  IF NEW.tenant_id IS NOT NULL
     AND NOT public.mkt_is_platform_admin()
     AND NOT public.mkt_can_publish_as_business(NEW.tenant_id) THEN
    RAISE EXCEPTION 'You are not allowed to publish on behalf of this business';
  END IF;

  RETURN NEW;
END; $$;

DROP POLICY IF EXISTS mkt_listings_owner_insert ON public.mkt_listings;
CREATE POLICY mkt_listings_owner_insert ON public.mkt_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND status IN ('draft','pending')
    AND (tenant_id IS NULL OR public.mkt_can_publish_as_business(tenant_id))
  );

-- 5) Follows (individual and business identities)
CREATE TABLE IF NOT EXISTS public.mkt_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('individual','business')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, target_type, target_id)
);
GRANT SELECT, INSERT, DELETE ON public.mkt_follows TO authenticated;
GRANT ALL ON public.mkt_follows TO service_role;
ALTER TABLE public.mkt_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_follows_own ON public.mkt_follows;
CREATE POLICY mkt_follows_own ON public.mkt_follows
  FOR ALL TO authenticated
  USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());