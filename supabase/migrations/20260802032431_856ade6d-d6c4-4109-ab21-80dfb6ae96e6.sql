-- ============ 1) staff permissions ============
CREATE TABLE public.mkt_staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, perm)
);
GRANT SELECT ON public.mkt_staff_permissions TO authenticated;
GRANT ALL ON public.mkt_staff_permissions TO service_role;
ALTER TABLE public.mkt_staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mkt_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.mkt_staff_has(_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.mkt_is_super_admin() OR EXISTS (
    SELECT 1 FROM public.mkt_staff_permissions p
    WHERE p.user_id = auth.uid() AND p.perm = _perm
  )
$$;

CREATE POLICY "staff read own perms" ON public.mkt_staff_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.mkt_is_super_admin());

-- ============ 2) report reasons ============
CREATE TABLE public.mkt_report_reasons (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  default_severity text NOT NULL DEFAULT 'medium'
    CHECK (default_severity IN ('low','medium','high','critical')),
  requires_note boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_report_reasons TO anon, authenticated;
GRANT ALL ON public.mkt_report_reasons TO service_role;
ALTER TABLE public.mkt_report_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reasons public read" ON public.mkt_report_reasons
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "reasons managed by super admin" ON public.mkt_report_reasons
  FOR ALL TO authenticated USING (public.mkt_is_super_admin()) WITH CHECK (public.mkt_is_super_admin());
CREATE TRIGGER mkt_report_reasons_touch BEFORE UPDATE ON public.mkt_report_reasons
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

INSERT INTO public.mkt_report_reasons (code, name_ar, name_en, default_severity, requires_note, sort_order) VALUES
  ('misleading','إعلان مضلل أو معلومات غير صحيحة','Misleading or inaccurate listing','medium',false,10),
  ('fraud','احتيال أو اشتباه احتيال','Fraud or suspected fraud','critical',true,20),
  ('impersonation','انتحال اسم أو هوية منشأة','Impersonation of a business identity','high',true,30),
  ('prohibited','منتج أو خدمة ممنوعة','Prohibited product or service','high',false,40),
  ('offensive','محتوى مخالف أو مسيء','Offensive or violating content','high',false,50),
  ('bad_documents','صور أو مستندات غير صحيحة','Incorrect images or documents','medium',false,60),
  ('fake_price','سعر وهمي أو غير حقيقي','Fake or unrealistic price','low',false,70),
  ('duplicate_spam','إعلان مكرر أو مزعج','Duplicate or spam listing','low',false,80),
  ('suspicious_contact','معلومات تواصل مشبوهة','Suspicious contact information','medium',false,90),
  ('offplatform_payment','طلب دفع خارج المنصة بطريقة مشبوهة','Suspicious off-platform payment request','critical',true,100),
  ('ip_violation','انتهاك حقوق ملكية فكرية','Intellectual property violation','high',true,110),
  ('wrong_category','الإعلان في تصنيف غير مناسب','Listing in the wrong category','low',false,120),
  ('unavailable','الإعلان غير متاح أو انتهى','Listing unavailable or expired','low',false,130),
  ('other','سبب آخر','Other reason','medium',true,140);

-- ============ 3) extend mkt_reports ============
ALTER TABLE public.mkt_reports
  ADD COLUMN ref_no text UNIQUE,
  ADD COLUMN reason_code text REFERENCES public.mkt_report_reasons(code),
  ADD COLUMN severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN assigned_to uuid,
  ADD COLUMN assigned_at timestamptz,
  ADD COLUMN listing_snapshot jsonb,
  ADD COLUMN owner_user_id uuid,
  ADD COLUMN tenant_id uuid,
  ADD COLUMN first_response_at timestamptz,
  ADD COLUMN sla_due_at timestamptz,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN decision text,
  ADD COLUMN decision_reason text,
  ADD COLUMN public_outcome text,
  ADD COLUMN merged_into uuid REFERENCES public.mkt_reports(id),
  ADD COLUMN reopened_at timestamptz,
  ADD COLUMN reporter_confirmed boolean NOT NULL DEFAULT true;

