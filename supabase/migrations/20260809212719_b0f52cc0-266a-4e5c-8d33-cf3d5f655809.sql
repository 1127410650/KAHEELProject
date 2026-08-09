CREATE TABLE public.mkt_otp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  provider text NOT NULL,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  dial_codes text[] NOT NULL DEFAULT '{}',
  is_fallback boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  cost_per_message numeric(10,4) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, provider)
);

CREATE TABLE public.mkt_otp_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_masked text NOT NULL,
  phone_hash text NOT NULL,
  country_iso2 text,
  dial_code text,
  channel text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','unconfigured')),
  provider_message_id text,
  error_code text,
  error_detail text,
  attempt integer NOT NULL DEFAULT 1,
  cost_amount numeric(10,4) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mkt_otp_sends_created_idx ON public.mkt_otp_sends (created_at DESC);
CREATE INDEX mkt_otp_sends_phone_hash_idx ON public.mkt_otp_sends (phone_hash, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_otp_channels TO authenticated;
GRANT ALL ON public.mkt_otp_channels TO service_role;
GRANT SELECT ON public.mkt_otp_sends TO authenticated;
GRANT ALL ON public.mkt_otp_sends TO service_role;

ALTER TABLE public.mkt_otp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_otp_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otp channels are platform admin only"
ON public.mkt_otp_channels FOR ALL TO authenticated
USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());

CREATE POLICY "otp sends are readable by platform admins"
ON public.mkt_otp_sends FOR SELECT TO authenticated
USING (public.mkt_is_platform_admin());

CREATE TRIGGER mkt_otp_channels_touch BEFORE UPDATE ON public.mkt_otp_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mkt_otp_sends_touch BEFORE UPDATE ON public.mkt_otp_sends
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.mkt_otp_channels (channel, provider, label_ar, label_en, dial_codes, is_fallback, is_enabled, priority, cost_per_message, notes) VALUES
  ('sms','linksyria','رسائل نصية — LinkSyria','SMS — LinkSyria','{963}',false,true,10,0.0200,'المزوّد المحلي المعتمد للأرقام السورية. واتساب غير مدعوم في سوريا.'),
  ('sms','twilio','رسائل نصية — Twilio','SMS — Twilio','{}',true,false,60,0.0500,'بديل دولي معطّل افتراضيًا؛ لا يغطي سوريا.'),
  ('whatsapp','whatsapp_cloud','واتساب — Meta Cloud API','WhatsApp — Meta Cloud API','{}',true,true,20,0.0150,'للأرقام خارج سوريا فقط: مستخدمو واتساب في سوريا غير مؤهلين لرسائل المنصة.'),
  ('email','supabase_email','بريد إلكتروني','Email','{}',true,true,30,0.0000,'قناة مضمونة للأرقام خارج سوريا.');

ALTER TABLE public.mkt_login_otps ALTER COLUMN max_attempts SET DEFAULT 3;