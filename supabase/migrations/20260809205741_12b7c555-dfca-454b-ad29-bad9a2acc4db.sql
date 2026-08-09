CREATE TABLE public.mkt_login_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('whatsapp','sms')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  delivered boolean NOT NULL DEFAULT false,
  provider text,
  request_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_login_otps_phone_idx ON public.mkt_login_otps (phone, created_at DESC);

GRANT ALL ON public.mkt_login_otps TO service_role;

ALTER TABLE public.mkt_login_otps ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: only server-side service-role code touches this table.

CREATE OR REPLACE FUNCTION public.mkt_purge_login_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.mkt_login_otps WHERE created_at < now() - interval '1 day';
$$;

REVOKE ALL ON FUNCTION public.mkt_purge_login_otps() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_purge_login_otps() TO service_role;