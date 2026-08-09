-- ═══════════════════════════════════════════════════════════════════════════
-- STRUCTURE GUARD (database half)
--
-- Goal: the schema stops growing by accident. Every new public table must be
-- named `mkt_*` so it is obvious which product it belongs to; the handful of
-- pre-existing platform tables keep their historical names forever.
--
-- Nothing existing is touched: the guard is an event trigger that only sees
-- statements executed AFTER this migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Guard state (the documented off switch) ─────────────────────────────
CREATE TABLE public.mkt_structure_guard (
  id boolean PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  disabled_reason text,
  disabled_by uuid,
  disabled_at timestamptz,
  disabled_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_structure_guard_single_row CHECK (id)
);

GRANT SELECT ON public.mkt_structure_guard TO authenticated;
GRANT ALL ON public.mkt_structure_guard TO service_role;
ALTER TABLE public.mkt_structure_guard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read structure guard state"
  ON public.mkt_structure_guard FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()));

INSERT INTO public.mkt_structure_guard (id, enabled) VALUES (true, true);

-- ── 2. Rejection log ───────────────────────────────────────────────────────
-- A rejected CREATE TABLE aborts its transaction, so a row inserted from
-- inside the event trigger would be rolled back with it. The rejection is
-- therefore recorded from a fresh autonomous transaction that pg_cron runs a
-- moment later (see `structure_guard_flush_rejections`), seeded by a
-- transaction-local queue that survives the rollback because it lives in
-- session memory, not in a table.
CREATE TABLE public.mkt_structure_guard_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_identity text NOT NULL,
  command_tag text NOT NULL,
  attempted_by text NOT NULL,
  attempted_by_uid uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mkt_structure_guard_rejections TO authenticated;
GRANT ALL ON public.mkt_structure_guard_rejections TO service_role;
ALTER TABLE public.mkt_structure_guard_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read structure guard rejections"
  ON public.mkt_structure_guard_rejections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid()));

-- ── 3. The naming rule, in one place ───────────────────────────────────────
-- Grandfathered platform tables: the internal core that predates the `mkt_`
-- convention. This list is closed — it must never grow.
CREATE OR REPLACE FUNCTION public.structure_guard_allows_table(_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _name LIKE 'mkt\_%'
      OR _name = ANY (ARRAY[
        'profiles', 'tenants', 'tenant_memberships', 'tenant_invitations',
        'user_roles', 'user_permissions', 'audit_log', 'login_attempts',
        'rate_events'
      ]);
$$;

-- Is the guard on right now? A timed disable expires on its own, so a
-- forgotten `structure_guard_disable` cannot leave the schema unguarded.
CREATE OR REPLACE FUNCTION public.structure_guard_is_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled OR (disabled_until IS NOT NULL AND disabled_until < now())
       FROM public.mkt_structure_guard WHERE id),
    true);
$$;

-- ── 4. The event trigger ───────────────────────────────────────────────────
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
    -- New schemas are an architecture decision, not a routine change.
    IF cmd.command_tag = 'CREATE SCHEMA' THEN
      PERFORM set_config(
        'mkt.structure_guard_rejection',
        cmd.object_identity || '|CREATE SCHEMA', false);
      RAISE WARNING '[STRUCTURE_GUARD] rejected CREATE SCHEMA %', cmd.object_identity;
      RAISE EXCEPTION
        'حارس البنية: إنشاء مخطط (schema) جديد غير مسموح — كل شيء يعيش في public. / Structure guard: creating a new schema is not allowed.'
        USING HINT = 'راجع docs/ARCHITECTURE_RULES.md ثم استخدم public.structure_guard_disable(reason, minutes) بحساب مسؤول المنصة عند وجود حاجة مشروعة.';
    END IF;

    IF cmd.command_tag = 'CREATE TABLE' AND cmd.schema_name = 'public' THEN
      table_name := split_part(cmd.object_identity, '.', 2);

      IF NOT public.structure_guard_allows_table(table_name) THEN
        PERFORM set_config(
          'mkt.structure_guard_rejection',
          cmd.object_identity || '|CREATE TABLE', false);
        RAISE WARNING '[STRUCTURE_GUARD] rejected CREATE TABLE % by %',
          cmd.object_identity, current_user;
        RAISE EXCEPTION
          'حارس البنية: اسم الجدول "%" مرفوض. كل جدول جديد في public يجب أن يبدأ بالبادئة mkt_ . / Structure guard: every new public table must be prefixed with mkt_.',
          table_name
          USING HINT = 'أعد التسمية إلى mkt_' || table_name || ' — أو، لحاجة مشروعة، اقرأ docs/ARCHITECTURE_RULES.md واستخدم public.structure_guard_disable(reason, minutes) بحساب مسؤول المنصة ثم public.structure_guard_enable().';
      END IF;

      -- Compliant growth is recorded, so the schema never grows unnoticed.
      INSERT INTO public.audit_log (entity_type, entity_id, action, new_value, reason)
      VALUES ('structure_guard', NULL, 'table_created',
              jsonb_build_object('table', cmd.object_identity, 'by', current_user),
              'structure guard: allowed new table');
    END IF;
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER structure_guard
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE SCHEMA')
  EXECUTE FUNCTION public.structure_guard_ddl();

-- ── 5. Rejection flush (autonomous, so it survives the aborted DDL) ────────
-- The queue value set by the trigger stays in the session's `mkt.*` settings
-- after the rollback; this runs in its own transaction and drains it.
CREATE OR REPLACE FUNCTION public.structure_guard_flush_rejections()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued text := current_setting('mkt.structure_guard_rejection', true);
BEGIN
  IF queued IS NULL OR queued = '' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.mkt_structure_guard_rejections
    (object_identity, command_tag, attempted_by, attempted_by_uid)
  VALUES (split_part(queued, '|', 1), split_part(queued, '|', 2),
          current_user, auth.uid());

  INSERT INTO public.audit_log (entity_type, entity_id, action, new_value, reason)
  VALUES ('structure_guard', NULL, 'rejected',
          jsonb_build_object('object', split_part(queued, '|', 1),
                             'command', split_part(queued, '|', 2),
                             'by', current_user),
          'structure guard: rejected DDL');

  PERFORM set_config('mkt.structure_guard_rejection', '', false);
  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.structure_guard_flush_rejections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.structure_guard_flush_rejections() TO service_role;

-- ── 6. Documented exception mechanism (project owner only) ─────────────────
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

  INSERT INTO public.audit_log (actor_id, entity_type, action, new_value, reason)
  VALUES (auth.uid(), 'structure_guard', 'disabled',
          jsonb_build_object('until', until), btrim(_reason));

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

  INSERT INTO public.audit_log (actor_id, entity_type, action, reason)
  VALUES (auth.uid(), 'structure_guard', 'enabled', 'structure guard re-enabled');
END;
$$;

REVOKE ALL ON FUNCTION public.structure_guard_disable(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.structure_guard_enable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.structure_guard_disable(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.structure_guard_enable() TO authenticated;

-- ── 7. Storage bucket rule, enforced in SQL for anything that goes through
--       the database (the tooling half lives in scripts/check-structure.mjs).
--       storage.buckets itself is Supabase-managed and gets no trigger.
CREATE OR REPLACE FUNCTION public.structure_guard_allows_bucket(_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _name = ANY (ARRAY['mkt-media', 'mkt-chat']) OR _name LIKE 'mkt-%';
$$;
