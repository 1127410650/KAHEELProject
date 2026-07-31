-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('accountant', 'employee');
CREATE TYPE public.app_locale AS ENUM ('ar', 'en');
CREATE TYPE public.custody_txn_type AS ENUM ('add', 'settlement', 'deduction', 'refund', 'reversal');
CREATE TYPE public.record_status AS ENUM ('draft', 'under_review', 'returned', 'approved', 'cancelled');
CREATE TYPE public.project_status AS ENUM ('active', 'on_hold', 'completed', 'cancelled');

-- ============ COMMON FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  locale public.app_locale NOT NULL DEFAULT 'ar',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'accountant');
$$;

-- profiles policies
CREATE POLICY "profiles_select_self_or_accountant" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_accountant());
CREATE POLICY "profiles_update_self_or_accountant" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_accountant())
  WITH CHECK (user_id = auth.uid() OR public.is_accountant());
CREATE POLICY "profiles_insert_accountant" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_accountant());

-- user_roles policies
CREATE POLICY "user_roles_select_self_or_accountant" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_accountant());
CREATE POLICY "user_roles_manage_accountant" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_accountant()) WITH CHECK (public.is_accountant());

-- auto profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  IF lower(COALESCE(NEW.email, '')) = 'o11339911@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'accountant') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SUPERVISORS ============
CREATE TABLE public.supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  national_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  notes_ar TEXT,
  notes_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  delete_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supervisors_delete_reason_chk CHECK (deleted_at IS NULL OR (delete_reason IS NOT NULL AND length(btrim(delete_reason)) > 0))
);
GRANT SELECT, INSERT, UPDATE ON public.supervisors TO authenticated;
GRANT ALL ON public.supervisors TO service_role;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER supervisors_updated_at BEFORE UPDATE ON public.supervisors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  code TEXT NOT NULL UNIQUE,
  supervisor_id UUID NOT NULL REFERENCES public.supervisors(id) ON DELETE RESTRICT,
  description_ar TEXT,
  description_en TEXT,
  status public.project_status NOT NULL DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  delete_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_delete_reason_chk CHECK (deleted_at IS NULL OR (delete_reason IS NOT NULL AND length(btrim(delete_reason)) > 0))
);
GRANT SELECT, INSERT, UPDATE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROJECT SUPERVISORS (many to many) ============
CREATE TABLE public.project_supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.supervisors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, supervisor_id)
);
GRANT SELECT, INSERT, DELETE ON public.project_supervisors TO authenticated;
GRANT ALL ON public.project_supervisors TO service_role;
ALTER TABLE public.project_supervisors ENABLE ROW LEVEL SECURITY;

-- ============ PROJECT MEMBERS (access control) ============
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_project(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'accountant')
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = _project_id AND pm.user_id = auth.uid());
$$;

CREATE POLICY "supervisors_select_authenticated" ON public.supervisors FOR SELECT TO authenticated USING (true);
CREATE POLICY "supervisors_insert_accountant" ON public.supervisors FOR INSERT TO authenticated WITH CHECK (public.is_accountant());
CREATE POLICY "supervisors_update_accountant" ON public.supervisors FOR UPDATE TO authenticated USING (public.is_accountant()) WITH CHECK (public.is_accountant());

CREATE POLICY "projects_select_allowed" ON public.projects FOR SELECT TO authenticated USING (public.can_access_project(id));
CREATE POLICY "projects_insert_accountant" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_accountant());
CREATE POLICY "projects_update_accountant" ON public.projects FOR UPDATE TO authenticated USING (public.is_accountant()) WITH CHECK (public.is_accountant());

CREATE POLICY "project_supervisors_select" ON public.project_supervisors FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY "project_supervisors_manage" ON public.project_supervisors FOR ALL TO authenticated USING (public.is_accountant()) WITH CHECK (public.is_accountant());

CREATE POLICY "project_members_select" ON public.project_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_accountant());
CREATE POLICY "project_members_manage" ON public.project_members FOR ALL TO authenticated USING (public.is_accountant()) WITH CHECK (public.is_accountant());

-- ============ CUSTODY TRANSACTIONS ============
CREATE SEQUENCE public.custody_serial_seq START 1;

