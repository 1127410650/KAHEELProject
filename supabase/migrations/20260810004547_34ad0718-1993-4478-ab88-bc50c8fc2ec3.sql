-- ═══════════════════════════════════════════════════════════════════
-- Student assistant bot: conversations, usage metering, plans.
-- Every limit lives here (server side); the browser only renders answers.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.mkt_student_bot_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('monthly','season')),
  price_credits integer NOT NULL DEFAULT 0 CHECK (price_credits >= 0),
  daily_limit integer NOT NULL DEFAULT 50 CHECK (daily_limit > 0 AND daily_limit <= 500),
  duration_days integer CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 400),
  season_ends_at timestamptz,
  perks jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_student_bot_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_student_bot_plans TO authenticated;
GRANT ALL ON public.mkt_student_bot_plans TO service_role;
ALTER TABLE public.mkt_student_bot_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_bot_plans_public_read" ON public.mkt_student_bot_plans
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "student_bot_plans_admin_read" ON public.mkt_student_bot_plans
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());
CREATE POLICY "student_bot_plans_admin_write" ON public.mkt_student_bot_plans
  FOR INSERT TO authenticated WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY "student_bot_plans_admin_update" ON public.mkt_student_bot_plans
  FOR UPDATE TO authenticated USING (public.mkt_is_platform_admin())
  WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY "student_bot_plans_admin_delete" ON public.mkt_student_bot_plans
  FOR DELETE TO authenticated USING (public.mkt_is_platform_admin());

CREATE TABLE public.mkt_student_bot_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  grade text NOT NULL CHECK (grade IN ('grade9','bac_sci','bac_lit')),
  subject text NOT NULL,
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  summary text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','full','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_student_bot_conv_user_idx
  ON public.mkt_student_bot_conversations (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_student_bot_conversations TO authenticated;
GRANT ALL ON public.mkt_student_bot_conversations TO service_role;
ALTER TABLE public.mkt_student_bot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_bot_conv_own" ON public.mkt_student_bot_conversations
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "student_bot_conv_admin_read" ON public.mkt_student_bot_conversations
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

CREATE TABLE public.mkt_student_bot_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.mkt_student_bot_conversations(id) ON DELETE SET NULL,
  grade text,
  subject text,
  question_text text,
  ip_hash text,
  had_image boolean NOT NULL DEFAULT false,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(10,5) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed','answered','failed','not_configured')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX mkt_student_bot_usage_user_idx ON public.mkt_student_bot_usage (user_id, created_at DESC);
CREATE INDEX mkt_student_bot_usage_month_idx ON public.mkt_student_bot_usage (created_at DESC);
CREATE INDEX mkt_student_bot_usage_ip_idx ON public.mkt_student_bot_usage (ip_hash, created_at DESC);
GRANT SELECT ON public.mkt_student_bot_usage TO authenticated;
GRANT ALL ON public.mkt_student_bot_usage TO service_role;
ALTER TABLE public.mkt_student_bot_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_bot_usage_own_read" ON public.mkt_student_bot_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "student_bot_usage_admin_read" ON public.mkt_student_bot_usage
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

CREATE TABLE public.mkt_student_bot_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.mkt_student_bot_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  daily_limit integer NOT NULL DEFAULT 50,
  price_credits integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_student_bot_subs_user_idx
  ON public.mkt_student_bot_subscriptions (user_id, ends_at DESC);
GRANT SELECT ON public.mkt_student_bot_subscriptions TO authenticated;
GRANT ALL ON public.mkt_student_bot_subscriptions TO service_role;
ALTER TABLE public.mkt_student_bot_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_bot_subs_own_read" ON public.mkt_student_bot_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "student_bot_subs_admin_read" ON public.mkt_student_bot_subscriptions
  FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());

-- updated_at
CREATE OR REPLACE FUNCTION public.mkt_student_bot_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER mkt_student_bot_plans_touch BEFORE UPDATE ON public.mkt_student_bot_plans
  FOR EACH ROW EXECUTE FUNCTION public.mkt_student_bot_touch();
CREATE TRIGGER mkt_student_bot_conv_touch BEFORE UPDATE ON public.mkt_student_bot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.mkt_student_bot_touch();
CREATE TRIGGER mkt_student_bot_subs_touch BEFORE UPDATE ON public.mkt_student_bot_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.mkt_student_bot_touch();

