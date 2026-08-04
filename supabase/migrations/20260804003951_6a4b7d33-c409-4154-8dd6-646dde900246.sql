-- =====================================================================
-- Ad duration policy (7 days), points-funded promotion, content scanning
-- =====================================================================

-- 0) settings ---------------------------------------------------------
INSERT INTO public.mkt_platform_settings (key, section, value, description_ar) VALUES
  ('listings.organic_duration_days', 'listings', '{"days": 7}', 'مدة الإعلان العادي بالأيام'),
  ('promotions.point_prices', 'promotions', '{"1": 10, "3": 25, "7": 50, "14": 90, "30": 170}', 'تكلفة تمويل الإعلان بالنقاط لكل مدة'),
  ('moderation.policy_version', 'moderation', '{"version": "1.0.0"}', 'إصدار سياسة فحص المحتوى'),
  ('moderation.thresholds', 'moderation', '{"review": 2, "block": 6}', 'حدود قرار الفحص')
ON CONFLICT (key) DO NOTHING;

UPDATE public.mkt_platform_settings
   SET value = '{"days": 7}', updated_at = now()
 WHERE key = 'listings.default_duration_days';

-- 1) listing columns --------------------------------------------------
ALTER TABLE public.mkt_listings
  ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT 'unscanned',
  ADD COLUMN IF NOT EXISTS moderation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scan_at timestamptz,
  ADD COLUMN IF NOT EXISTS promoted_until timestamptz;

ALTER TABLE public.mkt_listings DROP CONSTRAINT IF EXISTS mkt_listings_moderation_state_check;
ALTER TABLE public.mkt_listings ADD CONSTRAINT mkt_listings_moderation_state_check
  CHECK (moderation_state = ANY (ARRAY['unscanned','clean','review','blocked_suspected','cleared']));

-- 2) op flags ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_is_listing_op()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(current_setting('mkt.listing_op', true), '')
              IN ('owner_lifecycle','auto_publish') $$;

CREATE OR REPLACE FUNCTION public.mkt_is_auto_publish_op()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(current_setting('mkt.listing_op', true), '') = 'auto_publish' $$;
REVOKE ALL ON FUNCTION public.mkt_is_auto_publish_op() FROM PUBLIC, anon;

-- allow the audited auto-publish path to move a clean ad straight to published
CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE base text; candidate text; n int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.mkt_slugify(NEW.title);
    IF base IS NULL OR base = '' THEN base := 'ad'; END IF;
    candidate := base || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);
    WHILE EXISTS (SELECT 1 FROM public.mkt_listings l WHERE l.slug = candidate AND l.id <> NEW.id) LOOP
      n := n + 1; candidate := base || '-' || n::text || '-' || substr(replace(NEW.id::text,'-',''), 1, 6);
    END LOOP;
    NEW.slug := candidate;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('published','rejected','suspended','needs_changes')
       AND NOT public.mkt_is_platform_admin()
       AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action())
       AND NOT (NEW.status = 'published' AND public.mkt_is_auto_publish_op())
       AND NOT (NEW.status = 'published' AND public.mkt_is_listing_op() AND OLD.published_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Only platform reviewers can set status %', NEW.status;
    END IF;
    IF NEW.status = 'rejected' AND coalesce(btrim(NEW.rejection_reason),'') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN
      NEW.published_at := coalesce(OLD.published_at, now());
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 3) moderation rules -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_moderation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'word' CHECK (kind IN ('word','phrase','regex')),
  pattern text NOT NULL,
  normalized text,
  lang text NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar','en','any')),
  category text NOT NULL DEFAULT 'other' CHECK (category IN (
    'profanity','sexual','threat','hate','racism','defamation','incitement',
    'morals','fraud','prohibited','competitor','bypass','contact','spam','other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  action text NOT NULL DEFAULT 'review' CHECK (action IN ('flag','review','block','allow')),
  weight integer NOT NULL DEFAULT 2 CHECK (weight BETWEEN 0 AND 20),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_moderation_rules TO authenticated;
GRANT ALL ON public.mkt_moderation_rules TO service_role;
ALTER TABLE public.mkt_moderation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_moderation_rules_admin_read ON public.mkt_moderation_rules;
CREATE POLICY mkt_moderation_rules_admin_read ON public.mkt_moderation_rules
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- 4) normalization ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_moderation_normalize(_t text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE s text;
BEGIN
  s := lower(coalesce(_t, ''));
  s := regexp_replace(s, E'[\u064B-\u0652\u0640\u0670]', '', 'g');   -- diacritics + tatweel
  s := translate(s, E'\u0623\u0625\u0622\u0671\u0649\u0629\u0624\u0626',
                    E'\u0627\u0627\u0627\u0627\u064A\u0647\u0648\u064A');
  s := translate(s, '@$013457', 'asoieast');                          -- leet digits
  s := regexp_replace(s, E'[^a-z\u0621-\u064A]', '', 'g');            -- drop spaces/symbols
  s := regexp_replace(s, '(.)\1{2,}', '\1', 'g');                     -- collapse stretched chars
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.mkt_moderation_normalize(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.mkt_moderation_rule_normalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.normalized := CASE WHEN NEW.kind = 'regex' THEN NULL
                         ELSE public.mkt_moderation_normalize(NEW.pattern) END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mkt_moderation_rules_normalize ON public.mkt_moderation_rules;
CREATE TRIGGER mkt_moderation_rules_normalize
  BEFORE INSERT OR UPDATE ON public.mkt_moderation_rules
  FOR EACH ROW EXECUTE FUNCTION public.mkt_moderation_rule_normalize();

-- 5) scans ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_moderation_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('clean','review','block')),
  score integer NOT NULL DEFAULT 0,
  policy_version text,
  rules_evaluated integer NOT NULL DEFAULT 0,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  trigger_source text NOT NULL DEFAULT 'submit'
    CHECK (trigger_source IN ('submit','reactivate','admin_rescan')),
  dismissed_at timestamptz,
  dismissed_by uuid,
  dismiss_reason text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_moderation_scans_listing_idx
  ON public.mkt_moderation_scans (listing_id, scanned_at DESC);
GRANT SELECT ON public.mkt_moderation_scans TO authenticated;
GRANT ALL ON public.mkt_moderation_scans TO service_role;
ALTER TABLE public.mkt_moderation_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_moderation_scans_admin_read ON public.mkt_moderation_scans;
CREATE POLICY mkt_moderation_scans_admin_read ON public.mkt_moderation_scans
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- 6) the scan engine --------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_moderation_scan_listing(_id uuid, _trigger text DEFAULT 'submit')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record; raw text; norm text; n_title text; n_summary text; n_desc text; n_keys text;
  r record; sig jsonb := '[]'::jsonb; score integer := 0; rules_n integer := 0;
  blocked boolean := false; review boolean := false; decision text; pol text;
  thr jsonb; thr_review integer; thr_block integer; scan_id uuid; field text; state text;
