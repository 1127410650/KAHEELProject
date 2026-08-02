-- =============================================================
-- Public B2B Marketplace — Phase 1 schema (mkt_* layer)
-- Reuses existing tenants / tenant_memberships / profiles.
-- Does NOT touch any accounting, custody, invoice or request tables.
-- =============================================================

CREATE TABLE public.mkt_platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.mkt_platform_admins TO authenticated;
GRANT ALL ON public.mkt_platform_admins TO service_role;
ALTER TABLE public.mkt_platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mkt_is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_platform_admins a WHERE a.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.mkt_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_is_platform_admin() TO authenticated, service_role;

CREATE POLICY mkt_platform_admins_select ON public.mkt_platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public.mkt_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.mkt_slugify(_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_text,'')), '[^a-z0-9\u0600-\u06FF]+', '-', 'g'))
$$;
REVOKE ALL ON FUNCTION public.mkt_slugify(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_slugify(text) TO authenticated, service_role;

CREATE TABLE public.mkt_listing_types (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_request boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_listing_types TO anon, authenticated;
GRANT ALL ON public.mkt_listing_types TO service_role;
ALTER TABLE public.mkt_listing_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_listing_types_public_read ON public.mkt_listing_types
  FOR SELECT TO anon USING (is_active);
CREATE POLICY mkt_listing_types_auth_read ON public.mkt_listing_types
  FOR SELECT TO authenticated USING (is_active OR public.mkt_is_platform_admin());
CREATE POLICY mkt_listing_types_admin_write ON public.mkt_listing_types
  FOR ALL TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE TRIGGER mkt_listing_types_touch BEFORE UPDATE ON public.mkt_listing_types
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

INSERT INTO public.mkt_listing_types (code, name_ar, name_en, is_request, sort_order) VALUES
  ('service',        'خدمة',                    'Service',              false, 1),
  ('product',        'منتج أو مادة',            'Product / Material',   false, 2),
  ('equipment_sale', 'معدات وآليات للبيع',      'Equipment for sale',   false, 3),
  ('equipment_rent', 'معدات وآليات للتأجير',    'Equipment for rent',   false, 4),
  ('need_supplier',  'مطلوب مورد',              'Supplier wanted',      true,  5),
  ('need_contractor','مطلوب مقاول أو مقدم خدمة','Contractor wanted',    true,  6);

CREATE TABLE public.mkt_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.mkt_categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_categories_parent_idx ON public.mkt_categories(parent_id) WHERE is_active;
GRANT SELECT ON public.mkt_categories TO anon, authenticated;
GRANT ALL ON public.mkt_categories TO service_role;
ALTER TABLE public.mkt_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_categories_public_read ON public.mkt_categories
  FOR SELECT TO anon USING (is_active);
CREATE POLICY mkt_categories_auth_read ON public.mkt_categories
  FOR SELECT TO authenticated USING (is_active OR public.mkt_is_platform_admin());
CREATE POLICY mkt_categories_admin_write ON public.mkt_categories
  FOR ALL TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE TRIGGER mkt_categories_touch BEFORE UPDATE ON public.mkt_categories
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

INSERT INTO public.mkt_categories (slug, name_ar, name_en, icon, sort_order) VALUES
  ('general-contracting','المقاولات العامة','General contracting','hard-hat',1),
  ('finishing','التشطيبات','Finishing','paintbrush',2),
  ('electrical','الكهرباء','Electrical','zap',3),
  ('plumbing','السباكة','Plumbing','droplets',4),
  ('hvac','التكييف','HVAC','wind',5),
  ('building-materials','مواد البناء','Building materials','bricks',6),
  ('equipment','المعدات والآليات','Equipment & machinery','truck',7),
  ('logistics','النقل والخدمات اللوجستية','Transport & logistics','package',8),
  ('maintenance','الصيانة والتشغيل','Maintenance & operations','wrench',9),
  ('real-estate','العقارات','Real estate','building-2',10),
  ('professional','الخدمات المهنية','Professional services','briefcase',11),
  ('safety','الأمن والسلامة','Security & safety','shield-check',12),
  ('factories','المصانع والتوريد','Factories & supply','factory',13);

CREATE TABLE public.mkt_business_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name_ar text NOT NULL,
  display_name_en text,
  headline text,
  about text,
  logo_url text,
  city text,
  region text,
  categories uuid[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  verified_at timestamptz,
  verified_by uuid,
  verification_note text,
  show_phone boolean NOT NULL DEFAULT false,
  show_email boolean NOT NULL DEFAULT false,
  show_whatsapp boolean NOT NULL DEFAULT false,
  public_phone text,
  public_email text,
  public_whatsapp text,
  public_website text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_business_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_business_profiles TO authenticated;
GRANT ALL ON public.mkt_business_profiles TO service_role;
ALTER TABLE public.mkt_business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_business_profiles_public_read ON public.mkt_business_profiles
  FOR SELECT TO anon USING (is_published);
CREATE POLICY mkt_business_profiles_auth_read ON public.mkt_business_profiles
  FOR SELECT TO authenticated
  USING (is_published OR public.is_tenant_member(tenant_id) OR public.mkt_is_platform_admin());
CREATE POLICY mkt_business_profiles_member_insert ON public.mkt_business_profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY mkt_business_profiles_member_update ON public.mkt_business_profiles
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id) OR public.mkt_is_platform_admin())
  WITH CHECK (public.is_tenant_member(tenant_id) OR public.mkt_is_platform_admin());
CREATE TRIGGER mkt_business_profiles_touch BEFORE UPDATE ON public.mkt_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

CREATE OR REPLACE FUNCTION public.mkt_guard_business_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    IF NOT public.mkt_is_platform_admin() THEN
      IF NOT (OLD.verification_status IN ('unverified','rejected') AND NEW.verification_status = 'pending') THEN
        RAISE EXCEPTION 'Only platform admins can change verification status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mkt_business_profiles_verification_guard BEFORE UPDATE ON public.mkt_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mkt_guard_business_verification();

CREATE OR REPLACE FUNCTION public.mkt_is_verified_business(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_business_profiles b
    WHERE b.tenant_id = _tenant_id AND b.verification_status = 'verified'
  )
$$;
REVOKE ALL ON FUNCTION public.mkt_is_verified_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_is_verified_business(uuid) TO authenticated, service_role;

CREATE TABLE public.mkt_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  type_code text NOT NULL REFERENCES public.mkt_listing_types(code),
  category_id uuid NOT NULL REFERENCES public.mkt_categories(id),
  subcategory_id uuid REFERENCES public.mkt_categories(id),
  title text NOT NULL,
  summary text,
  description text,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric(14,2),
  price_on_request boolean NOT NULL DEFAULT true,
  price_unit text,
  currency text NOT NULL DEFAULT 'SAR',
  quantity numeric(14,2),
  unit text,
  item_condition text CHECK (item_condition IN ('new','used')),
  deal_kind text CHECK (deal_kind IN ('sale','rent')),
  city text,
  region text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','published','rejected','suspended','expired','archived','deleted')),
  rejection_reason text,
  published_at timestamptz,
  expires_at timestamptz,
  views_count int NOT NULL DEFAULT 0,
  contact_requests_count int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_listings_public_idx ON public.mkt_listings(status, published_at DESC);
CREATE INDEX mkt_listings_category_idx ON public.mkt_listings(category_id);
CREATE INDEX mkt_listings_tenant_idx ON public.mkt_listings(tenant_id);
CREATE INDEX mkt_listings_owner_idx ON public.mkt_listings(owner_user_id);
CREATE INDEX mkt_listings_search_idx ON public.mkt_listings USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(description,'')));