-- ── Settings (admin editable) ────────────────────────────────────────
INSERT INTO public.mkt_platform_settings (key, section, value, description_ar) VALUES
  ('student_bot.enabled', 'student_bot', '{"enabled": true}'::jsonb,
   'تفعيل مساعد الطالب (يبقى «قيد التجهيز» حتى إضافة مفتاح المزوّد)'),
  ('student_bot.monthly_cap_usd', 'student_bot', '{"value": 100}'::jsonb,
   'سقف الإنفاق الشهري لمساعد الطالب بالدولار — يتوقف المساعد تلقائيًا عند بلوغه'),
  ('student_bot.free_daily', 'student_bot', '{"value": 5}'::jsonb,
   'عدد الأسئلة المجانية اليومية لكل طالب'),
  ('student_bot.ip_daily', 'student_bot', '{"value": 12}'::jsonb,
   'الحد اليومي للأسئلة لكل عنوان شبكة (منع التحايل بحسابات متعددة)'),
  ('student_bot.conversation_max', 'student_bot', '{"value": 6}'::jsonb,
   'عدد الرسائل في المحادثة الواحدة قبل فتح محادثة جديدة بتلخيص السياق')
ON CONFLICT (key) DO NOTHING;

-- ── Seed plans with NO price (admin sets it from the console) ─────────
INSERT INTO public.mkt_student_bot_plans
  (code, name_ar, name_en, kind, price_credits, daily_limit, duration_days, sort_order)
VALUES
  ('monthly', 'الباقة الشهرية', 'Monthly plan', 'monthly', 0, 50, 30, 1),
  ('season', 'باقة الموسم', 'Exam season plan', 'season', 0, 50, NULL, 2)
ON CONFLICT (code) DO NOTHING;

-- ── Helpers ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_student_bot_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key='student_bot.enabled'), true),
    'monthly_cap_usd', COALESCE((SELECT (value->>'value')::numeric FROM public.mkt_platform_settings WHERE key='student_bot.monthly_cap_usd'), 100),
    'free_daily', COALESCE((SELECT (value->>'value')::integer FROM public.mkt_platform_settings WHERE key='student_bot.free_daily'), 5),
    'ip_daily', COALESCE((SELECT (value->>'value')::integer FROM public.mkt_platform_settings WHERE key='student_bot.ip_daily'), 12),
    'conversation_max', COALESCE((SELECT (value->>'value')::integer FROM public.mkt_platform_settings WHERE key='student_bot.conversation_max'), 6)
  );
$$;

CREATE OR REPLACE FUNCTION public.mkt_student_bot_month_spend()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(cost_usd), 0)::numeric
  FROM public.mkt_student_bot_usage
  WHERE created_at >= date_trunc('month', now());
$$;

/** Effective daily allowance of the signed-in student (free tier or plan). */
CREATE OR REPLACE FUNCTION public.mkt_student_bot_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _cfg jsonb := public.mkt_student_bot_config();
  _limit integer;
  _used integer := 0;
  _sub record;
  _spend numeric := public.mkt_student_bot_month_spend();
BEGIN
  _limit := (_cfg->>'free_daily')::integer;

  IF _uid IS NOT NULL THEN
    SELECT s.*, p.code AS plan_code, p.name_ar AS plan_name_ar, p.name_en AS plan_name_en
      INTO _sub
      FROM public.mkt_student_bot_subscriptions s
      JOIN public.mkt_student_bot_plans p ON p.id = s.plan_id
     WHERE s.user_id = _uid AND s.status = 'active' AND s.ends_at > now()
     ORDER BY s.ends_at DESC LIMIT 1;
    IF _sub.id IS NOT NULL THEN
      _limit := GREATEST(_limit, _sub.daily_limit);
    END IF;

    SELECT count(*) INTO _used
      FROM public.mkt_student_bot_usage
     WHERE user_id = _uid
       AND created_at >= date_trunc('day', now())
       AND status <> 'failed';
  END IF;

  RETURN jsonb_build_object(
    'enabled', (_cfg->>'enabled')::boolean,
    'signed_in', _uid IS NOT NULL,
    'free_daily', (_cfg->>'free_daily')::integer,
    'daily_limit', _limit,
    'used_today', _used,
    'remaining', GREATEST(_limit - _used, 0),
    'conversation_max', (_cfg->>'conversation_max')::integer,
    'monthly_cap_usd', (_cfg->>'monthly_cap_usd')::numeric,
    'month_spend_usd', round(_spend, 4),
    'budget_reached', _spend >= (_cfg->>'monthly_cap_usd')::numeric,
    'plan', CASE WHEN _sub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'code', _sub.plan_code, 'name_ar', _sub.plan_name_ar, 'name_en', _sub.plan_name_en,
      'daily_limit', _sub.daily_limit, 'ends_at', _sub.ends_at) END
  );