BEGIN
  SELECT * INTO l FROM public.mkt_listings WHERE id = _id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  raw := concat_ws(' ', l.title, l.summary, l.description, array_to_string(coalesce(l.keywords, '{}'), ' '));
  norm      := public.mkt_moderation_normalize(raw);
  n_title   := public.mkt_moderation_normalize(l.title);
  n_summary := public.mkt_moderation_normalize(l.summary);
  n_desc    := public.mkt_moderation_normalize(l.description);
  n_keys    := public.mkt_moderation_normalize(array_to_string(coalesce(l.keywords, '{}'), ' '));

  SELECT value->>'version' INTO pol FROM public.mkt_platform_settings WHERE key = 'moderation.policy_version';
  SELECT value INTO thr FROM public.mkt_platform_settings WHERE key = 'moderation.thresholds';
  thr_review := coalesce((thr->>'review')::int, 2);
  thr_block  := coalesce((thr->>'block')::int, 6);

  -- an explicit allow-listed phrase neutralises look-alike matches
  IF EXISTS (SELECT 1 FROM public.mkt_moderation_rules
              WHERE is_active AND action = 'allow' AND normalized IS NOT NULL
                AND normalized <> '' AND position(normalized in norm) > 0) THEN
    sig := sig || jsonb_build_array(jsonb_build_object('type','allow_list','note','matched an allow-listed phrase'));
  END IF;

  FOR r IN SELECT * FROM public.mkt_moderation_rules WHERE is_active AND action <> 'allow' LOOP
    rules_n := rules_n + 1;
    IF (r.kind = 'regex' AND r.pattern IS NOT NULL AND raw ~* r.pattern)
       OR (r.kind <> 'regex' AND coalesce(r.normalized,'') <> '' AND position(r.normalized in norm) > 0) THEN
      field := CASE
        WHEN r.kind <> 'regex' AND position(r.normalized in coalesce(n_title,'')) > 0 THEN 'title'
        WHEN r.kind <> 'regex' AND position(r.normalized in coalesce(n_summary,'')) > 0 THEN 'summary'
        WHEN r.kind <> 'regex' AND position(r.normalized in coalesce(n_keys,'')) > 0 THEN 'keywords'
        WHEN r.kind <> 'regex' AND position(r.normalized in coalesce(n_desc,'')) > 0 THEN 'description'
        ELSE 'content' END;
      score := score + r.weight;
      IF r.action = 'block' THEN blocked := true; ELSE review := true; END IF;
      sig := sig || jsonb_build_array(jsonb_build_object(
        'type','rule','rule_id', r.id, 'category', r.category, 'severity', r.severity,
        'action', r.action, 'weight', r.weight, 'field', field,
        'pattern', left(r.pattern, 80),
        'excerpt', CASE WHEN r.kind = 'regex'
                        THEN left(coalesce(substring(raw from r.pattern), ''), 80)
                        ELSE left(r.pattern, 80) END));
    END IF;
  END LOOP;

  -- structural signals (free, deterministic)
  IF raw ~* '(https?://|www\.|t\.me/|wa\.me/|whatsapp|telegram|snapchat|instagram\.com)' THEN
    score := score + 2; review := true;
    sig := sig || jsonb_build_array(jsonb_build_object('type','contact_or_link','severity','medium','field','content'));
  END IF;
  IF l.price IS NOT NULL AND NOT coalesce(l.price_on_request, false)
     AND (l.price < 0 OR l.price > 1000000000) THEN
    score := score + 2; review := true;
    sig := sig || jsonb_build_array(jsonb_build_object('type','abnormal_price','severity','low','value', l.price));
  END IF;
  IF EXISTS (
      SELECT 1 FROM public.mkt_listings d
       WHERE d.id <> l.id AND d.deleted_at IS NULL
         AND d.owner_user_id = l.owner_user_id
         AND d.status IN ('published','pending')
         AND public.mkt_moderation_normalize(d.title) = n_title
         AND d.created_at > now() - interval '30 days') THEN
    score := score + 2; review := true;
    sig := sig || jsonb_build_array(jsonb_build_object('type','duplicate_title','severity','medium'));
  END IF;

  decision := CASE
    WHEN blocked OR score >= thr_block THEN 'block'
    WHEN review OR score >= thr_review THEN 'review'
    ELSE 'clean' END;

  INSERT INTO public.mkt_moderation_scans
    (listing_id, decision, score, policy_version, rules_evaluated, signals, content_hash, trigger_source)
  VALUES (_id, decision, score, pol, rules_n, sig, encode(digest(coalesce(raw,''), 'sha256'), 'hex'),
          CASE WHEN _trigger IN ('submit','reactivate','admin_rescan') THEN _trigger ELSE 'submit' END)
  RETURNING id INTO scan_id;

  state := CASE decision WHEN 'clean' THEN 'clean' WHEN 'review' THEN 'review' ELSE 'blocked_suspected' END;
  UPDATE public.mkt_listings
     SET moderation_state = state, moderation_score = score, last_scan_at = now()
   WHERE id = _id;

  PERFORM public.mkt_log_listing_event(_id, 'moderation_scanned',
    jsonb_build_object('decision', decision, 'score', score, 'policy_version', pol, 'trigger', _trigger));

  RETURN jsonb_build_object('scan_id', scan_id, 'decision', decision, 'score', score,
                            'policy_version', pol, 'signals', sig);
