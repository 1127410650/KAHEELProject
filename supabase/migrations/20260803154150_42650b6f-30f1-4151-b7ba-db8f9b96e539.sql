CREATE OR REPLACE FUNCTION public.mkt_search_activities(_q text, _group_id uuid DEFAULT NULL::uuid, _parent_id uuid DEFAULT NULL::uuid, _only_main boolean DEFAULT NULL::boolean, _limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, group_id uuid, group_name_ar text, group_name_en text, parent_id uuid, parent_name_ar text, name_ar text, name_en text, matched_alias text, match_kind text, score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT public.mkt_norm_activity_text(_q) AS n),
  base AS (
    SELECT a.id, a.group_id, g.name_ar AS group_name_ar, g.name_en AS group_name_en,
           a.parent_id, p.name_ar AS parent_name_ar, a.name_ar, a.name_en, a.norm_ar,
           public.mkt_norm_activity_text(a.name_en) AS norm_en, a.sort_order
    FROM public.mkt_activities a
    JOIN public.mkt_activity_groups g ON g.id = a.group_id AND g.is_active
    LEFT JOIN public.mkt_activities p ON p.id = a.parent_id
    WHERE a.is_active AND a.merged_into_id IS NULL
      AND (_group_id IS NULL OR a.group_id = _group_id)
      AND (_parent_id IS NULL OR a.parent_id = _parent_id)
      AND (_only_main IS NULL OR (_only_main AND a.parent_id IS NULL) OR (NOT _only_main AND a.parent_id IS NOT NULL))
  ),
  scored AS (
    -- Arabic name
    SELECT b.*, NULL::text AS matched_alias,
           CASE
             WHEN (SELECT n FROM q) IS NULL THEN 'browse'
             WHEN b.norm_ar = (SELECT n FROM q) THEN 'exact'
             WHEN b.norm_ar LIKE (SELECT n FROM q) || '%' THEN 'prefix'
             WHEN b.norm_ar LIKE '%' || (SELECT n FROM q) || '%' THEN 'contains'
             ELSE 'fuzzy'
           END AS match_kind,
           CASE
             WHEN (SELECT n FROM q) IS NULL THEN 0.5
             WHEN b.norm_ar = (SELECT n FROM q) THEN 1.0
             WHEN b.norm_ar LIKE (SELECT n FROM q) || '%' THEN 0.8
             WHEN b.norm_ar LIKE '%' || (SELECT n FROM q) || '%' THEN 0.7
             ELSE extensions.similarity(b.norm_ar, (SELECT n FROM q))
           END::real AS score
    FROM base b
    UNION ALL
    -- English name
    SELECT b.*, NULL::text,
           CASE
             WHEN b.norm_en = (SELECT n FROM q) THEN 'exact'
             WHEN b.norm_en LIKE (SELECT n FROM q) || '%' THEN 'prefix'
             WHEN b.norm_en LIKE '%' || (SELECT n FROM q) || '%' THEN 'contains'
             ELSE 'fuzzy'
           END,
           CASE
             WHEN b.norm_en = (SELECT n FROM q) THEN 1.0
             WHEN b.norm_en LIKE (SELECT n FROM q) || '%' THEN 0.8
             WHEN b.norm_en LIKE '%' || (SELECT n FROM q) || '%' THEN 0.7
             ELSE extensions.similarity(b.norm_en, (SELECT n FROM q))
           END::real
    FROM base b
    WHERE (SELECT n FROM q) IS NOT NULL AND b.norm_en IS NOT NULL AND b.norm_en <> ''
    UNION ALL
    -- Aliases
    SELECT b.*, al.alias,
           CASE WHEN al.norm_alias = (SELECT n FROM q) THEN 'alias' ELSE 'alias_partial' END,
           CASE WHEN al.norm_alias = (SELECT n FROM q) THEN 0.95
                WHEN al.norm_alias LIKE (SELECT n FROM q) || '%' THEN 0.75
                ELSE 0.6 END::real
    FROM base b
    JOIN public.mkt_activity_aliases al ON al.activity_id = b.id
    WHERE (SELECT n FROM q) IS NOT NULL
      AND (al.norm_alias LIKE '%' || (SELECT n FROM q) || '%' OR (SELECT n FROM q) LIKE al.norm_alias || '%')
  ),
  best AS (
    SELECT DISTINCT ON (s.id) s.*
    FROM scored s
    WHERE (SELECT n FROM q) IS NULL OR s.score >= 0.28
    ORDER BY s.id, s.score DESC
  )
  SELECT best.id, best.group_id, best.group_name_ar, best.group_name_en, best.parent_id,
         best.parent_name_ar, best.name_ar, best.name_en, best.matched_alias, best.match_kind, best.score
  FROM best
  ORDER BY best.score DESC, best.sort_order, best.name_ar
  LIMIT greatest(1, least(coalesce(_limit, 20), 50));
$function$;