END; $$;

/** Reserves one question. Raises on every refusal so nothing can be bypassed. */
CREATE OR REPLACE FUNCTION public.mkt_student_bot_claim(
  _grade text, _subject text, _conversation_id uuid DEFAULT NULL,
  _ip_hash text DEFAULT NULL, _has_image boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _cfg jsonb := public.mkt_student_bot_config();
  _state jsonb;
  _max integer := (_cfg->>'conversation_max')::integer;
  _ip_used integer := 0;
  _conv public.mkt_student_bot_conversations;
  _prev public.mkt_student_bot_conversations;
  _usage uuid;
  _summary text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _grade NOT IN ('grade9','bac_sci','bac_lit') THEN RAISE EXCEPTION 'invalid_grade'; END IF;
  IF _subject IS NULL OR length(btrim(_subject)) = 0 THEN RAISE EXCEPTION 'invalid_subject'; END IF;

  _state := public.mkt_student_bot_state();
  IF (_state->>'enabled')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'bot_disabled'; END IF;
  IF (_state->>'budget_reached')::boolean THEN RAISE EXCEPTION 'monthly_cap_reached'; END IF;
  IF (_state->>'remaining')::integer <= 0 THEN RAISE EXCEPTION 'daily_limit_reached'; END IF;

  IF _ip_hash IS NOT NULL THEN
    SELECT count(*) INTO _ip_used FROM public.mkt_student_bot_usage
     WHERE ip_hash = _ip_hash AND created_at >= date_trunc('day', now()) AND status <> 'failed';
    IF _ip_used >= (_cfg->>'ip_daily')::integer THEN RAISE EXCEPTION 'ip_limit_reached'; END IF;
  END IF;

  IF _conversation_id IS NOT NULL THEN
    SELECT * INTO _conv FROM public.mkt_student_bot_conversations
     WHERE id = _conversation_id AND user_id = _uid;
    IF _conv.id IS NULL THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
    IF _conv.message_count >= _max OR _conv.status <> 'open' THEN
      _prev := _conv; _conv := NULL;
    END IF;
  END IF;

  IF _conv.id IS NULL THEN
    _summary := _prev.summary;
    IF _prev.id IS NOT NULL THEN
      -- Carry a compact context instead of resending the whole thread.
      _summary := left(COALESCE(_prev.summary || ' | ', '') || COALESCE(
        (SELECT string_agg(m->>'text', ' | ')
           FROM jsonb_array_elements(_prev.messages) m
          WHERE m->>'role' = 'user'), ''), 1200);
      UPDATE public.mkt_student_bot_conversations
         SET status = 'full', summary = _summary WHERE id = _prev.id;
    END IF;
    INSERT INTO public.mkt_student_bot_conversations (user_id, grade, subject, summary)
    VALUES (_uid, _grade, btrim(_subject), _summary)
    RETURNING * INTO _conv;
  END IF;

  INSERT INTO public.mkt_student_bot_usage
    (user_id, conversation_id, grade, subject, ip_hash, had_image)
  VALUES (_uid, _conv.id, _grade, btrim(_subject), left(_ip_hash, 64), COALESCE(_has_image, false))
  RETURNING id INTO _usage;

  RETURN jsonb_build_object(
    'usage_id', _usage,
    'conversation_id', _conv.id,
    'messages', _conv.messages,
    'summary', _conv.summary,
    'message_count', _conv.message_count,
    'conversation_max', _max,
    'remaining', GREATEST((_state->>'remaining')::integer - 1, 0),
    'daily_limit', (_state->>'daily_limit')::integer
  );
END; $$;

/** Notifies every platform admin once per month per budget threshold. */
CREATE OR REPLACE FUNCTION public.mkt_student_bot_budget_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cfg jsonb := public.mkt_student_bot_config();
  _cap numeric := (_cfg->>'monthly_cap_usd')::numeric;
  _spend numeric := public.mkt_student_bot_month_spend();
  _pct integer;
  _tag text;
  _admin record;
BEGIN
  IF _cap IS NULL OR _cap <= 0 THEN RETURN; END IF;
  _pct := CASE WHEN _spend >= _cap THEN 100
               WHEN _spend >= _cap * 0.8 THEN 80
               WHEN _spend >= _cap * 0.5 THEN 50 ELSE 0 END;
  IF _pct = 0 THEN RETURN; END IF;
  _tag := 'student_bot_budget_' || _pct || '_' || to_char(now(), 'YYYY-MM');

  FOR _admin IN SELECT user_id FROM public.mkt_platform_admins LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.mkt_notifications
       WHERE user_id = _admin.user_id AND event = 'student_bot_budget' AND qa_batch_id = _tag
    ) THEN
      INSERT INTO public.mkt_notifications (user_id, event, title, body, qa_batch_id)
      VALUES (_admin.user_id, 'student_bot_budget',
        'مساعد الطالب: بلغ ' || _pct || '٪ من سقف الإنفاق',
        'الاستهلاك هذا الشهر ' || round(_spend, 2) || ' دولار من سقف ' || round(_cap, 2) || ' دولار.',
        _tag);
    END IF;
  END LOOP;