END $$;
REVOKE ALL ON FUNCTION public.mkt_moderation_scan_listing(uuid, text) FROM PUBLIC, anon, authenticated;

-- 7) seed starter rules ------------------------------------------------
INSERT INTO public.mkt_moderation_rules (kind, pattern, lang, category, severity, action, weight, notes)
SELECT * FROM (VALUES
  ('word','كلب','ar','profanity','medium','review',3,'سب شائع'),
  ('word','حمار','ar','profanity','medium','review',3,NULL),
  ('word','غبي','ar','profanity','low','review',2,NULL),
  ('word','حقير','ar','profanity','medium','review',3,NULL),
  ('word','قذر','ar','profanity','medium','review',3,NULL),
  ('word','لعنة','ar','profanity','low','review',2,NULL),
  ('word','سأقتلك','ar','threat','high','block',8,'تهديد صريح'),
  ('word','اقتلك','ar','threat','high','block',8,NULL),
  ('word','سأحرق','ar','threat','high','block',8,NULL),
  ('word','جنس','ar','sexual','high','block',8,NULL),
  ('word','اباحي','ar','sexual','high','block',8,NULL),
  ('word','دعارة','ar','sexual','high','block',10,NULL),
  ('word','مخدرات','ar','prohibited','high','block',10,NULL),
  ('word','حشيش','ar','prohibited','high','block',10,NULL),
  ('word','سلاح','ar','prohibited','high','review',5,'قد يكون سياقًا مشروعًا'),
  ('word','مسدس','ar','prohibited','high','review',5,NULL),
  ('word','تزوير','ar','fraud','high','block',8,NULL),
  ('word','شهادات مزورة','ar','fraud','high','block',10,NULL),
  ('word','غسيل اموال','ar','fraud','high','block',10,NULL),
  ('word','قرض بدون فوائد مضمون','ar','fraud','medium','review',4,NULL),
  ('word','عنصري','ar','racism','medium','review',4,NULL),
  ('word','كراهية','ar','hate','medium','review',4,NULL),
  ('word','نصاب','ar','defamation','medium','review',3,NULL),
  ('word','fuck','en','profanity','high','block',8,NULL),
  ('word','shit','en','profanity','medium','review',3,NULL),
  ('word','bitch','en','profanity','high','block',8,NULL),
  ('word','porn','en','sexual','high','block',10,NULL),
  ('word','sex','en','sexual','high','review',5,NULL),
  ('word','escort','en','sexual','high','block',8,NULL),
  ('word','cocaine','en','prohibited','high','block',10,NULL),
  ('word','weapon','en','prohibited','medium','review',4,NULL),
  ('word','scam','en','fraud','medium','review',3,NULL),
  ('word','moneylaundering','en','fraud','high','block',10,NULL),
  ('phrase','تواصل خارج المنصة','ar','bypass','medium','review',4,NULL),
  ('phrase','الدفع خارج الموقع','ar','bypass','medium','review',4,NULL),
  ('phrase','حول المبلغ اولا','ar','fraud','high','review',5,NULL)
) AS v(kind, pattern, lang, category, severity, action, weight, notes)
WHERE NOT EXISTS (SELECT 1 FROM public.mkt_moderation_rules);