GRANT SELECT ON public.mkt_listings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_listings TO authenticated;
GRANT ALL ON public.mkt_listings TO service_role;
ALTER TABLE public.mkt_listings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mkt_listing_is_public(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_listings l
    WHERE l.id = _id AND l.status = 'published' AND l.deleted_at IS NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
  )
$$;
REVOKE ALL ON FUNCTION public.mkt_listing_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_listing_is_public(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mkt_can_manage_listing(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_listings l
    WHERE l.id = _id
      AND (l.owner_user_id = auth.uid()
           OR (l.tenant_id IS NOT NULL AND public.is_tenant_member(l.tenant_id)))
  ) OR public.mkt_is_platform_admin()
$$;
REVOKE ALL ON FUNCTION public.mkt_can_manage_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_can_manage_listing(uuid) TO authenticated, service_role;

CREATE POLICY mkt_listings_public_read ON public.mkt_listings
  FOR SELECT TO anon
  USING (status = 'published' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY mkt_listings_auth_read ON public.mkt_listings
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
    OR owner_user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
    OR public.mkt_is_platform_admin()
  );
CREATE POLICY mkt_listings_owner_insert ON public.mkt_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND status IN ('draft','pending')
    AND (tenant_id IS NULL OR (public.is_tenant_member(tenant_id) AND public.mkt_is_verified_business(tenant_id)))
  );