END; $$;

/** Closes a reserved question: records cost and stores ONLY the texts. */
CREATE OR REPLACE FUNCTION public.mkt_student_bot_finish(
  _usage_id uuid, _status text, _question text DEFAULT NULL, _answer text DEFAULT NULL,
  _input_tokens integer DEFAULT 0, _output_tokens integer DEFAULT 0,
  _cost_usd numeric DEFAULT 0, _model text DEFAULT NULL, _detail text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.mkt_student_bot_usage;
  _max integer := (public.mkt_student_bot_config()->>'conversation_max')::integer;
  _count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _status NOT IN ('answered','failed','not_configured') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  SELECT * INTO _row FROM public.mkt_student_bot_usage WHERE id = _usage_id AND user_id = _uid;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'usage_not_found'; END IF;

  UPDATE public.mkt_student_bot_usage
     SET status = _status,
         question_text = left(COALESCE(_question, question_text), 2000),
         input_tokens = GREATEST(COALESCE(_input_tokens, 0), 0),
         output_tokens = GREATEST(COALESCE(_output_tokens, 0), 0),
         cost_usd = GREATEST(COALESCE(_cost_usd, 0), 0),
         model = COALESCE(_model, model),
         detail = left(_detail, 500),
         finished_at = now()
   WHERE id = _usage_id;

  IF _status = 'answered' AND _row.conversation_id IS NOT NULL THEN
    UPDATE public.mkt_student_bot_conversations
       SET messages = messages
             || jsonb_build_object('role','user','text', left(COALESCE(_question,''), 2000),
                                   'at', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'))
             || jsonb_build_object('role','assistant','text', left(COALESCE(_answer,''), 8000),
                                   'at', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF')),
           message_count = message_count + 1,
           title = COALESCE(title, left(COALESCE(_question,''), 80))
     WHERE id = _row.conversation_id
    RETURNING message_count INTO _count;

    IF _count >= _max THEN
      UPDATE public.mkt_student_bot_conversations SET status = 'full'
       WHERE id = _row.conversation_id;
    END IF;
  END IF;

  PERFORM public.mkt_student_bot_budget_alerts();
  RETURN public.mkt_student_bot_state();
END; $$;

/** Buys a plan with the existing ad-credit wallet balance. */
CREATE OR REPLACE FUNCTION public.mkt_student_bot_subscribe(_plan_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.mkt_student_bot_plans;
  _ends timestamptz;
  _sub uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO _plan FROM public.mkt_student_bot_plans WHERE id = _plan_id AND is_active;
  IF _plan.id IS NULL THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF _plan.price_credits <= 0 THEN RAISE EXCEPTION 'price_not_set'; END IF;

  IF _plan.kind = 'season' THEN
    IF _plan.season_ends_at IS NULL OR _plan.season_ends_at <= now() THEN
      RAISE EXCEPTION 'season_not_open';
    END IF;
    _ends := _plan.season_ends_at;
  ELSE
    _ends := now() + make_interval(days => COALESCE(_plan.duration_days, 30));
  END IF;

  PERFORM public.mkt_ad_credit_consume(_plan.price_credits, 'student_bot_plan', _plan.id, NULL);

  INSERT INTO public.mkt_student_bot_subscriptions
    (user_id, plan_id, daily_limit, price_credits, ends_at)
  VALUES (_uid, _plan.id, _plan.daily_limit, _plan.price_credits, _ends)
  RETURNING id INTO _sub;

  RETURN jsonb_build_object('subscription_id', _sub, 'ends_at', _ends);
END; $$;

/** Admin analytics: spend, volume, subjects, repeated questions. */
CREATE OR REPLACE FUNCTION public.mkt_student_bot_admin_stats(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cfg jsonb := public.mkt_student_bot_config();
  _from timestamptz := date_trunc('day', now()) - make_interval(days => GREATEST(LEAST(COALESCE(_days,30),120),1) - 1);
BEGIN
  IF auth.uid() IS NULL OR NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN jsonb_build_object(
    'enabled', (_cfg->>'enabled')::boolean,
    'monthly_cap_usd', (_cfg->>'monthly_cap_usd')::numeric,
    'free_daily', (_cfg->>'free_daily')::integer,
    'ip_daily', (_cfg->>'ip_daily')::integer,
    'conversation_max', (_cfg->>'conversation_max')::integer,
    'month_spend_usd', round(public.mkt_student_bot_month_spend(), 4),
    'month_questions', (SELECT count(*) FROM public.mkt_student_bot_usage
                         WHERE created_at >= date_trunc('month', now()) AND status = 'answered'),
    'today_spend_usd', (SELECT round(COALESCE(sum(cost_usd),0), 4) FROM public.mkt_student_bot_usage
                         WHERE created_at >= date_trunc('day', now())),
    'today_questions', (SELECT count(*) FROM public.mkt_student_bot_usage
                         WHERE created_at >= date_trunc('day', now()) AND status = 'answered'),
    'students', (SELECT count(DISTINCT user_id) FROM public.mkt_student_bot_usage
                  WHERE created_at >= date_trunc('month', now())),
    'subscriptions', (SELECT count(*) FROM public.mkt_student_bot_subscriptions
                       WHERE status = 'active' AND ends_at > now()),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'usd', d.usd, 'questions', d.questions)
                       ORDER BY d.day)
      FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               round(sum(cost_usd), 4) AS usd,
               count(*) FILTER (WHERE status = 'answered') AS questions
        FROM public.mkt_student_bot_usage WHERE created_at >= _from
        GROUP BY 1
      ) d), '[]'::jsonb),
    'monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m.month, 'usd', m.usd, 'questions', m.questions)
                       ORDER BY m.month)
      FROM (
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               round(sum(cost_usd), 4) AS usd,
               count(*) FILTER (WHERE status = 'answered') AS questions
        FROM public.mkt_student_bot_usage
        WHERE created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
      ) m), '[]'::jsonb),
    'subjects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('subject', s.subject, 'grade', s.grade, 'count', s.n)
                       ORDER BY s.n DESC)
      FROM (
        SELECT subject, grade, count(*) AS n FROM public.mkt_student_bot_usage
        WHERE created_at >= _from AND subject IS NOT NULL
        GROUP BY 1, 2 ORDER BY n DESC LIMIT 15
      ) s), '[]'::jsonb),
    'top_questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('question', q.q, 'count', q.n) ORDER BY q.n DESC)
      FROM (
        SELECT lower(left(btrim(question_text), 120)) AS q, count(*) AS n
        FROM public.mkt_student_bot_usage
        WHERE question_text IS NOT NULL AND length(btrim(question_text)) > 8
          AND created_at >= _from
        GROUP BY 1 HAVING count(*) > 1 ORDER BY n DESC LIMIT 20
      ) q), '[]'::jsonb)
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_config() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_month_spend() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_budget_alerts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_claim(text, text, uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_finish(uuid, text, text, text, integer, integer, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_subscribe(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mkt_student_bot_admin_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_student_bot_state() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_student_bot_claim(text, text, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_student_bot_finish(uuid, text, text, text, integer, integer, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_student_bot_subscribe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_student_bot_admin_stats(integer) TO authenticated;