-- 8) points wallets + ledger ------------------------------------------
CREATE TABLE IF NOT EXISTS public.mkt_point_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL CHECK (account_type IN ('user','business')),
  account_id uuid NOT NULL,
  balance_points integer NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
  lifetime_granted integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_type, account_id)
);
GRANT SELECT ON public.mkt_point_wallets TO authenticated;
GRANT ALL ON public.mkt_point_wallets TO service_role;
ALTER TABLE public.mkt_point_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_point_wallets_read ON public.mkt_point_wallets;
CREATE POLICY mkt_point_wallets_read ON public.mkt_point_wallets
  FOR SELECT TO authenticated
  USING (
    public.mkt_is_platform_admin()
    OR (account_type = 'user' AND account_id = auth.uid())
    OR (account_type = 'business' AND public.is_tenant_member(account_id))
  );

CREATE TABLE IF NOT EXISTS public.mkt_point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.mkt_point_wallets(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  points integer NOT NULL CHECK (points > 0),
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('grant','spend','refund','adjust')),
  listing_id uuid REFERENCES public.mkt_listings(id) ON DELETE SET NULL,
  promotion_id uuid,
  op_id text,
  actor_id uuid,
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_point_ledger_op_idx
  ON public.mkt_point_ledger (wallet_id, op_id) WHERE op_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_point_ledger_wallet_idx
  ON public.mkt_point_ledger (wallet_id, created_at DESC);
GRANT SELECT ON public.mkt_point_ledger TO authenticated;
GRANT ALL ON public.mkt_point_ledger TO service_role;
ALTER TABLE public.mkt_point_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_point_ledger_read ON public.mkt_point_ledger;
CREATE POLICY mkt_point_ledger_read ON public.mkt_point_ledger
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mkt_point_wallets w
                  WHERE w.id = wallet_id
                    AND (public.mkt_is_platform_admin()
                         OR (w.account_type = 'user' AND w.account_id = auth.uid())
                         OR (w.account_type = 'business' AND public.is_tenant_member(w.account_id)))));