ALTER TABLE public.mkt_reports DROP CONSTRAINT IF EXISTS mkt_reports_status_check;
ALTER TABLE public.mkt_reports ADD CONSTRAINT mkt_reports_status_check CHECK (status IN (
  'new','unassigned','under_review','awaiting_reporter','awaiting_advertiser',
  'action_taken','closed','reopened','duplicate','invalid','out_of_scope','escalated','referred'
));
ALTER TABLE public.mkt_reports ALTER COLUMN status SET DEFAULT 'new';
CREATE INDEX mkt_reports_assigned_idx ON public.mkt_reports (assigned_to);
CREATE INDEX mkt_reports_listing_created_idx ON public.mkt_reports (listing_id, created_at DESC);

CREATE SEQUENCE IF NOT EXISTS public.mkt_report_ref_seq START 1000;

-- ============ 4) satellite tables ============
CREATE TABLE public.mkt_report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.mkt_reports(id) ON DELETE CASCADE,
  appeal_id uuid,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  side text NOT NULL DEFAULT 'reporter' CHECK (side IN ('reporter','advertiser','staff')),
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mkt_report_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.mkt_reports(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mkt_report_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.mkt_reports(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('reporter','advertiser')),
  sender_side text NOT NULL CHECK (sender_side IN ('staff','reporter','advertiser')),
  sender_user_id uuid,
  kind text NOT NULL DEFAULT 'message',
  body text NOT NULL,
  attachment_path text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mkt_report_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.mkt_reports(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mkt_enforcement_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.mkt_reports(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('listing','user','business')),
  target_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  duration_days integer,
  expires_at timestamptz,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mkt_account_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.mkt_reports(id) ON DELETE SET NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('user','business')),
  subject_id uuid NOT NULL,
  restriction text NOT NULL CHECK (restriction IN (
    'warning','no_new_listings','no_submit_review','no_messaging','no_new_requests',
    'suspend_listings','suspend_account','suspend_business_publishing','revoke_verification','permanent_ban'
  )),
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_account_restrictions_subject_idx ON public.mkt_account_restrictions (subject_type, subject_id) WHERE lifted_at IS NULL;

CREATE TABLE public.mkt_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.mkt_reports(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.mkt_listings(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','under_review','accepted','partially_accepted','rejected')),
  decision_reason text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mkt_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid REFERENCES public.mkt_reports(id) ON DELETE CASCADE,
  event text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_notifications_user_idx ON public.mkt_notifications (user_id, created_at DESC);

GRANT SELECT ON public.mkt_report_files, public.mkt_report_status_history, public.mkt_report_messages,
  public.mkt_report_notes, public.mkt_enforcement_actions, public.mkt_account_restrictions,
  public.mkt_appeals, public.mkt_notifications TO authenticated;
GRANT INSERT ON public.mkt_report_files TO authenticated;
GRANT UPDATE (read_at) ON public.mkt_notifications TO authenticated;
GRANT ALL ON public.mkt_report_files, public.mkt_report_status_history, public.mkt_report_messages,
  public.mkt_report_notes, public.mkt_enforcement_actions, public.mkt_account_restrictions,
  public.mkt_appeals, public.mkt_notifications TO service_role;

ALTER TABLE public.mkt_report_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_report_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_report_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_account_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_notifications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER mkt_appeals_touch BEFORE UPDATE ON public.mkt_appeals
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

-- ============ 5) access helpers ============
CREATE OR REPLACE FUNCTION public.mkt_report_conflict(_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_reports r
    WHERE r.id = _report_id
      AND (r.owner_user_id = auth.uid()
        OR (r.tenant_id IS NOT NULL AND public.is_tenant_member(r.tenant_id)))
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_staff_can_view(_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.mkt_staff_has('reports.inbox_view') AND NOT public.mkt_report_conflict(_report_id)
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_is_reporter(_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_reports r WHERE r.id = _report_id AND r.reporter_user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.mkt_report_is_advertiser(_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_reports r
    WHERE r.id = _report_id
      AND (r.owner_user_id = auth.uid()
        OR (r.tenant_id IS NOT NULL AND public.is_tenant_member(r.tenant_id)))
  )
$$;

-- ============ 6) policies ============
CREATE POLICY "reports readable by reporter or staff" ON public.mkt_reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid() OR public.mkt_report_staff_can_view(id));

CREATE POLICY "report files readable by party" ON public.mkt_report_files
  FOR SELECT TO authenticated USING (
    public.mkt_report_staff_can_view(report_id)
    OR (side = 'reporter' AND public.mkt_report_is_reporter(report_id))
    OR (side = 'advertiser' AND public.mkt_report_is_advertiser(report_id))
  );
CREATE POLICY "report files uploaded by party" ON public.mkt_report_files
  FOR INSERT TO authenticated WITH CHECK (
    uploaded_by = auth.uid() AND (
      (side = 'reporter' AND public.mkt_report_is_reporter(report_id))
      OR (side = 'advertiser' AND public.mkt_report_is_advertiser(report_id))
      OR (side = 'staff' AND public.mkt_staff_has('reports.review'))
    )
  );

CREATE POLICY "status history staff read" ON public.mkt_report_status_history
  FOR SELECT TO authenticated USING (public.mkt_report_staff_can_view(report_id));

CREATE POLICY "messages readable in own channel" ON public.mkt_report_messages
  FOR SELECT TO authenticated USING (
    public.mkt_report_staff_can_view(report_id)
    OR (channel = 'reporter' AND public.mkt_report_is_reporter(report_id))
    OR (channel = 'advertiser' AND public.mkt_report_is_advertiser(report_id))
  );

CREATE POLICY "internal notes staff only" ON public.mkt_report_notes
  FOR SELECT TO authenticated
  USING (public.mkt_staff_has('reports.add_internal_note') AND NOT public.mkt_report_conflict(report_id));

CREATE POLICY "enforcement visible to staff and subject" ON public.mkt_enforcement_actions
  FOR SELECT TO authenticated USING (
    public.mkt_staff_has('reports.audit_view')
    OR (target_type = 'user' AND target_id = auth.uid())
    OR (target_type = 'business' AND public.is_tenant_member(target_id))
    OR (target_type = 'listing' AND public.mkt_can_manage_listing(target_id))
  );

CREATE POLICY "restrictions visible to staff and subject" ON public.mkt_account_restrictions
  FOR SELECT TO authenticated USING (
    public.mkt_staff_has('reports.audit_view')
    OR (subject_type = 'user' AND subject_id = auth.uid())
    OR (subject_type = 'business' AND public.is_tenant_member(subject_id))
  );

CREATE POLICY "appeals visible to owner and reviewers" ON public.mkt_appeals
  FOR SELECT TO authenticated USING (
    submitted_by = auth.uid()
    OR public.mkt_report_is_advertiser(report_id)
    OR (public.mkt_staff_has('appeals.review') AND NOT public.mkt_report_conflict(report_id))
  );

CREATE POLICY "own notifications" ON public.mkt_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mark own notifications read" ON public.mkt_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ 7) notification helper ============
CREATE OR REPLACE FUNCTION public.mkt_notify(_user_id uuid, _report_id uuid, _event text, _title text, _body text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.mkt_notifications (user_id, report_id, event, title, body)
  VALUES (_user_id, _report_id, _event, _title, _body);
END;
$$;
REVOKE ALL ON FUNCTION public.mkt_notify(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_notify(uuid, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.mkt_notify(uuid, uuid, text, text, text) FROM authenticated;
