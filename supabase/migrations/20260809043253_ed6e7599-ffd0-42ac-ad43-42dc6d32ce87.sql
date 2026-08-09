-- The guard is briefly disabled while it is being repaired: the previous version
-- wrote to `audit_log`, so creating the guard's own journal table would trip
-- that broken code path. It is re-enabled below, before the test runs.
ALTER EVENT TRIGGER structure_guard DISABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- The guard's own journal.
--
-- The first attempt logged into `audit_log`, but that table requires an active
-- tenant (`audit_log_tenant_autofill` raises `tenant_required`), so any DDL run
-- outside a user session — a migration — failed. The guard is infrastructure
-- and must never depend on tenant context: it keeps its own log.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE public.mkt_structure_guard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_identity text NOT NULL,
  command_tag text NOT NULL,
  outcome text NOT NULL,           -- 'allowed' | 'rejected'
  performed_by text NOT NULL,
  performed_by_uid uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_structure_guard_events TO authenticated;
GRANT ALL ON public.mkt_structure_guard_events TO service_role;
ALTER TABLE public.mkt_structure_guard_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read structure guard events"
  ON public.mkt_structure_guard_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()));

-- ── Event trigger, without the tenant-bound audit write ────────────────────
CREATE OR REPLACE FUNCTION public.structure_guard_ddl()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cmd record;
  table_name text;
BEGIN
  IF NOT public.structure_guard_is_enabled() THEN
    RETURN;
  END IF;

  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF cmd.command_tag = 'CREATE SCHEMA' THEN
      RAISE WARNING '[STRUCTURE_GUARD] rejected CREATE SCHEMA % by %',
        cmd.object_identity, current_user;
      RAISE EXCEPTION
        'حارس البنية: إنشاء مخطط (schema) جديد غير مسموح — كل شيء يعيش في public. / Structure guard: creating a new schema is not allowed.'
        USING HINT = 'راجع docs/ARCHITECTURE_RULES.md ثم استخدم public.structure_guard_disable(reason, minutes) بحساب مسؤول المنصة عند وجود حاجة مشروعة.';
    END IF;

    IF cmd.command_tag = 'CREATE TABLE' AND cmd.schema_name = 'public' THEN
      table_name := split_part(cmd.object_identity, '.', 2);

      IF NOT public.structure_guard_allows_table(table_name) THEN
        -- Durable evidence: a rejected statement aborts its transaction, so any
        -- row written here would be rolled back with it. The database log keeps
        -- this line; `structure_guard_log_rejection()` records the follow-up.
        RAISE WARNING '[STRUCTURE_GUARD] rejected CREATE TABLE % by %',
          cmd.object_identity, current_user;
        RAISE EXCEPTION
          'حارس البنية: اسم الجدول "%" مرفوض. كل جدول جديد في public يجب أن يبدأ بالبادئة mkt_ . / Structure guard: every new public table must be prefixed with mkt_.',
          table_name
          USING HINT = 'أعد التسمية إلى mkt_' || table_name || ' — أو، لحاجة مشروعة، اقرأ docs/ARCHITECTURE_RULES.md واستخدم public.structure_guard_disable(reason, minutes) بحساب مسؤول المنصة، ثم public.structure_guard_enable() بعد الانتهاء.';
      END IF;

      INSERT INTO public.mkt_structure_guard_events
        (object_identity, command_tag, outcome, performed_by, reason)
      VALUES (cmd.object_identity, cmd.command_tag, 'allowed', current_user,
              'name follows the mkt_ convention');
    END IF;
  END LOOP;
END;
$$;

-- ── Rejection follow-up log (own transaction, so it survives) ──────────────
DROP FUNCTION IF EXISTS public.structure_guard_flush_rejections();

CREATE OR REPLACE FUNCTION public.structure_guard_log_rejection(
  _object text, _command text, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'حارس البنية: التسجيل متاح لمسؤول المنصة فقط. / Structure guard: platform admins only.';
  END IF;

  INSERT INTO public.mkt_structure_guard_rejections
    (object_identity, command_tag, attempted_by, attempted_by_uid)
  VALUES (_object, _command, current_user, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.mkt_structure_guard_events
    (object_identity, command_tag, outcome, performed_by, performed_by_uid, reason)
  VALUES (_object, _command, 'rejected', current_user, auth.uid(),
          COALESCE(_reason, 'structure guard: rejected DDL'));

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.structure_guard_log_rejection(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.structure_guard_log_rejection(text, text, text)
  TO authenticated, service_role;

-- The disable/enable audit writes had the same tenant dependency.
CREATE OR REPLACE FUNCTION public.structure_guard_disable(_reason text, _minutes integer DEFAULT 60)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  until timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'حارس البنية: تعطيل الحارس متاح لمسؤول المنصة فقط. / Structure guard: platform admins only.';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 10 THEN
    RAISE EXCEPTION 'حارس البنية: يجب كتابة سبب واضح للتعطيل. / Structure guard: a written reason is required.';
  END IF;

  until := now() + make_interval(mins => greatest(1, least(_minutes, 240)));

  UPDATE public.mkt_structure_guard
     SET enabled = false, disabled_reason = btrim(_reason), disabled_by = auth.uid(),
         disabled_at = now(), disabled_until = until, updated_at = now()
   WHERE id;

  INSERT INTO public.mkt_structure_guard_events
    (object_identity, command_tag, outcome, performed_by, performed_by_uid, reason)
  VALUES ('public.mkt_structure_guard', 'GUARD DISABLED', 'allowed',
          current_user, auth.uid(), btrim(_reason) || ' — until ' || until::text);

  RETURN until;
END;
$$;

CREATE OR REPLACE FUNCTION public.structure_guard_enable()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'حارس البنية: إعادة التفعيل متاحة لمسؤول المنصة فقط. / Structure guard: platform admins only.';
  END IF;

  UPDATE public.mkt_structure_guard
     SET enabled = true, disabled_reason = NULL, disabled_by = NULL,
         disabled_at = NULL, disabled_until = NULL, updated_at = now()
   WHERE id;

  INSERT INTO public.mkt_structure_guard_events
    (object_identity, command_tag, outcome, performed_by, performed_by_uid, reason)
  VALUES ('public.mkt_structure_guard', 'GUARD ENABLED', 'allowed',
          current_user, auth.uid(), 'structure guard re-enabled');
END;
$$;

-- ── Prove it, in this same migration ───────────────────────────────────────
ALTER EVENT TRIGGER structure_guard ENABLE;

DO $$
DECLARE
  err text;
BEGIN
  CREATE TABLE public.mkt_test_guard (id integer);
  RAISE NOTICE '[STRUCTURE_GUARD TEST] mkt_test_guard accepted';
  DROP TABLE public.mkt_test_guard;

  BEGIN
    CREATE TABLE public.bad_guard_test (id integer);
    RAISE EXCEPTION '[STRUCTURE_GUARD TEST] FAILED: bad_guard_test was allowed';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      err := SQLERRM;
      IF err LIKE '%FAILED%' THEN
        RAISE;
      END IF;
      RAISE NOTICE '[STRUCTURE_GUARD TEST] bad_guard_test rejected as expected';
  END;
END;
$$;

DROP TABLE IF EXISTS public.bad_guard_test;
DROP TABLE IF EXISTS public.mkt_test_guard;
