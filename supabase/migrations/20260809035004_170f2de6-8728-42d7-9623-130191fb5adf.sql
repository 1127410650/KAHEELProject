-- ===== 1) Legacy Tahqaq tables =====
DROP TABLE IF EXISTS
  public.request_field_versions,
  public.request_change_requests,
  public.request_reminders,
  public.request_message_reads,
  public.request_messages,
  public.request_status_history,
  public.requests,
  public.custody_transactions,
  public.invoice_verifications,
  public.invoice_status_history,
  public.invoice_line_items,
  public.invoices,
  public.product_price_history,
  public.product_unit_conversions,
  public.product_aliases,
  public.product_catalog,
  public.unified_products,
  public.suppliers,
  public.project_supervisors,
  public.project_members,
  public.projects,
  public.supervisors,
  public.attachments,
  public.app_settings,
  public.notifications,
  public.profile_private_details,
  public.account_link_reviews,
  public.document_analysis_conflicts,
  public.document_analysis_fields,
  public.document_analysis_runs,
  public.document_analyses,
  public.property_service_results,
  public.property_services,
  public.property_document_requests,
  public.property_documents,
  public.property_license_components,
  public.property_licenses,
  public.property_unit_components,
  public.property_units,
  public.property_partition_reports,
  public.property_plans,
  public.property_deeds,
  public.property_contracts,
  public.property_owners,
  public.property_coordinates,
  public.property_boundaries,
  public.property_land,
  public.appt_appointment_events,
  public.appt_appointments,
  public.appt_queue_entries,
  public.appt_audit_log,
  public.appt_availability,
  public.appt_time_off,
  public.appt_services,
  public.appt_provider_settings,
  public.appt_provider_members,
  public.appt_market_links,
  public.appt_providers,
  public.appt_profiles
CASCADE;

-- ===== 2) Legacy functions =====
DO $$
DECLARE
  r record;
  keep text[] := ARRAY['property_touch'];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'appt_%'
        OR p.proname LIKE 'property_%'
        OR p.proname LIKE 'tiv_%'
        OR p.proname LIKE 'request_%'
        OR p.proname LIKE 'document_analysis_%'
        OR p.proname LIKE 'change_request_%'
        OR p.proname LIKE 'project_membership_%'
        OR p.proname LIKE 'kaheel_appointments_%'
        OR p.proname IN (
          'kaheel_unified_customer_bookings_v2',
          'touch_analysis_updated_at',
          'submit_request','submit_portal_request','notify_request','send_request_reminder',
          'log_request_status','set_request_scope','block_request_history_mutation',
          'enforce_request_ownership','enforce_request_rules','enforce_request_transition',
          'custody_base_effect','custody_settlement_guard','lock_approved_custody',
          'invoice_settled_amount','invoices_guard',
          'can_access_project','can_access_request','can_access_supervisor',
          'can_access_attachment_object','can_access_invoice_object','can_view_invoice',
          'can_view_property','can_view_property_document','can_view_property_documents',
          'can_view_property_services','can_approve_property','can_edit_property',
          'project_exists','approve_attachment','attachment_restore','enforce_attachment_rules',
          'current_supervisor_id','is_supervisor_user','normalize_doc_no','normalize_product_name'
        )
      )
      AND NOT (p.proname = ANY (keep))
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;

  -- property_touch may still be attached to nothing after table drops
  EXECUTE 'DROP FUNCTION IF EXISTS public.property_touch() CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.property_audit() CASCADE';
  EXECUTE 'DROP FUNCTION IF EXISTS public.property_owners_share_guard() CASCADE';
END $$;

-- ===== 3) Legacy enum types (only when unused) =====
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['custody_txn_type','project_kind','project_status','request_status']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type ty ON ty.oid = a.atttypid
      JOIN pg_namespace tn ON tn.oid = ty.typnamespace
      WHERE tn.nspname = 'public' AND ty.typname = t AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      EXECUTE format('DROP TYPE IF EXISTS public.%I', t);
    END IF;
  END LOOP;
END $$;