-- 1) tamper-proof listing events -------------------------------------------------
REVOKE UPDATE, DELETE ON public.mkt_listing_events FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.mkt_listing_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'listing events are append-only';
END $$;

DROP TRIGGER IF EXISTS trg_mkt_listing_events_immutable ON public.mkt_listing_events;
CREATE TRIGGER trg_mkt_listing_events_immutable
BEFORE UPDATE OR DELETE ON public.mkt_listing_events
FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_events_immutable();

-- 2) moderation op flag so delegated staff (not only platform admins) can act ----
CREATE OR REPLACE FUNCTION public.mkt_is_moderation_op()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$ SELECT coalesce(current_setting('mkt.listing_op', true), '') = 'admin_moderation' $$;

REVOKE ALL ON FUNCTION public.mkt_is_moderation_op() FROM anon;

CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
       AND NOT public.mkt_is_moderation_op()
       AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action())
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

-- 3) admin-wide operations log ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_listing_events(
  _search text DEFAULT NULL,
  _event_type text DEFAULT NULL,
  _actor uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  event_type text,
  meta jsonb,
  actor_id uuid,
  actor_label text,
  listing_id uuid,
  listing_ref text,
  listing_title text,
  listing_status text,
  listing_city text,
  ip_address text,
  user_agent text,
  can_view_ip boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _ip boolean;
BEGIN
  IF NOT public.mkt_staff_has('ads.events_view') AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  _ip := public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.view_ip_device');

  RETURN QUERY
  SELECT e.id, e.created_at, e.event_type, e.meta, e.actor_id,
         nullif(btrim(coalesce(p.full_name, '') || ' ' || coalesce('#' || substr(replace(e.actor_id::text,'-',''), 1, 6), '')), '') AS actor_label,
         l.id, l.ref_no::text, l.title, l.status, l.city,
         CASE WHEN _ip THEN e.ip_address
              WHEN e.ip_address IS NULL THEN NULL
              ELSE split_part(e.ip_address, '.', 1) || '.' || split_part(e.ip_address, '.', 2) || '.x.x' END,
         CASE WHEN _ip THEN e.user_agent
              WHEN e.user_agent IS NULL THEN NULL
              ELSE 'مقنّع' END,
         _ip
    FROM public.mkt_listing_events e
    JOIN public.mkt_listings l ON l.id = e.listing_id
    LEFT JOIN public.profiles p ON p.id = e.actor_id
   WHERE (_event_type IS NULL OR _event_type = '' OR e.event_type = _event_type)
     AND (_actor IS NULL OR e.actor_id = _actor)
     AND (_from IS NULL OR e.created_at >= _from)
     AND (_to IS NULL OR e.created_at <= _to)
     AND (
       _search IS NULL OR btrim(_search) = ''
       OR l.ref_no::text ILIKE '%' || btrim(_search) || '%'
       OR l.title ILIKE '%' || btrim(_search) || '%'
       OR coalesce(l.city,'') ILIKE '%' || btrim(_search) || '%'
     )
   ORDER BY e.created_at DESC
   LIMIT least(greatest(coalesce(_limit, 50), 1), 200)
  OFFSET greatest(coalesce(_offset, 0), 0);
END $$;

REVOKE ALL ON FUNCTION public.mkt_admin_listing_events(text, text, uuid, timestamptz, timestamptz, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_events(text, text, uuid, timestamptz, timestamptz, integer, integer) TO authenticated;

-- 4) listing brief for the admin log -------------------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_listing_brief(_listing_id uuid)
RETURNS TABLE(
  id uuid, ref_no text, title text, status text, city text, slug text,
  expires_at timestamptz, published_at timestamptz, rejection_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.mkt_staff_has('ads.events_view') AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT l.id, l.ref_no::text, l.title, l.status, l.city, l.slug,
           l.expires_at, l.published_at, l.rejection_reason
      FROM public.mkt_listings l WHERE l.id = _listing_id;
END $$;

REVOKE ALL ON FUNCTION public.mkt_admin_listing_brief(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_brief(uuid) TO authenticated;

-- 5) unified, permission-gated admin actions -----------------------------------
CREATE OR REPLACE FUNCTION public.mkt_admin_listing_action(
  _listing_id uuid,
  _action text,
  _reason text DEFAULT NULL,
  _days integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _old text; _new text; _perm text; _dur smallint;
BEGIN
  SELECT status, coalesce(duration_days, 30) INTO _old, _dur
    FROM public.mkt_listings WHERE id = _listing_id;
  IF _old IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  _perm := CASE _action
    WHEN 'suspend' THEN 'ads.moderation_suspend'
    WHEN 'reject' THEN 'ads.moderation_suspend'
    WHEN 'unsuspend' THEN 'ads.moderation_unsuspend'
    WHEN 'request_edit' THEN 'ads.moderation_request_edit'
    WHEN 'archive' THEN 'ads.moderation_archive'
    WHEN 'extend' THEN 'ads.moderation_extend'
    ELSE NULL END;
  IF _perm IS NULL THEN RAISE EXCEPTION 'unknown_action'; END IF;

  IF NOT public.mkt_staff_has(_perm) AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF btrim(coalesce(_reason, '')) = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  IF _action = 'extend' THEN
    IF _days IS NULL OR _days NOT IN (1,3,7,14,30) THEN RAISE EXCEPTION 'invalid_duration'; END IF;
    UPDATE public.mkt_listings
       SET expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(days => _days),
           expiry_notice_stage = 0,
           updated_at = now()
     WHERE id = _listing_id;
    PERFORM public.mkt_log_listing_event(_listing_id, 'admin_extended',
      jsonb_build_object('days', _days, 'reason', _reason));
    PERFORM public.log_audit('mkt_listing', 'admin_extend', _listing_id,
      NULL, jsonb_build_object('days', _days), _reason);
    RETURN _old;
  END IF;

  _new := CASE _action
    WHEN 'suspend' THEN 'suspended'
    WHEN 'reject' THEN 'rejected'
    WHEN 'request_edit' THEN 'needs_changes'
    WHEN 'archive' THEN 'archived'
    WHEN 'unsuspend' THEN 'published'
    END;

  PERFORM set_config('mkt.listing_op', 'admin_moderation', true);
  UPDATE public.mkt_listings
     SET status = _new,
         rejection_reason = CASE WHEN _action IN ('suspend','reject','request_edit') THEN _reason ELSE NULL END,
         published_at = CASE WHEN _new = 'published' THEN coalesce(published_at, now()) ELSE published_at END,
         expires_at = CASE WHEN _new = 'published'
                           THEN greatest(coalesce(expires_at, now()), now() + make_interval(days => _dur::int))
                           ELSE expires_at END,
         paused_at = CASE WHEN _new = 'published' THEN NULL ELSE paused_at END,
         expiry_notice_stage = CASE WHEN _new = 'published' THEN 0 ELSE expiry_notice_stage END,
         updated_at = now()
   WHERE id = _listing_id;
  PERFORM set_config('mkt.listing_op', '', true);

  INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason, actor_id)
  VALUES (_listing_id, _old, _new, _reason, auth.uid());

  PERFORM public.mkt_log_listing_event(_listing_id, 'admin_' || _action,
    jsonb_build_object('from', _old, 'to', _new, 'reason', _reason));

  PERFORM public.log_audit('mkt_listing', 'admin_' || _action, _listing_id,
    jsonb_build_object('status', _old), jsonb_build_object('status', _new), _reason);

  RETURN _new;
END $$;

REVOKE ALL ON FUNCTION public.mkt_admin_listing_action(uuid, text, text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mkt_admin_listing_action(uuid, text, text, integer) TO authenticated;