CREATE TABLE IF NOT EXISTS public.mkt_listing_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.mkt_point_wallets(id) ON DELETE RESTRICT,
  duration_days smallint NOT NULL CHECK (duration_days IN (1,3,7,14,30)),
  points_spent integer NOT NULL CHECK (points_spent >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','refunded')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  ended_at timestamptz,
  op_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_listing_promotions_active_idx
  ON public.mkt_listing_promotions (listing_id) WHERE status = 'active';
GRANT SELECT ON public.mkt_listing_promotions TO authenticated;
GRANT ALL ON public.mkt_listing_promotions TO service_role;
ALTER TABLE public.mkt_listing_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_listing_promotions_read ON public.mkt_listing_promotions;
CREATE POLICY mkt_listing_promotions_read ON public.mkt_listing_promotions
  FOR SELECT TO authenticated USING (public.mkt_can_manage_listing(listing_id));

-- wallet resolution for a listing (business ad -> tenant wallet, else owner)
CREATE OR REPLACE FUNCTION public.mkt_wallet_for_listing(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; w uuid; a_type text; a_id uuid;
BEGIN
  SELECT owner_user_id, tenant_id INTO l FROM public.mkt_listings WHERE id = _id;
  IF l.owner_user_id IS NULL AND l.tenant_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF l.tenant_id IS NOT NULL THEN a_type := 'business'; a_id := l.tenant_id;
  ELSE a_type := 'user'; a_id := l.owner_user_id; END IF;
  SELECT id INTO w FROM public.mkt_point_wallets WHERE account_type = a_type AND account_id = a_id;
  IF w IS NULL THEN
    INSERT INTO public.mkt_point_wallets (account_type, account_id) VALUES (a_type, a_id)
    ON CONFLICT (account_type, account_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO w;
  END IF;
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.mkt_wallet_for_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_wallet_for_listing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_promotion_prices()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT value FROM public.mkt_platform_settings WHERE key = 'promotions.point_prices'),
                  '{}'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.mkt_promotion_prices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_promotion_prices() TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_listing_promotion_overview(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE w uuid; bal integer; a record; act record;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT owner_user_id, tenant_id INTO a FROM public.mkt_listings WHERE id = _id;
  SELECT id, balance_points INTO w, bal FROM public.mkt_point_wallets
   WHERE (a.tenant_id IS NOT NULL AND account_type = 'business' AND account_id = a.tenant_id)
      OR (a.tenant_id IS NULL AND account_type = 'user' AND account_id = a.owner_user_id);
  SELECT id, duration_days, points_spent, starts_at, ends_at INTO act
    FROM public.mkt_listing_promotions WHERE listing_id = _id AND status = 'active' LIMIT 1;
  RETURN jsonb_build_object(
    'wallet_id', w,
    'balance', coalesce(bal, 0),
    'prices', public.mkt_promotion_prices(),
    'active', CASE WHEN act.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', act.id, 'duration_days', act.duration_days, 'points_spent', act.points_spent,
      'starts_at', act.starts_at, 'ends_at', act.ends_at) END);
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_promotion_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_promotion_overview(uuid) TO authenticated;

-- atomic, idempotent promotion purchase
CREATE OR REPLACE FUNCTION public.mkt_listing_promote(_id uuid, _days integer, _op_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record; w record; price integer; prev integer; newbal integer;
  promo_id uuid; ends timestamptz; existing record;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _days IS NULL OR _days NOT IN (1,3,7,14,30) THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF coalesce(btrim(_op_id), '') = '' THEN RAISE EXCEPTION 'op_id_required'; END IF;

  SELECT id, status, expires_at, owner_user_id, tenant_id, title
    INTO l FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF l.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO w FROM public.mkt_point_wallets
   WHERE id = public.mkt_wallet_for_listing(_id) FOR UPDATE;

  -- idempotency: the same click twice never debits twice
  SELECT * INTO existing FROM public.mkt_point_ledger
   WHERE wallet_id = w.id AND op_id = _op_id LIMIT 1;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('status','duplicate','promotion_id', existing.promotion_id,
                              'points_spent', existing.points, 'balance', w.balance_points);
  END IF;

  IF l.status <> 'published' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  IF EXISTS (SELECT 1 FROM public.mkt_listing_promotions
              WHERE listing_id = _id AND status = 'active' AND ends_at > now()) THEN
    RAISE EXCEPTION 'already_promoted';
  END IF;

  price := (public.mkt_promotion_prices() ->> _days::text)::int;
  IF price IS NULL THEN RAISE EXCEPTION 'price_unavailable'; END IF;
  IF w.balance_points < price THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  prev := w.balance_points;
  newbal := prev - price;
  ends := now() + make_interval(days => _days);

  UPDATE public.mkt_point_wallets
     SET balance_points = newbal, lifetime_spent = lifetime_spent + price, updated_at = now()
   WHERE id = w.id;

  INSERT INTO public.mkt_listing_promotions
    (listing_id, wallet_id, duration_days, points_spent, ends_at, op_id, created_by)
  VALUES (_id, w.id, _days::smallint, price, ends, _op_id, auth.uid())
  RETURNING id INTO promo_id;

  INSERT INTO public.mkt_point_ledger
    (wallet_id, direction, points, balance_before, balance_after, kind, listing_id,
     promotion_id, op_id, actor_id, reason, meta)
  VALUES (w.id, 'debit', price, prev, newbal, 'spend', _id, promo_id, _op_id, auth.uid(),
          'listing_promotion',
          jsonb_build_object('duration_days', _days, 'starts_at', now(), 'ends_at', ends));

  PERFORM set_config('mkt.listing_op', 'owner_lifecycle', true);
  UPDATE public.mkt_listings
     SET is_featured = true, featured_from = now(), featured_until = ends,
         featured_package = 'points_' || _days::text, display_priority = 10,
         promoted_until = ends
   WHERE id = _id;
  PERFORM set_config('mkt.listing_op', '', true);

  PERFORM public.mkt_log_listing_event(_id, 'promotion_started', jsonb_build_object(
    'promotion_id', promo_id, 'duration_days', _days, 'points_spent', price,
    'balance_before', prev, 'balance_after', newbal, 'op_id', _op_id, 'ends_at', ends));

  RETURN jsonb_build_object('status','ok','promotion_id', promo_id, 'points_spent', price,
                            'balance_before', prev, 'balance', newbal, 'ends_at', ends);
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_promote(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_promote(uuid, integer, text) TO authenticated;

-- admin: grant points (no external payment gateway wired yet) and refunds
CREATE OR REPLACE FUNCTION public.mkt_admin_grant_points(
  _account_type text, _account_id uuid, _points integer, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; prev integer; newbal integer;
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _points IS NULL OR _points <= 0 THEN RAISE EXCEPTION 'invalid_points'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _account_type NOT IN ('user','business') THEN RAISE EXCEPTION 'invalid_account'; END IF;

  INSERT INTO public.mkt_point_wallets (account_type, account_id) VALUES (_account_type, _account_id)
  ON CONFLICT (account_type, account_id) DO UPDATE SET updated_at = now();
  SELECT * INTO w FROM public.mkt_point_wallets
   WHERE account_type = _account_type AND account_id = _account_id FOR UPDATE;

  prev := w.balance_points; newbal := prev + _points;
  UPDATE public.mkt_point_wallets
     SET balance_points = newbal, lifetime_granted = lifetime_granted + _points, updated_at = now()
   WHERE id = w.id;
  INSERT INTO public.mkt_point_ledger
    (wallet_id, direction, points, balance_before, balance_after, kind, actor_id, reason)
  VALUES (w.id, 'credit', _points, prev, newbal, 'grant', auth.uid(), _reason);
  PERFORM public.log_audit('mkt_point_wallet', 'grant', w.id,
    jsonb_build_object('balance', prev), jsonb_build_object('balance', newbal), _reason);
  RETURN jsonb_build_object('wallet_id', w.id, 'balance', newbal);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_grant_points(text, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_grant_points(text, uuid, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_admin_refund_promotion(_promotion_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; w record; prev integer; newbal integer;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO p FROM public.mkt_listing_promotions WHERE id = _promotion_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p.status = 'refunded' THEN RAISE EXCEPTION 'invalid_state'; END IF;

  SELECT * INTO w FROM public.mkt_point_wallets WHERE id = p.wallet_id FOR UPDATE;
  prev := w.balance_points; newbal := prev + p.points_spent;
  UPDATE public.mkt_point_wallets SET balance_points = newbal, updated_at = now() WHERE id = w.id;
  UPDATE public.mkt_listing_promotions
     SET status = 'refunded', ended_at = now(), updated_at = now() WHERE id = p.id;
  INSERT INTO public.mkt_point_ledger
    (wallet_id, direction, points, balance_before, balance_after, kind, listing_id,
     promotion_id, actor_id, reason)
  VALUES (w.id, 'credit', p.points_spent, prev, newbal, 'refund', p.listing_id, p.id, auth.uid(), _reason);

  PERFORM set_config('mkt.listing_op', 'owner_lifecycle', true);
  UPDATE public.mkt_listings
     SET is_featured = false, featured_until = NULL, featured_package = NULL,
         display_priority = 0, promoted_until = NULL
   WHERE id = p.listing_id;
  PERFORM set_config('mkt.listing_op', '', true);

  PERFORM public.mkt_log_listing_event(p.listing_id, 'promotion_refunded',
    jsonb_build_object('promotion_id', p.id, 'points', p.points_spent,
                       'balance_before', prev, 'balance_after', newbal));
  RETURN jsonb_build_object('wallet_id', w.id, 'balance', newbal);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_refund_promotion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_refund_promotion(uuid, text) TO authenticated, service_role;

-- 9) submit with moderation + 7-day organic publish ---------------------
CREATE OR REPLACE FUNCTION public.mkt_listing_submit(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text; _ready int; _bad int; _cover int; _scan jsonb; _dec text; _days int;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status INTO _st FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF _st IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st NOT IN ('draft','needs_changes','rejected','expired','archived') THEN RAISE EXCEPTION 'invalid_state'; END IF;

  SELECT count(*) FILTER (WHERE upload_status = 'ready'),
         count(*) FILTER (WHERE upload_status <> 'ready'),
         count(*) FILTER (WHERE is_cover)
    INTO _ready, _bad, _cover
    FROM public.mkt_listing_images WHERE listing_id = _id AND deleted_at IS NULL;

  IF _bad > 0 THEN RAISE EXCEPTION 'IMAGES_INCOMPLETE'; END IF;
  IF _ready > 20 THEN RAISE EXCEPTION 'IMAGES_TOO_MANY'; END IF;
  IF _ready = 0 AND public.mkt_listing_images_required(_id) THEN RAISE EXCEPTION 'IMAGE_REQUIRED'; END IF;
  IF _ready > 0 AND _cover <> 1 THEN
    UPDATE public.mkt_listing_images SET is_cover = false WHERE listing_id = _id AND is_cover;
    UPDATE public.mkt_listing_images SET is_cover = true
     WHERE id = (SELECT id FROM public.mkt_listing_images
                  WHERE listing_id = _id AND deleted_at IS NULL
                  ORDER BY sort_order, created_at LIMIT 1);
  END IF;

  _days := coalesce((SELECT (value->>'days')::int FROM public.mkt_platform_settings
                      WHERE key = 'listings.organic_duration_days'), 7);

  _scan := public.mkt_moderation_scan_listing(_id, 'submit');
  _dec := _scan->>'decision';

  IF _dec = 'clean' THEN
    PERFORM set_config('mkt.listing_op', 'auto_publish', true);
    PERFORM public.mkt_set_listing_status(_id, 'published', 'auto_publish_clean_scan');
    UPDATE public.mkt_listings
       SET rejection_reason = NULL, expiry_notice_stage = 0,
           duration_days = _days::smallint,
           expires_at = now() + make_interval(days => _days),
           paused_at = NULL
     WHERE id = _id;
    PERFORM set_config('mkt.listing_op', '', true);
    PERFORM public.mkt_log_listing_event(_id, 'published', jsonb_build_object(
      'duration_days', _days, 'auto', true, 'scan_id', _scan->>'scan_id'));
    PERFORM public.mkt_notify((SELECT owner_user_id FROM public.mkt_listings WHERE id = _id),
      NULL, 'listing_published', 'تم نشر إعلانك لمدة 7 أيام', NULL);
    RETURN 'published';
  END IF;

  PERFORM public.mkt_set_listing_status(_id, 'pending',
    CASE WHEN _dec = 'block' THEN 'moderation_blocked_suspected' ELSE 'moderation_review' END);
  UPDATE public.mkt_listings
     SET rejection_reason = NULL, expiry_notice_stage = 0, duration_days = _days::smallint
   WHERE id = _id;
  PERFORM public.mkt_log_listing_event(_id, 'submitted', jsonb_build_object(
    'duration_days', _days, 'images', _ready, 'decision', _dec, 'scan_id', _scan->>'scan_id'));
  PERFORM public.mkt_notify((SELECT owner_user_id FROM public.mkt_listings WHERE id = _id), NULL,
    CASE WHEN _dec = 'block' THEN 'listing_blocked_review' ELSE 'listing_needs_review' END,
    CASE WHEN _dec = 'block'
         THEN 'تعذر نشر الإعلان لأن محتواه قد يخالف سياسة المنصة، وسيتم مراجعته'
         ELSE 'يحتاج إعلانك إلى مراجعة قبل النشر' END, NULL);
  RETURN 'pending';
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_submit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_submit(uuid) TO authenticated;

-- 10) reactivation ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_listing_reactivate(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; _days int; _scan jsonb; _dec text; _cat_ok boolean;
BEGIN
  IF NOT public.mkt_can_manage_listing(_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO l FROM public.mkt_listings WHERE id = _id AND deleted_at IS NULL;
  IF l.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF l.status = 'suspended' THEN RAISE EXCEPTION 'admin_suspended'; END IF;
  IF l.status NOT IN ('expired','paused','published') THEN RAISE EXCEPTION 'invalid_state'; END IF;

  IF public.mkt_person_is_restricted(l.owner_user_id)
     OR (l.tenant_id IS NOT NULL AND public.mkt_business_is_restricted(l.tenant_id)) THEN
    RAISE EXCEPTION 'account_restricted';
  END IF;

  SELECT coalesce(c.is_active, true) INTO _cat_ok
    FROM public.mkt_categories c WHERE c.id = l.category_id;
  IF _cat_ok IS NOT NULL AND _cat_ok = false THEN RAISE EXCEPTION 'category_inactive'; END IF;

  _days := coalesce((SELECT (value->>'days')::int FROM public.mkt_platform_settings
                      WHERE key = 'listings.organic_duration_days'), 7);

  _scan := public.mkt_moderation_scan_listing(_id, 'reactivate');
  _dec := _scan->>'decision';

  IF _dec <> 'clean' THEN
    PERFORM public.mkt_set_listing_status(_id, 'pending',
      CASE WHEN _dec = 'block' THEN 'moderation_blocked_suspected' ELSE 'moderation_review' END);
    UPDATE public.mkt_listings SET expiry_notice_stage = 0, duration_days = _days::smallint WHERE id = _id;
    PERFORM public.mkt_log_listing_event(_id, 'reactivate_review', jsonb_build_object(
      'decision', _dec, 'scan_id', _scan->>'scan_id'));
    PERFORM public.mkt_notify(l.owner_user_id, NULL, 'listing_needs_review',
      CASE WHEN _dec = 'block'
           THEN 'تعذر نشر الإعلان لأن محتواه قد يخالف سياسة المنصة، وسيتم مراجعته'
           ELSE 'يحتاج إعلانك إلى مراجعة قبل النشر' END, NULL);
    RETURN 'pending';
  END IF;

  PERFORM set_config('mkt.listing_op', 'auto_publish', true);
  PERFORM public.mkt_set_listing_status(_id, 'published', 'reactivated');
  UPDATE public.mkt_listings
     SET duration_days = _days::smallint,
         expires_at = now() + make_interval(days => _days),
         last_renewed_at = now(), paused_at = NULL, expiry_notice_stage = 0
   WHERE id = _id;
  PERFORM set_config('mkt.listing_op', '', true);
  PERFORM public.mkt_log_listing_event(_id, 'reactivated', jsonb_build_object(
    'duration_days', _days, 'scan_id', _scan->>'scan_id'));
  RETURN 'published';
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_reactivate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_reactivate(uuid) TO authenticated;

-- legacy renew now always means "another 7 organic days", re-scanned
CREATE OR REPLACE FUNCTION public.mkt_listing_renew(_id uuid, _days integer DEFAULT 7)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.mkt_listing_reactivate(_id);
END $$;
REVOKE ALL ON FUNCTION public.mkt_listing_renew(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_listing_renew(uuid, integer) TO authenticated;

-- 11) sweep: expiry notices (24h / expiry / one reminder) + promotion end
CREATE OR REPLACE FUNCTION public.mkt_sweep_expired_listings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _expired integer := 0; _notified integer := 0; _promo integer := 0; r record; _stage smallint;
BEGIN
  -- a) end promotions whose paid window elapsed; the ad itself survives
  FOR r IN SELECT p.id, p.listing_id FROM public.mkt_listing_promotions p
            WHERE p.status = 'active' AND p.ends_at <= now() LOOP
    UPDATE public.mkt_listing_promotions
       SET status = 'ended', ended_at = now(), updated_at = now() WHERE id = r.id;
    PERFORM set_config('mkt.listing_op', 'owner_lifecycle', true);
    UPDATE public.mkt_listings
       SET is_featured = false, featured_until = NULL, featured_package = NULL,
           display_priority = 0, promoted_until = NULL
     WHERE id = r.listing_id;
    PERFORM set_config('mkt.listing_op', '', true);
    PERFORM public.mkt_log_listing_event(r.listing_id, 'promotion_ended',
      jsonb_build_object('promotion_id', r.id));
    _promo := _promo + 1;
  END LOOP;

  -- b) organic expiry
  FOR r IN SELECT id, owner_user_id, title FROM public.mkt_listings
            WHERE status = 'published' AND deleted_at IS NULL
              AND expires_at IS NOT NULL AND expires_at <= now() LOOP
    PERFORM public.mkt_set_listing_status(r.id, 'expired', 'auto_expiry');
    UPDATE public.mkt_listings SET expiry_notice_stage = 2 WHERE id = r.id;
    PERFORM public.mkt_notify(r.owner_user_id, NULL, 'listing_expired',
      'انتهت مدة إعلانك، يمكنك إعادة تنشيطه لمدة 7 أيام', r.title);
    PERFORM public.mkt_log_listing_event(r.id, 'expired', '{}'::jsonb);
    _expired := _expired + 1;
  END LOOP;

  -- c) one warning 24 hours before the end
  FOR r IN SELECT id, owner_user_id, title, expires_at FROM public.mkt_listings
            WHERE status = 'published' AND deleted_at IS NULL AND expires_at IS NOT NULL
              AND expires_at > now() AND expires_at - now() <= interval '24 hours'
              AND expiry_notice_stage < 1 LOOP
    PERFORM public.mkt_notify(r.owner_user_id, NULL, 'listing_expiring',
      'ينتهي إعلانك خلال 24 ساعة', r.title);
    UPDATE public.mkt_listings SET expiry_notice_stage = 1 WHERE id = r.id;
    _notified := _notified + 1;
  END LOOP;

  -- d) a single reminder two days after expiry
  FOR r IN SELECT id, owner_user_id, title FROM public.mkt_listings
            WHERE status = 'expired' AND deleted_at IS NULL AND expires_at IS NOT NULL
              AND expires_at <= now() - interval '2 days' AND expiry_notice_stage < 3 LOOP
    PERFORM public.mkt_notify(r.owner_user_id, NULL, 'listing_expired_reminder',
      'إعلانك ما زال منتهيًا — أعد تنشيطه لمدة 7 أيام', r.title);
    UPDATE public.mkt_listings SET expiry_notice_stage = 3 WHERE id = r.id;
    _notified := _notified + 1;
  END LOOP;

  RETURN jsonb_build_object('expired', _expired, 'notified', _notified, 'promotions_ended', _promo);
END $$;
REVOKE ALL ON FUNCTION public.mkt_sweep_expired_listings() FROM PUBLIC, anon, authenticated;

-- 12) admin moderation surface -----------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_listing_moderation(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; l record;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id, updated_at, moderation_state, moderation_score, last_scan_at, status
    INTO l FROM public.mkt_listings WHERE id = _id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.mkt_moderation_scans
   WHERE listing_id = _id ORDER BY scanned_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'state', l.moderation_state, 'score', l.moderation_score, 'status', l.status,
    'edited_after_scan', (s.id IS NOT NULL AND l.updated_at > s.scanned_at),
    'scan', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id, 'decision', s.decision, 'score', s.score, 'policy_version', s.policy_version,
      'signals', s.signals, 'scanned_at', s.scanned_at, 'trigger', s.trigger_source,
      'dismissed_at', s.dismissed_at, 'dismiss_reason', s.dismiss_reason) END,
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'decision', h.decision, 'score', h.score,
        'scanned_at', h.scanned_at, 'trigger', h.trigger_source) ORDER BY h.scanned_at DESC)
      FROM public.mkt_moderation_scans h WHERE h.listing_id = _id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_listing_moderation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_moderation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_rescan_listing(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  res := public.mkt_moderation_scan_listing(_id, 'admin_rescan');
  PERFORM public.log_audit('mkt_listing', 'rescan', _id, NULL, res, 'admin rescan');
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_rescan_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_rescan_listing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_scan_dismiss(_scan_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NOT public.mkt_is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO s FROM public.mkt_moderation_scans WHERE id = _scan_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.mkt_moderation_scans
     SET dismissed_at = now(), dismissed_by = auth.uid(), dismiss_reason = _reason
   WHERE id = _scan_id;
  UPDATE public.mkt_listings SET moderation_state = 'cleared' WHERE id = s.listing_id;
  PERFORM public.mkt_log_listing_event(s.listing_id, 'moderation_flag_dismissed',
    jsonb_build_object('scan_id', _scan_id));
  PERFORM public.log_audit('mkt_moderation_scan', 'dismiss', _scan_id, NULL, NULL, _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_scan_dismiss(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_scan_dismiss(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_moderation_rule_save(
  _id uuid, _kind text, _pattern text, _lang text, _category text,
  _severity text, _action text, _weight integer, _is_active boolean, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(btrim(_pattern),'') = '' THEN RAISE EXCEPTION 'pattern_required'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.mkt_moderation_rules
      (kind, pattern, lang, category, severity, action, weight, is_active, notes, created_by)
    VALUES (_kind, _pattern, _lang, _category, _severity, _action, _weight, coalesce(_is_active,true), _notes, auth.uid())
    RETURNING id INTO rid;
  ELSE
    UPDATE public.mkt_moderation_rules
       SET kind = _kind, pattern = _pattern, lang = _lang, category = _category,
           severity = _severity, action = _action, weight = _weight,
           is_active = coalesce(_is_active, true), notes = _notes
     WHERE id = _id RETURNING id INTO rid;
    IF rid IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;
  PERFORM public.log_audit('mkt_moderation_rule', CASE WHEN _id IS NULL THEN 'create' ELSE 'update' END,
    rid, NULL, jsonb_build_object('category', _category, 'action', _action, 'severity', _severity),
    'moderation rule change');
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_moderation_rule_save(uuid, text, text, text, text, text, text, integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_moderation_rule_save(uuid, text, text, text, text, text, text, integer, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_admin_moderation_rule_delete(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.mkt_is_system_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  DELETE FROM public.mkt_moderation_rules WHERE id = _id;
  PERFORM public.log_audit('mkt_moderation_rule', 'delete', _id, NULL, NULL, _reason);
END $$;
REVOKE ALL ON FUNCTION public.mkt_admin_moderation_rule_delete(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_admin_moderation_rule_delete(uuid, text) TO authenticated;

-- 13) align live data with the new organic policy -----------------------
UPDATE public.mkt_listings
   SET duration_days = 7
 WHERE status IN ('draft','pending','needs_changes') AND duration_days IS DISTINCT FROM 7;