CREATE POLICY mkt_listings_owner_update ON public.mkt_listings
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)) OR public.mkt_is_platform_admin())
  WITH CHECK (owner_user_id = auth.uid() OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)) OR public.mkt_is_platform_admin());

CREATE TRIGGER mkt_listings_touch BEFORE UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

CREATE OR REPLACE FUNCTION public.mkt_listing_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
       AND NEW.status IN ('published','rejected','suspended')
       AND NOT public.mkt_is_platform_admin() THEN
      RAISE EXCEPTION 'Only platform reviewers can set status %', NEW.status;
    END IF;
    IF NEW.status = 'rejected' AND coalesce(btrim(NEW.rejection_reason),'') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mkt_listings_before_write BEFORE INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_before_write();

CREATE TABLE public.mkt_listing_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_listing_status_history_idx ON public.mkt_listing_status_history(listing_id, created_at DESC);
GRANT SELECT ON public.mkt_listing_status_history TO authenticated;
GRANT ALL ON public.mkt_listing_status_history TO service_role;
ALTER TABLE public.mkt_listing_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_listing_status_history_read ON public.mkt_listing_status_history
  FOR SELECT TO authenticated USING (public.mkt_can_manage_listing(listing_id));

CREATE OR REPLACE FUNCTION public.mkt_listing_log_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.mkt_listing_status_history (listing_id, from_status, to_status, reason, actor_id)
    VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
            NEW.rejection_reason, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mkt_listings_log_status AFTER INSERT OR UPDATE ON public.mkt_listings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_listing_log_status();

CREATE TABLE public.mkt_listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  sort_order int NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_listing_images_idx ON public.mkt_listing_images(listing_id, sort_order);
GRANT SELECT ON public.mkt_listing_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_listing_images TO authenticated;
GRANT ALL ON public.mkt_listing_images TO service_role;
ALTER TABLE public.mkt_listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_listing_images_public_read ON public.mkt_listing_images
  FOR SELECT TO anon USING (public.mkt_listing_is_public(listing_id));
CREATE POLICY mkt_listing_images_auth_read ON public.mkt_listing_images
  FOR SELECT TO authenticated
  USING (public.mkt_listing_is_public(listing_id) OR public.mkt_can_manage_listing(listing_id));
CREATE POLICY mkt_listing_images_manage ON public.mkt_listing_images
  FOR ALL TO authenticated
  USING (public.mkt_can_manage_listing(listing_id)) WITH CHECK (public.mkt_can_manage_listing(listing_id));

