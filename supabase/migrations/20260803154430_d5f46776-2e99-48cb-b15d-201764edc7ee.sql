CREATE OR REPLACE FUNCTION public.mkt_set_entity_activities(_tenant_id uuid, _main_activity_id uuid, _sub_activity_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  main_group uuid; sub uuid; sub_row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT (public.is_active_member(_tenant_id) OR public.mkt_is_platform_admin()) THEN
    RAISE EXCEPTION 'not authorised for this entity';
  END IF;
  SELECT group_id INTO main_group FROM public.mkt_activities
   WHERE id = _main_activity_id AND parent_id IS NULL AND is_active AND merged_into_id IS NULL;
  IF main_group IS NULL THEN
    RAISE EXCEPTION 'invalid main activity';
  END IF;
  FOREACH sub IN ARRAY coalesce(_sub_activity_ids, '{}'::uuid[]) LOOP
    SELECT id, group_id, parent_id INTO sub_row FROM public.mkt_activities
     WHERE id = sub AND is_active AND merged_into_id IS NULL;
    IF sub_row IS NULL THEN
      RAISE EXCEPTION 'invalid sub-activity';
    END IF;
    IF sub_row.group_id <> main_group THEN
      RAISE EXCEPTION 'sub-activity belongs to a different sector';
    END IF;
    -- A sub-activity must be a child of the selected main activity: another
    -- main-level activity can never be stored as a sub-activity.
    IF sub_row.parent_id IS NULL OR sub_row.parent_id <> _main_activity_id THEN
      RAISE EXCEPTION 'sub-activity does not belong to the selected main activity';
    END IF;
  END LOOP;
  DELETE FROM public.mkt_entity_activities WHERE tenant_id = _tenant_id;
  INSERT INTO public.mkt_entity_activities (tenant_id, activity_id, is_primary, created_by)
  VALUES (_tenant_id, _main_activity_id, true, auth.uid());
  INSERT INTO public.mkt_entity_activities (tenant_id, activity_id, is_primary, created_by)
  SELECT _tenant_id, s, false, auth.uid()
  FROM unnest(coalesce(_sub_activity_ids, '{}'::uuid[])) AS s
  WHERE s <> _main_activity_id
  ON CONFLICT (tenant_id, activity_id) DO NOTHING;
END; $function$;