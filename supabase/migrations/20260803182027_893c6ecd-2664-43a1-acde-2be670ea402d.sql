CREATE OR REPLACE FUNCTION public.mkt_admin_listing_reports(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _priority text DEFAULT NULL,
  _assignee uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _suspended_only boolean DEFAULT false,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, ref_no text, status text, severity text, priority text,
  reason_code text, reason_name_ar text, reason_name_en text, note text,
  created_at timestamptz, updated_at timestamptz, sla_due_at timestamptz,
  listing_id uuid, listing_ref text, listing_title text, listing_status text,
  listing_slug text, listing_city text,
  owner_label text, owner_business text,
  listing_report_count integer,
  assigned_to uuid, assignee_label text,
  last_action text, last_action_at timestamptz,
  reporter_alias text, reporter_identity text, reporter_invalid_count integer,
  can_view_reporter boolean, total_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE _ident boolean; _total integer;
BEGIN
  IF NOT public.mkt_staff_has('reports.inbox_view') AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  _ident := public.mkt_is_platform_admin() OR public.mkt_staff_has('reports.view_reporter_identity');

  CREATE TEMP TABLE IF NOT EXISTS _rep_ids(rid uuid) ON COMMIT DROP;
  DELETE FROM _rep_ids;

  INSERT INTO _rep_ids
  SELECT r.id
    FROM public.mkt_reports r
    JOIN public.mkt_listings l ON l.id = r.listing_id
    LEFT JOIN public.profiles op ON op.user_id = l.owner_user_id
   WHERE (_status IS NULL OR _status = '' OR r.status = _status)
     AND (_reason IS NULL OR _reason = '' OR r.reason_code = _reason)
     AND (_priority IS NULL OR _priority = '' OR r.priority = _priority)
     AND (_assignee IS NULL OR r.assigned_to = _assignee)
     AND (_from IS NULL OR r.created_at >= _from)
     AND (_to IS NULL OR r.created_at <= _to)
     AND (NOT coalesce(_suspended_only, false) OR l.status IN ('suspended','rejected'))
     AND (
       _search IS NULL OR btrim(_search) = ''
       OR coalesce(r.ref_no,'') ILIKE '%' || btrim(_search) || '%'
       OR coalesce(l.ref_no::text,'') ILIKE '%' || btrim(_search) || '%'
       OR coalesce(l.title,'') ILIKE '%' || btrim(_search) || '%'
       OR coalesce(op.full_name,'') ILIKE '%' || btrim(_search) || '%'
     );

  SELECT count(*) INTO _total FROM _rep_ids;

  RETURN QUERY
  SELECT r.id, r.ref_no, r.status, r.severity, r.priority,
         r.reason_code, rs.name_ar, rs.name_en, r.note,
         r.created_at, r.updated_at, r.sla_due_at,
         l.id, l.ref_no::text, l.title, l.status, l.slug, l.city,
         nullif(btrim(coalesce(op.full_name, '')), ''),
         coalesce(tn.name_ar, tn.name_en),
         (SELECT count(*)::int FROM public.mkt_reports r2 WHERE r2.listing_id = r.listing_id),
         r.assigned_to,
         nullif(btrim(coalesce(ap.full_name, '')), ''),
         (SELECT h.to_status FROM public.mkt_report_status_history h
           WHERE h.report_id = r.id ORDER BY h.created_at DESC LIMIT 1),
         (SELECT h.created_at FROM public.mkt_report_status_history h
           WHERE h.report_id = r.id ORDER BY h.created_at DESC LIMIT 1),
         'R-' || upper(substr(md5(r.reporter_user_id::text || r.listing_id::text), 1, 6)),
         CASE WHEN _ident THEN nullif(btrim(coalesce(rp.full_name, '')), '') ELSE NULL END,
         (SELECT count(*)::int FROM public.mkt_reports r3
           WHERE r3.reporter_user_id = r.reporter_user_id
             AND r3.status IN ('invalid','out_of_scope')),
         _ident,
         _total
    FROM public.mkt_reports r
    JOIN _rep_ids f ON f.rid = r.id
    JOIN public.mkt_listings l ON l.id = r.listing_id
    LEFT JOIN public.mkt_report_reasons rs ON rs.code = r.reason_code
    LEFT JOIN public.profiles op ON op.user_id = l.owner_user_id
    LEFT JOIN public.profiles ap ON ap.user_id = r.assigned_to
    LEFT JOIN public.profiles rp ON rp.user_id = r.reporter_user_id
    LEFT JOIN public.tenants tn ON tn.id = l.tenant_id
   ORDER BY r.created_at DESC
   LIMIT least(greatest(coalesce(_limit, 50), 1), 200)
  OFFSET greatest(coalesce(_offset, 0), 0);
END $$;

CREATE OR REPLACE FUNCTION public.mkt_report_staff_options()
RETURNS TABLE(user_id uuid, label text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.mkt_staff_has('reports.inbox_view') AND NOT public.mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT u.uid,
         coalesce(nullif(btrim(coalesce(p.full_name, '')), ''), 'مشرف #' || substr(replace(u.uid::text,'-',''),1,6))
    FROM (
      SELECT user_id AS uid FROM public.mkt_platform_admins
      UNION
      SELECT sp.user_id FROM public.mkt_staff_permissions sp
       WHERE sp.perm IN ('reports.inbox_view','ads.reports_view')
    ) u
    LEFT JOIN public.profiles p ON p.user_id = u.uid
   ORDER BY 2;
END $$;

REVOKE EXECUTE ON FUNCTION public.mkt_admin_listing_reports(text,text,text,text,uuid,timestamptz,timestamptz,boolean,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mkt_report_staff_options() FROM anon;