CREATE OR REPLACE FUNCTION public.mkt_increment_views(_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.mkt_listings
     SET views_count = views_count + 1
   WHERE id = _listing_id AND status = 'published' AND deleted_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.mkt_increment_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_increment_views(uuid) TO anon, authenticated, service_role;

CREATE TABLE public.mkt_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.mkt_listings(id) ON DELETE SET NULL,
  seller_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  seller_user_id uuid,
  buyer_user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  quantity numeric(14,2),
  unit text,
  city text,
  location_note text,
  needed_date date,
  budget numeric(14,2),
  contact_phone text,
  contact_preference text NOT NULL DEFAULT 'in_app'
    CHECK (contact_preference IN ('in_app','phone','whatsapp','email')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','viewed','needs_info','preparing','quoted','accepted','rejected','completed','cancelled')),
  status_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_quote_requests_buyer_idx ON public.mkt_quote_requests(buyer_user_id, created_at DESC);
CREATE INDEX mkt_quote_requests_seller_idx ON public.mkt_quote_requests(seller_tenant_id, created_at DESC);
CREATE INDEX mkt_quote_requests_listing_idx ON public.mkt_quote_requests(listing_id);
GRANT SELECT, INSERT, UPDATE ON public.mkt_quote_requests TO authenticated;
GRANT ALL ON public.mkt_quote_requests TO service_role;
ALTER TABLE public.mkt_quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_quote_requests_read ON public.mkt_quote_requests
  FOR SELECT TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR seller_user_id = auth.uid()
    OR (seller_tenant_id IS NOT NULL AND public.is_tenant_member(seller_tenant_id))
    OR public.mkt_is_platform_admin()
  );
CREATE POLICY mkt_quote_requests_buyer_insert ON public.mkt_quote_requests
  FOR INSERT TO authenticated
  WITH CHECK (buyer_user_id = auth.uid() AND (listing_id IS NULL OR public.mkt_listing_is_public(listing_id)));
CREATE POLICY mkt_quote_requests_update ON public.mkt_quote_requests
  FOR UPDATE TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR seller_user_id = auth.uid()
    OR (seller_tenant_id IS NOT NULL AND public.is_tenant_member(seller_tenant_id))
  )
  WITH CHECK (
    buyer_user_id = auth.uid()
    OR seller_user_id = auth.uid()
    OR (seller_tenant_id IS NOT NULL AND public.is_tenant_member(seller_tenant_id))
  );
CREATE TRIGGER mkt_quote_requests_touch BEFORE UPDATE ON public.mkt_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

CREATE OR REPLACE FUNCTION public.mkt_quote_fill_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.listing_id IS NOT NULL THEN
    SELECT l.tenant_id, l.owner_user_id INTO NEW.seller_tenant_id, NEW.seller_user_id
    FROM public.mkt_listings l WHERE l.id = NEW.listing_id;
    IF NEW.seller_user_id = NEW.buyer_user_id THEN
      RAISE EXCEPTION 'You cannot request a quote from your own listing';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mkt_quote_requests_fill_seller BEFORE INSERT ON public.mkt_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.mkt_quote_fill_seller();

CREATE TABLE public.mkt_quote_request_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.mkt_quote_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mkt_quote_request_files TO authenticated;
GRANT ALL ON public.mkt_quote_request_files TO service_role;
ALTER TABLE public.mkt_quote_request_files ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mkt_can_view_quote(_quote_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_quote_requests q
    WHERE q.id = _quote_id
      AND (q.buyer_user_id = auth.uid() OR q.seller_user_id = auth.uid()
           OR (q.seller_tenant_id IS NOT NULL AND public.is_tenant_member(q.seller_tenant_id)))
  )
$$;
REVOKE ALL ON FUNCTION public.mkt_can_view_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_can_view_quote(uuid) TO authenticated, service_role;

CREATE POLICY mkt_quote_files_read ON public.mkt_quote_request_files
  FOR SELECT TO authenticated USING (public.mkt_can_view_quote(quote_request_id));
CREATE POLICY mkt_quote_files_insert ON public.mkt_quote_request_files
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.mkt_can_view_quote(quote_request_id));

