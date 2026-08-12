-- =====================================================================
-- ACL HARDENING — public.mkt* function EXECUTE privileges
-- Status: PREPARED. Applied to the LOCAL SHADOW DATABASE ONLY.
-- NOT applied to production. Moving this file into supabase/migrations/
-- and running it against production requires a separate, explicit owner GO.
--
-- Reference snapshot (before state, extracted read-only from production):
--   .lovable/audit/2026-08-12-acl-snapshot.md
-- Rollback (from that snapshot only):
--   .lovable/pending-migrations/20260812_acl_hardening_rollback.sql
--
-- Properties: single atomic DO block, idempotent (REVOKE is repeatable),
-- forward-only, no DROP, no data change, no GRANT widening.
--
-- Policy applied per object:
--   A. trigger functions (prorettype = trigger)
--        -> REVOKE EXECUTE FROM PUBLIC, anon, authenticated
--           (the client must never call a trigger function directly; triggers
--            execute with the privileges of the table owner, so revoking here
--            cannot break any trigger.)
--   B. public exceptions (40 objects, individually proven)
--        -> REVOKE EXECUTE FROM PUBLIC   (anon and authenticated preserved)
--           PUBLIC is revoked because an explicit anon grant is the auditable
--           surface; a residual PUBLIC grant would silently re-open access to
--           every present and future role.
--           The 40th, mkt_distance_m, was added after the shadow test: the four
--           public mkt_nearby_* functions are SECURITY INVOKER and call it, so
--           revoking it broke every nearby search for visitors.
--   C. authenticated-keep (2 objects, class E in the snapshot: their only grant
--      was PUBLIC, yet real signed-in client callers exist)
--        -> REVOKE EXECUTE FROM PUBLIC, anon, then GRANT EXECUTE TO authenticated
--           This is not a widening: authenticated already reached them through
--           PUBLIC in production. It converts an implicit grant into an explicit
--           one and removes anon.
--   D. everything else
--        -> REVOKE EXECUTE FROM PUBLIC, anon
--           authenticated is deliberately KEPT: these functions stay protected
--           by their in-function guard and required permission, and revoking
--           authenticated would break legitimate signed-in/staff/admin paths.

-- =====================================================================

DO $acl$
DECLARE
  -- 40 individually proven public exceptions (full signatures).
  v_exceptions text[] := ARRAY[
    'mkt_ad_campaign_track(uuid,text,text)',
    'mkt_analytics_ingest(jsonb,boolean)',
    'mkt_distance_m(double precision,double precision,double precision,double precision)',
    'mkt_guide_featured_places(integer)',
    'mkt_guide_place_rating(uuid)',
    'mkt_guide_promo_track(uuid,text)',
    'mkt_increment_views(uuid)',
    'mkt_is_platform_admin()',
    'mkt_listing_is_public(uuid)',
    'mkt_listing_track(uuid,text)',
    'mkt_listing_track_share(uuid)',
    'mkt_nearby_directory(double precision,double precision,double precision,integer,integer,text,text,text)',
    'mkt_nearby_guide_places(double precision,double precision,double precision,integer,integer,text,text,text,text,text,text)',
    'mkt_nearby_listings(double precision,double precision,double precision,integer,integer,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,text,boolean,boolean,boolean)',
    'mkt_nearby_storefronts(double precision,double precision,double precision,integer,integer,uuid,uuid,text,text)',
    'mkt_public_business(text)',
    'mkt_public_business_categories(text)',
    'mkt_public_business_listings(text,uuid,integer,integer)',
    'mkt_public_person(text)',
    'mkt_public_person_categories(text)',
    'mkt_public_person_listings(text,uuid,integer,integer)',
    'mkt_public_phone(uuid)',
    'mkt_re_license_active(uuid)',
    'mkt_re_listing_published(uuid)',
    'mkt_re_provider_public(text)',
    'mkt_service_booking_context(text,uuid)',
    'mkt_service_categories_public()',
    'mkt_service_directory(text,text,uuid,integer)',
    'mkt_service_slots(uuid,date,uuid)',
    'mkt_store_addon_group_visible(uuid)',
    'mkt_store_admin()',
    'mkt_store_branch_visible(uuid)',
    'mkt_store_item_visible(uuid)',
    'mkt_store_open_state(uuid)',
    'mkt_store_public(text)',
    'mkt_store_theme_public(text)',
    'mkt_store_visible(uuid)',
    'mkt_story_track(uuid,text,text)',
    'mkt_theme_active()',
    'mkt_track(jsonb)'
  ];
  -- Class E objects whose ONLY production grant was PUBLIC but which have real
  -- signed-in client callers (proven in src/): re-granted to authenticated only.
  --   mkt_admin_overview()    -> src/lib/mkt-platform.ts:120 (admin dashboard)
  --   mkt_student_bot_state() -> src/lib/mkt-student-bot.ts:114 (session-gated)
  v_auth_keep text[] := ARRAY[
    'mkt_admin_overview()',
    'mkt_student_bot_state()'
  ];
  r            record;
  v_sig        text;
  n_trigger    integer := 0;
  n_exception  integer := 0;
  n_revoked    integer := 0;
  n_authkeep   integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.oid::regprocedure::text AS sig,
           (p.prorettype = 'trigger'::regtype) AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'mkt%'
    ORDER BY 2
  LOOP
    -- regprocedure renders unqualified when public is on search_path; normalise.
    v_sig := regexp_replace(r.sig, '^public\.', '');

    IF r.is_trigger THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.oid::regprocedure);
      n_trigger := n_trigger + 1;

    ELSIF v_sig = ANY (v_exceptions) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.oid::regprocedure);
      n_exception := n_exception + 1;

    ELSIF v_sig = ANY (v_auth_keep) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.oid::regprocedure);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated', r.oid::regprocedure);
      n_authkeep := n_authkeep + 1;

    ELSE
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.oid::regprocedure);
      n_revoked := n_revoked + 1;
    END IF;
  END LOOP;

  -- Guard: every exception signature must exist, otherwise the list is stale.
  FOREACH v_sig IN ARRAY v_exceptions || v_auth_keep LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND regexp_replace(p.oid::regprocedure::text, '^public\.', '') = v_sig
    ) THEN
      RAISE EXCEPTION 'ACL_HARDENING: exception signature not found: %', v_sig;
    END IF;
  END LOOP;

  RAISE NOTICE 'ACL_HARDENING: trigger_fns=% exceptions=% auth_keep=% hardened=%',
    n_trigger, n_exception, n_authkeep, n_revoked;
END
$acl$;
