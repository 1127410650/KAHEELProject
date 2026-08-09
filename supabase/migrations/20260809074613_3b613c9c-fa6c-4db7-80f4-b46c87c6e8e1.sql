CREATE OR REPLACE FUNCTION public.structure_guard_ddl()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cmd record;
  tbl_name text;
  sch_name text;
BEGIN
  IF NOT public.structure_guard_is_enabled() THEN
    RETURN;
  END IF;

  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF cmd.command_tag = 'CREATE SCHEMA' THEN
      sch_name := cmd.object_identity;

      -- Supabase-managed and extension schemas must never be blocked: an
      -- unconditional rejection here breaks platform upgrades, extension
      -- installs and role provisioning. Only project-created schemas are refused.
      IF sch_name = ANY (ARRAY[
            'auth','storage','realtime','graphql','graphql_public',
            'supabase_functions','supabase_migrations','vault','extensions',
            'pgbouncer','pgsodium','pgsodium_masks','pg_net','cron','net',
            'pgtle','_analytics','_realtime','information_schema'])
         OR sch_name LIKE 'pg\_%'
         OR current_user = ANY (ARRAY[
            'supabase_admin','supabase_auth_admin','supabase_storage_admin',
            'supabase_functions_admin','supabase_realtime_admin','pgbouncer'])
      THEN
        CONTINUE;
      END IF;

      RAISE WARNING '[STRUCTURE_GUARD] rejected CREATE SCHEMA % by %',
        cmd.object_identity, current_user;
      RAISE EXCEPTION
        'حارس البنية: إنشاء مخطط (schema) جديد غير مسموح — كل شيء يعيش في public. / Structure guard: creating a new schema is not allowed.'
        USING HINT = 'راجع docs/ARCHITECTURE_RULES.md ثم استخدم public.structure_guard_disable(reason, minutes) بحساب مسؤول المنصة عند وجود حاجة مشروعة.';
    END IF;

    IF cmd.command_tag = 'CREATE TABLE' AND cmd.schema_name = 'public' THEN
      tbl_name := split_part(cmd.object_identity, '.', 2);

      IF NOT public.structure_guard_allows_table(tbl_name) THEN
        RAISE WARNING '[STRUCTURE_GUARD] rejected CREATE TABLE % by %',
          cmd.object_identity, current_user;
        RAISE EXCEPTION
          'حارس البنية: اسم الجدول "%" مرفوض. كل جدول جديد في public يجب أن يبدأ بالبادئة mkt_ . / Structure guard: every new public table must be prefixed with mkt_.',
          tbl_name
          USING HINT = 'أعد التسمية إلى mkt_' || tbl_name || ' — أو، لحاجة مشروعة، اقرأ docs/ARCHITECTURE_RULES.md واستخدم public.structure_guard_disable(reason, minutes) بحساب مسؤول المنصة، ثم public.structure_guard_enable() بعد الانتهاء.';
      END IF;

      INSERT INTO public.mkt_structure_guard_events
        (object_identity, command_tag, outcome, performed_by, reason)
      VALUES (cmd.object_identity, cmd.command_tag, 'allowed', current_user,
              'name follows the mkt_ convention');
    END IF;
  END LOOP;
END;
$function$;