CREATE TABLE public.mkt_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL DEFAULT auth.uid(),
  seller_user_id uuid,
  seller_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_user_id)
);
CREATE INDEX mkt_conversations_buyer_idx ON public.mkt_conversations(buyer_user_id, last_message_at DESC);
CREATE INDEX mkt_conversations_seller_idx ON public.mkt_conversations(seller_tenant_id, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.mkt_conversations TO authenticated;
GRANT ALL ON public.mkt_conversations TO service_role;
ALTER TABLE public.mkt_conversations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mkt_can_view_conversation(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_conversations c
    WHERE c.id = _conversation_id
      AND (c.buyer_user_id = auth.uid() OR c.seller_user_id = auth.uid()
           OR (c.seller_tenant_id IS NOT NULL AND public.is_tenant_member(c.seller_tenant_id)))
  )
$$;
REVOKE ALL ON FUNCTION public.mkt_can_view_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_can_view_conversation(uuid) TO authenticated, service_role;

CREATE POLICY mkt_conversations_read ON public.mkt_conversations
  FOR SELECT TO authenticated USING (public.mkt_can_view_conversation(id));
CREATE POLICY mkt_conversations_insert ON public.mkt_conversations
  FOR INSERT TO authenticated
  WITH CHECK (buyer_user_id = auth.uid() AND public.mkt_listing_is_public(listing_id));
CREATE POLICY mkt_conversations_update ON public.mkt_conversations
  FOR UPDATE TO authenticated
  USING (public.mkt_can_view_conversation(id)) WITH CHECK (public.mkt_can_view_conversation(id));

CREATE OR REPLACE FUNCTION public.mkt_conversation_fill_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT l.tenant_id, l.owner_user_id INTO NEW.seller_tenant_id, NEW.seller_user_id
  FROM public.mkt_listings l WHERE l.id = NEW.listing_id;
  IF NEW.seller_user_id = NEW.buyer_user_id THEN
    RAISE EXCEPTION 'You cannot start a conversation with yourself';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mkt_conversations_fill_seller BEFORE INSERT ON public.mkt_conversations
  FOR EACH ROW EXECUTE FUNCTION public.mkt_conversation_fill_seller();

CREATE TABLE public.mkt_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.mkt_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  attachment_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_messages_conversation_idx ON public.mkt_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.mkt_messages TO authenticated;
GRANT ALL ON public.mkt_messages TO service_role;
ALTER TABLE public.mkt_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_messages_read ON public.mkt_messages
  FOR SELECT TO authenticated USING (public.mkt_can_view_conversation(conversation_id));
CREATE POLICY mkt_messages_insert ON public.mkt_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid() AND public.mkt_can_view_conversation(conversation_id));
CREATE POLICY mkt_messages_update_own ON public.mkt_messages
  FOR UPDATE TO authenticated
  USING (public.mkt_can_view_conversation(conversation_id))
  WITH CHECK (public.mkt_can_view_conversation(conversation_id));

CREATE OR REPLACE FUNCTION public.mkt_message_bump_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.mkt_conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER mkt_messages_bump AFTER INSERT ON public.mkt_messages
  FOR EACH ROW EXECUTE FUNCTION public.mkt_message_bump_conversation();

CREATE TABLE public.mkt_favorites (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.mkt_favorites TO authenticated;
GRANT ALL ON public.mkt_favorites TO service_role;
ALTER TABLE public.mkt_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_favorites_own ON public.mkt_favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.mkt_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.mkt_listings(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
  resolution_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_reports_status_idx ON public.mkt_reports(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.mkt_reports TO authenticated;
GRANT ALL ON public.mkt_reports TO service_role;
ALTER TABLE public.mkt_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_reports_read ON public.mkt_reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid() OR public.mkt_is_platform_admin());
CREATE POLICY mkt_reports_insert ON public.mkt_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid() AND public.mkt_listing_is_public(listing_id));
CREATE POLICY mkt_reports_admin_update ON public.mkt_reports
  FOR UPDATE TO authenticated
  USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE TRIGGER mkt_reports_touch BEFORE UPDATE ON public.mkt_reports
  FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();