CREATE TABLE public.custody_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no BIGINT NOT NULL DEFAULT nextval('public.custody_serial_seq') UNIQUE,
  supervisor_id UUID NOT NULL REFERENCES public.supervisors(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  txn_type public.custody_txn_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  txn_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Riyadh')::date,
  status public.record_status NOT NULL DEFAULT 'draft',
  notes_ar TEXT,
  notes_en TEXT,
  reason TEXT,
  reversal_of_id UUID REFERENCES public.custody_transactions(id) ON DELETE RESTRICT,
  client_token TEXT UNIQUE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  delete_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custody_reversal_reason_chk CHECK (txn_type <> 'reversal' OR (reason IS NOT NULL AND length(btrim(reason)) > 0 AND reversal_of_id IS NOT NULL)),
  CONSTRAINT custody_delete_reason_chk CHECK (deleted_at IS NULL OR (delete_reason IS NOT NULL AND length(btrim(delete_reason)) > 0))
);
GRANT SELECT, INSERT, UPDATE ON public.custody_transactions TO authenticated;
GRANT ALL ON public.custody_transactions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.custody_serial_seq TO authenticated, service_role;
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX custody_supervisor_idx ON public.custody_transactions(supervisor_id);
CREATE INDEX custody_project_idx ON public.custody_transactions(project_id);
CREATE UNIQUE INDEX custody_one_reversal_idx ON public.custody_transactions(reversal_of_id) WHERE reversal_of_id IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER custody_updated_at BEFORE UPDATE ON public.custody_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- lock approved transactions
CREATE OR REPLACE FUNCTION public.lock_approved_custody()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Hard delete is not allowed on custody transactions';
  END IF;
  IF OLD.status = 'approved' THEN
    IF NEW.status = 'approved'
       AND NEW.amount IS NOT DISTINCT FROM OLD.amount
       AND NEW.txn_type IS NOT DISTINCT FROM OLD.txn_type
       AND NEW.supervisor_id IS NOT DISTINCT FROM OLD.supervisor_id
       AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
       AND NEW.txn_date IS NOT DISTINCT FROM OLD.txn_date
       AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Approved custody transactions cannot be modified or deleted; create a reversal entry instead';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER custody_lock_approved BEFORE UPDATE OR DELETE ON public.custody_transactions
FOR EACH ROW EXECUTE FUNCTION public.lock_approved_custody();

CREATE POLICY "custody_select_allowed" ON public.custody_transactions FOR SELECT TO authenticated
  USING (public.is_accountant() OR (project_id IS NOT NULL AND public.can_access_project(project_id)));
CREATE POLICY "custody_insert_allowed" ON public.custody_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_accountant() OR (project_id IS NOT NULL AND public.can_access_project(project_id) AND status = 'draft'));
CREATE POLICY "custody_update_accountant" ON public.custody_transactions FOR UPDATE TO authenticated
  USING (public.is_accountant() OR (created_by = auth.uid() AND status IN ('draft','returned')))
  WITH CHECK (public.is_accountant() OR (created_by = auth.uid() AND status IN ('draft','under_review')));

-- balances view (approved only)
CREATE VIEW public.custody_balances WITH (security_invoker = true) AS
SELECT
  s.id AS supervisor_id,
  s.name_ar,
  s.name_en,
  COALESCE(SUM(CASE WHEN t.txn_type = 'add' THEN t.amount
                    WHEN t.txn_type IN ('settlement','deduction','refund') THEN -t.amount
                    WHEN t.txn_type = 'reversal' THEN -t.amount
                    ELSE 0 END), 0)::NUMERIC(14,2) AS balance
FROM public.supervisors s
LEFT JOIN public.custody_transactions t
  ON t.supervisor_id = s.id AND t.status = 'approved' AND t.deleted_at IS NULL
GROUP BY s.id, s.name_ar, s.name_en;
GRANT SELECT ON public.custody_balances TO authenticated, service_role;

-- ============ ATTACHMENTS ============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  deleted_at TIMESTAMPTZ,
  delete_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attachments_delete_reason_chk CHECK (deleted_at IS NULL OR (delete_reason IS NOT NULL AND length(btrim(delete_reason)) > 0))
);
GRANT SELECT, INSERT, UPDATE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_select_allowed" ON public.attachments FOR SELECT TO authenticated
  USING (public.is_accountant() OR (project_id IS NOT NULL AND public.can_access_project(project_id)));
CREATE POLICY "attachments_insert_allowed" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_accountant() OR (project_id IS NOT NULL AND public.can_access_project(project_id)));
CREATE POLICY "attachments_update_accountant" ON public.attachments FOR UPDATE TO authenticated
  USING (public.is_accountant()) WITH CHECK (public.is_accountant());

-- ============ AUDIT LOG (append only) ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_accountant" ON public.audit_log FOR SELECT TO authenticated USING (public.is_accountant());
CREATE POLICY "audit_insert_authenticated" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Audit log is immutable'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- ============ SETTINGS ============
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_manage_accountant" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_accountant()) WITH CHECK (public.is_accountant());

INSERT INTO public.app_settings (key, value) VALUES
  ('currency', '"SAR"'::jsonb),
  ('timezone', '"Asia/Riyadh"'::jsonb),
  ('default_locale', '"ar"'::jsonb),
  ('date_format', '"DD/MM/YYYY"'::jsonb),
  ('app_name', '{"ar":"تحقّق","en":"Tahqaq"}'::jsonb);

-- storage bucket is created separately with the storage tool