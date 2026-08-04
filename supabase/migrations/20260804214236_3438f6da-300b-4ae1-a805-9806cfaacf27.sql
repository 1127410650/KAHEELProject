-- ============================================================
-- Mini-stores & restaurants — batch 1: schema, ownership, RLS
-- ============================================================

-- ---------- ownership / visibility helpers ----------

CREATE OR REPLACE FUNCTION public.mkt_store_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mkt_is_platform_admin()
      OR public.mkt_staff_has('ads.moderation_hide')
      OR public.mkt_staff_has('ads.moderation_suspend')
      OR public.mkt_staff_has('reports.review')
$$;

-- ---------- restaurant / store cuisines (read from DB, not UI) ----------

CREATE TABLE public.mkt_store_cuisines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_store_cuisines TO anon, authenticated;
GRANT ALL ON public.mkt_store_cuisines TO service_role;
ALTER TABLE public.mkt_store_cuisines ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_cuisines_read ON public.mkt_store_cuisines
  FOR SELECT USING (is_active OR public.mkt_store_admin());
CREATE POLICY mkt_store_cuisines_admin ON public.mkt_store_cuisines
  FOR ALL TO authenticated USING (public.mkt_store_admin()) WITH CHECK (public.mkt_store_admin());

INSERT INTO public.mkt_store_cuisines (code, name_ar, name_en, sort_order) VALUES
  ('restaurants','مطاعم','Restaurants',1),
  ('cafes','مقاهي','Cafes',2),
  ('desserts','حلويات','Desserts',3),
  ('bakeries','مخابز','Bakeries',4),
  ('fast_food','وجبات سريعة','Fast food',5),
  ('home_kitchens','مطابخ منزلية','Home kitchens',6),
  ('catering','تموين وحفلات','Catering',7),
  ('juices','عصائر','Juices',8),
  ('ice_cream','آيس كريم','Ice cream',9),
  ('other','أخرى','Other',99);

-- ---------- 1. storefronts ----------

CREATE TABLE public.mkt_storefronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_type text NOT NULL DEFAULT 'retail'
    CHECK (store_type IN ('restaurant','retail','services','mixed')),
  cuisine_id uuid REFERENCES public.mkt_store_cuisines(id),
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  short_description_ar text,
  short_description_en text,
  logo_path text,
  cover_path text,
  country_id uuid REFERENCES public.mkt_countries(id),
  city_id uuid REFERENCES public.mkt_cities(id),
  district text,
  address_text text,
  latitude double precision,
  longitude double precision,
  location_precision text NOT NULL DEFAULT 'approximate'
    CHECK (location_precision IN ('exact','approximate','hidden')),
  public_phone_enabled boolean NOT NULL DEFAULT false,
  chat_enabled boolean NOT NULL DEFAULT true,
  call_enabled boolean NOT NULL DEFAULT false,
  pickup_enabled boolean NOT NULL DEFAULT true,
  merchant_delivery_enabled boolean NOT NULL DEFAULT false,
  platform_delivery_enabled boolean NOT NULL DEFAULT false,
  minimum_order_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  estimated_delivery_minutes_min integer CHECK (estimated_delivery_minutes_min IS NULL OR estimated_delivery_minutes_min >= 0),
  estimated_delivery_minutes_max integer CHECK (estimated_delivery_minutes_max IS NULL OR estimated_delivery_minutes_max >= 0),
  currency_code text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','published','paused','suspended','archived')),
  is_open_manually boolean NOT NULL DEFAULT true,
  accepts_orders boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'none'
    CHECK (verification_status IN ('none','pending','approved','rejected')),
  views_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  suspension_reason text,
  qa_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mkt_storefronts_fulfilment_ck
    CHECK (status <> 'published' OR pickup_enabled OR merchant_delivery_enabled)
);

-- one live storefront per active account (individual = tenant_id IS NULL)
CREATE UNIQUE INDEX mkt_storefronts_one_per_account
  ON public.mkt_storefronts (owner_user_id, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;
CREATE INDEX mkt_storefronts_public_idx ON public.mkt_storefronts (status, city_id) WHERE deleted_at IS NULL;
CREATE INDEX mkt_storefronts_type_idx ON public.mkt_storefronts (store_type) WHERE deleted_at IS NULL;

GRANT SELECT ON public.mkt_storefronts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_storefronts TO authenticated;
GRANT ALL ON public.mkt_storefronts TO service_role;
ALTER TABLE public.mkt_storefronts ENABLE ROW LEVEL SECURITY;

-- ---------- ownership helpers (need the table to exist) ----------

CREATE OR REPLACE FUNCTION public.mkt_store_manage(_storefront_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_storefronts s
    WHERE s.id = _storefront_id
      AND s.deleted_at IS NULL
      AND (
        (s.tenant_id IS NULL AND s.owner_user_id = auth.uid())
        OR (s.tenant_id IS NOT NULL AND public.is_tenant_member(s.tenant_id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_store_visible(_storefront_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_storefronts s
    WHERE s.id = _storefront_id AND s.deleted_at IS NULL AND s.status = 'published'
  )
$$;

-- storefront policies
CREATE POLICY mkt_storefronts_public_read ON public.mkt_storefronts
  FOR SELECT USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY mkt_storefronts_owner_read ON public.mkt_storefronts
  FOR SELECT TO authenticated USING (
    (tenant_id IS NULL AND owner_user_id = auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
    OR public.mkt_store_admin()
  );
CREATE POLICY mkt_storefronts_owner_insert ON public.mkt_storefronts
  FOR INSERT TO authenticated WITH CHECK (
    owner_user_id = auth.uid()
    AND status IN ('draft','pending_review')
    AND (tenant_id IS NULL OR public.mkt_can_publish_as_business(tenant_id))
  );
CREATE POLICY mkt_storefronts_owner_update ON public.mkt_storefronts
  FOR UPDATE TO authenticated USING (
    (tenant_id IS NULL AND owner_user_id = auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  ) WITH CHECK (
    (tenant_id IS NULL AND owner_user_id = auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );
CREATE POLICY mkt_storefronts_admin_update ON public.mkt_storefronts
  FOR UPDATE TO authenticated USING (public.mkt_store_admin()) WITH CHECK (public.mkt_store_admin());

-- ---------- 1b. private store data (phone, delivery permit) ----------

CREATE TABLE public.mkt_store_private (
  storefront_id uuid PRIMARY KEY REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  contact_phone text,
  delivery_phone text,
  delivery_declaration_accepted_at timestamptz,
  delivery_permit_number text,
  delivery_permit_expires_on date,
  delivery_permit_doc_path text,
  permit_review_status text NOT NULL DEFAULT 'not_submitted'
    CHECK (permit_review_status IN ('not_submitted','pending','approved','rejected')),
  permit_review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_private TO authenticated;
GRANT ALL ON public.mkt_store_private TO service_role;
ALTER TABLE public.mkt_store_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_private_owner ON public.mkt_store_private
  FOR ALL TO authenticated
  USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_manage(storefront_id));

-- public phone: only exposed when the owner opted in
CREATE OR REPLACE FUNCTION public.mkt_store_public_phone(_storefront_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.contact_phone
  FROM public.mkt_storefronts s
  JOIN public.mkt_store_private p ON p.storefront_id = s.id
  WHERE s.id = _storefront_id
    AND s.deleted_at IS NULL
    AND s.status = 'published'
    AND s.public_phone_enabled
$$;
GRANT EXECUTE ON FUNCTION public.mkt_store_public_phone(uuid) TO anon, authenticated;

-- ---------- 2. branches ----------

CREATE TABLE public.mkt_store_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'الفرع الرئيسي',
  country_id uuid REFERENCES public.mkt_countries(id),
  city_id uuid REFERENCES public.mkt_cities(id),
  district text,
  address_text text,
  latitude double precision,
  longitude double precision,
  public_phone text,
  pickup_enabled boolean NOT NULL DEFAULT true,
  delivery_enabled boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX mkt_store_branches_one_primary
  ON public.mkt_store_branches (storefront_id) WHERE is_primary AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.mkt_store_branch_manage(_branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_store_branches b
    WHERE b.id = _branch_id AND public.mkt_store_manage(b.storefront_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_store_branch_visible(_branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_store_branches b
    WHERE b.id = _branch_id AND public.mkt_store_visible(b.storefront_id)
  )
$$;

GRANT SELECT ON public.mkt_store_branches TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_branches TO authenticated;
GRANT ALL ON public.mkt_store_branches TO service_role;
ALTER TABLE public.mkt_store_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_branches_public_read ON public.mkt_store_branches
  FOR SELECT USING (deleted_at IS NULL AND status = 'active' AND public.mkt_store_visible(storefront_id));
CREATE POLICY mkt_store_branches_owner ON public.mkt_store_branches
  FOR ALL TO authenticated
  USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_manage(storefront_id));

-- ---------- 3. sections ----------

CREATE TABLE public.mkt_store_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  description_en text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX mkt_store_sections_store_idx ON public.mkt_store_sections (storefront_id, sort_order) WHERE deleted_at IS NULL;
GRANT SELECT ON public.mkt_store_sections TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_sections TO authenticated;
GRANT ALL ON public.mkt_store_sections TO service_role;
ALTER TABLE public.mkt_store_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_sections_public_read ON public.mkt_store_sections
  FOR SELECT USING (deleted_at IS NULL AND is_active AND public.mkt_store_visible(storefront_id));
CREATE POLICY mkt_store_sections_owner ON public.mkt_store_sections
  FOR ALL TO authenticated
  USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_manage(storefront_id));

-- ---------- 4. items ----------

CREATE TABLE public.mkt_store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.mkt_store_sections(id) ON DELETE SET NULL,
  item_type text NOT NULL DEFAULT 'product'
    CHECK (item_type IN ('food','drink','product','service','package')),
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  description_en text,
  base_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  compare_at_price numeric(12,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  currency_code text NOT NULL DEFAULT 'SAR',
  image_path text,
  preparation_minutes integer CHECK (preparation_minutes IS NULL OR preparation_minutes >= 0),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  stock_quantity integer,
  track_inventory boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  allow_notes boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  source_listing_id uuid REFERENCES public.mkt_listings(id) ON DELETE SET NULL,
  qa_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
-- one published listing per source item (no duplicate ads from the same product)
CREATE UNIQUE INDEX mkt_store_items_one_listing
  ON public.mkt_store_items (source_listing_id) WHERE source_listing_id IS NOT NULL;
CREATE INDEX mkt_store_items_store_idx ON public.mkt_store_items (storefront_id, section_id, sort_order) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.mkt_store_item_manage(_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_store_items i
    WHERE i.id = _item_id AND public.mkt_store_manage(i.storefront_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.mkt_store_item_visible(_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_store_items i
    WHERE i.id = _item_id AND i.deleted_at IS NULL AND public.mkt_store_visible(i.storefront_id)
  )
$$;

GRANT SELECT ON public.mkt_store_items TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_items TO authenticated;
GRANT ALL ON public.mkt_store_items TO service_role;
ALTER TABLE public.mkt_store_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_items_public_read ON public.mkt_store_items
  FOR SELECT USING (deleted_at IS NULL AND public.mkt_store_visible(storefront_id));
CREATE POLICY mkt_store_items_owner ON public.mkt_store_items
  FOR ALL TO authenticated
  USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_manage(storefront_id));

-- ---------- 5. variants ----------

CREATE TABLE public.mkt_store_item_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.mkt_store_items(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  price_delta numeric(12,2) NOT NULL DEFAULT 0,
  fixed_price numeric(12,2) CHECK (fixed_price IS NULL OR fixed_price >= 0),
  stock_quantity integer,
  is_available boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX mkt_store_item_variants_item_idx ON public.mkt_store_item_variants (item_id, sort_order) WHERE deleted_at IS NULL;
GRANT SELECT ON public.mkt_store_item_variants TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_item_variants TO authenticated;
GRANT ALL ON public.mkt_store_item_variants TO service_role;
ALTER TABLE public.mkt_store_item_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_item_variants_public_read ON public.mkt_store_item_variants
  FOR SELECT USING (deleted_at IS NULL AND public.mkt_store_item_visible(item_id));
CREATE POLICY mkt_store_item_variants_owner ON public.mkt_store_item_variants
  FOR ALL TO authenticated
  USING (public.mkt_store_item_manage(item_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_item_manage(item_id));

-- ---------- 6. addon groups ----------

CREATE TABLE public.mkt_store_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.mkt_store_items(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  selection_type text NOT NULL DEFAULT 'single' CHECK (selection_type IN ('single','multiple')),
  minimum_choices smallint NOT NULL DEFAULT 0 CHECK (minimum_choices >= 0),
  maximum_choices smallint CHECK (maximum_choices IS NULL OR maximum_choices >= 1),
  is_required boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX mkt_store_addon_groups_item_idx ON public.mkt_store_addon_groups (item_id, sort_order) WHERE deleted_at IS NULL;
GRANT SELECT ON public.mkt_store_addon_groups TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_addon_groups TO authenticated;
GRANT ALL ON public.mkt_store_addon_groups TO service_role;
ALTER TABLE public.mkt_store_addon_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_addon_groups_public_read ON public.mkt_store_addon_groups
  FOR SELECT USING (deleted_at IS NULL AND public.mkt_store_item_visible(item_id));
CREATE POLICY mkt_store_addon_groups_owner ON public.mkt_store_addon_groups
  FOR ALL TO authenticated
  USING (public.mkt_store_item_manage(item_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_item_manage(item_id));

-- ---------- 7. addons ----------

CREATE TABLE public.mkt_store_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_group_id uuid NOT NULL REFERENCES public.mkt_store_addon_groups(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  price_delta numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  is_available boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX mkt_store_addons_group_idx ON public.mkt_store_addons (addon_group_id, sort_order) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.mkt_store_addon_group_manage(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_store_addon_groups g
    WHERE g.id = _group_id AND public.mkt_store_item_manage(g.item_id)
  )
$$;
CREATE OR REPLACE FUNCTION public.mkt_store_addon_group_visible(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_store_addon_groups g
    WHERE g.id = _group_id AND g.deleted_at IS NULL AND public.mkt_store_item_visible(g.item_id)
  )
$$;

GRANT SELECT ON public.mkt_store_addons TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_addons TO authenticated;
GRANT ALL ON public.mkt_store_addons TO service_role;
ALTER TABLE public.mkt_store_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_addons_public_read ON public.mkt_store_addons
  FOR SELECT USING (deleted_at IS NULL AND public.mkt_store_addon_group_visible(addon_group_id));
CREATE POLICY mkt_store_addons_owner ON public.mkt_store_addons
  FOR ALL TO authenticated
  USING (public.mkt_store_addon_group_manage(addon_group_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_addon_group_manage(addon_group_id));

-- ---------- 8. opening hours ----------

CREATE TABLE public.mkt_store_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.mkt_store_branches(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_closed boolean NOT NULL DEFAULT false,
  opens_at time,
  closes_at time,
  second_opens_at time,
  second_closes_at time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, weekday)
);
GRANT SELECT ON public.mkt_store_hours TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_hours TO authenticated;
GRANT ALL ON public.mkt_store_hours TO service_role;
ALTER TABLE public.mkt_store_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_hours_public_read ON public.mkt_store_hours
  FOR SELECT USING (public.mkt_store_branch_visible(branch_id));
CREATE POLICY mkt_store_hours_owner ON public.mkt_store_hours
  FOR ALL TO authenticated
  USING (public.mkt_store_branch_manage(branch_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_branch_manage(branch_id));

-- ---------- 9. delivery zones ----------

CREATE TABLE public.mkt_store_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.mkt_store_branches(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.mkt_cities(id),
  district text,
  radius_km numeric(6,2) CHECK (radius_km IS NULL OR radius_km > 0),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  minimum_order_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  estimated_minutes_min integer CHECK (estimated_minutes_min IS NULL OR estimated_minutes_min >= 0),
  estimated_minutes_max integer CHECK (estimated_minutes_max IS NULL OR estimated_minutes_max >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_store_delivery_zones_branch_idx ON public.mkt_store_delivery_zones (branch_id) WHERE is_active;
GRANT SELECT ON public.mkt_store_delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_store_delivery_zones TO authenticated;
GRANT ALL ON public.mkt_store_delivery_zones TO service_role;
ALTER TABLE public.mkt_store_delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_delivery_zones_public_read ON public.mkt_store_delivery_zones
  FOR SELECT USING (is_active AND public.mkt_store_branch_visible(branch_id));
CREATE POLICY mkt_store_delivery_zones_owner ON public.mkt_store_delivery_zones
  FOR ALL TO authenticated
  USING (public.mkt_store_branch_manage(branch_id) OR public.mkt_store_admin())
  WITH CHECK (public.mkt_store_branch_manage(branch_id));

-- ---------- 10. carts ----------

CREATE TABLE public.mkt_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id uuid NOT NULL DEFAULT auth.uid(),
  active_account_id text,
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.mkt_store_branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ordered','abandoned')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- one open cart per customer: items from two stores can never mix
CREATE UNIQUE INDEX mkt_carts_one_open ON public.mkt_carts (customer_user_id) WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.mkt_cart_owner(_cart_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.mkt_carts c WHERE c.id = _cart_id AND c.customer_user_id = auth.uid())
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_carts TO authenticated;
GRANT ALL ON public.mkt_carts TO service_role;
ALTER TABLE public.mkt_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_carts_owner ON public.mkt_carts
  FOR ALL TO authenticated
  USING (customer_user_id = auth.uid())
  WITH CHECK (customer_user_id = auth.uid());

-- ---------- 11. cart items ----------

CREATE TABLE public.mkt_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.mkt_carts(id) ON DELETE CASCADE,
  store_item_id uuid NOT NULL REFERENCES public.mkt_store_items(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.mkt_store_item_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  unit_price_snapshot numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price_snapshot >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_cart_items_cart_idx ON public.mkt_cart_items (cart_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cart_items TO authenticated;
GRANT ALL ON public.mkt_cart_items TO service_role;
ALTER TABLE public.mkt_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_cart_items_owner ON public.mkt_cart_items
  FOR ALL TO authenticated
  USING (public.mkt_cart_owner(cart_id)) WITH CHECK (public.mkt_cart_owner(cart_id));

-- ---------- 12. cart item addons ----------

CREATE TABLE public.mkt_cart_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_item_id uuid NOT NULL REFERENCES public.mkt_cart_items(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.mkt_store_addons(id) ON DELETE CASCADE,
  addon_price_snapshot numeric(12,2) NOT NULL DEFAULT 0 CHECK (addon_price_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_item_id, addon_id)
);
CREATE OR REPLACE FUNCTION public.mkt_cart_item_owner(_cart_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_cart_items ci
    JOIN public.mkt_carts c ON c.id = ci.cart_id
    WHERE ci.id = _cart_item_id AND c.customer_user_id = auth.uid()
  )
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_cart_item_addons TO authenticated;
GRANT ALL ON public.mkt_cart_item_addons TO service_role;
ALTER TABLE public.mkt_cart_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_cart_item_addons_owner ON public.mkt_cart_item_addons
  FOR ALL TO authenticated
  USING (public.mkt_cart_item_owner(cart_item_id)) WITH CHECK (public.mkt_cart_item_owner(cart_item_id));

-- ---------- 13. orders ----------

CREATE SEQUENCE public.mkt_order_number_seq START 1000;

CREATE TABLE public.mkt_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.mkt_store_branches(id) ON DELETE SET NULL,
  customer_user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_account_id text,
  merchant_account_id text,
  merchant_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  merchant_user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('pickup','merchant_delivery')),
  payment_method text NOT NULL DEFAULT 'cash_on_pickup'
    CHECK (payment_method IN ('cash_on_delivery','cash_on_pickup','bank_transfer_after_confirmation')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','refunded','failed')),
  payment_provider text,
  payment_reference text,
  order_status text NOT NULL DEFAULT 'draft'
    CHECK (order_status IN ('draft','submitted','accepted','preparing','ready','out_for_delivery','completed','rejected','cancelled')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency_code text NOT NULL DEFAULT 'SAR',
  customer_name_snapshot text,
  customer_phone_snapshot text,
  share_phone_with_merchant boolean NOT NULL DEFAULT false,
  delivery_city_id uuid REFERENCES public.mkt_cities(id),
  delivery_district text,
  delivery_address_text text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  location_precision text NOT NULL DEFAULT 'approximate'
    CHECK (location_precision IN ('exact','approximate','hidden')),
  customer_notes text,
  merchant_notes text,
  conversation_id uuid REFERENCES public.mkt_conversations(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  qa_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mkt_orders_idempotency ON public.mkt_orders (customer_user_id, idempotency_key);
CREATE INDEX mkt_orders_store_idx ON public.mkt_orders (storefront_id, order_status, created_at DESC);
CREATE INDEX mkt_orders_customer_idx ON public.mkt_orders (customer_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.mkt_order_party(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_orders o
    WHERE o.id = _order_id
      AND (o.customer_user_id = auth.uid() OR public.mkt_store_manage(o.storefront_id))
  )
$$;

GRANT SELECT, INSERT, UPDATE ON public.mkt_orders TO authenticated;
GRANT ALL ON public.mkt_orders TO service_role;
ALTER TABLE public.mkt_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_orders_party_read ON public.mkt_orders
  FOR SELECT TO authenticated USING (
    customer_user_id = auth.uid() OR public.mkt_store_manage(storefront_id) OR public.mkt_store_admin()
  );
-- orders are created through the server-side RPC in a later batch; direct writes stay owner-scoped
CREATE POLICY mkt_orders_customer_insert ON public.mkt_orders
  FOR INSERT TO authenticated WITH CHECK (customer_user_id = auth.uid() AND order_status = 'draft');
CREATE POLICY mkt_orders_party_update ON public.mkt_orders
  FOR UPDATE TO authenticated USING (
    customer_user_id = auth.uid() OR public.mkt_store_manage(storefront_id) OR public.mkt_store_admin()
  ) WITH CHECK (
    customer_user_id = auth.uid() OR public.mkt_store_manage(storefront_id) OR public.mkt_store_admin()
  );

-- ---------- 14. order items ----------

CREATE TABLE public.mkt_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.mkt_orders(id) ON DELETE CASCADE,
  store_item_id uuid REFERENCES public.mkt_store_items(id) ON DELETE SET NULL,
  item_name_snapshot text NOT NULL,
  variant_name_snapshot text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  addons_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_total >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  customer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_order_items_order_idx ON public.mkt_order_items (order_id);
GRANT SELECT, INSERT ON public.mkt_order_items TO authenticated;
GRANT ALL ON public.mkt_order_items TO service_role;
ALTER TABLE public.mkt_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_order_items_party_read ON public.mkt_order_items
  FOR SELECT TO authenticated USING (public.mkt_order_party(order_id) OR public.mkt_store_admin());
CREATE POLICY mkt_order_items_customer_insert ON public.mkt_order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.mkt_orders o WHERE o.id = order_id AND o.customer_user_id = auth.uid() AND o.order_status = 'draft')
  );

-- ---------- 15. order item addons ----------

CREATE TABLE public.mkt_order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.mkt_order_items(id) ON DELETE CASCADE,
  addon_name_snapshot text NOT NULL,
  price_snapshot numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_order_item_addons_item_idx ON public.mkt_order_item_addons (order_item_id);
CREATE OR REPLACE FUNCTION public.mkt_order_item_party(_order_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_order_items oi WHERE oi.id = _order_item_id AND public.mkt_order_party(oi.order_id)
  )
$$;
GRANT SELECT, INSERT ON public.mkt_order_item_addons TO authenticated;
GRANT ALL ON public.mkt_order_item_addons TO service_role;
ALTER TABLE public.mkt_order_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_order_item_addons_party_read ON public.mkt_order_item_addons
  FOR SELECT TO authenticated USING (public.mkt_order_item_party(order_item_id) OR public.mkt_store_admin());
CREATE POLICY mkt_order_item_addons_insert ON public.mkt_order_item_addons
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mkt_order_items oi
      JOIN public.mkt_orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id AND o.customer_user_id = auth.uid() AND o.order_status = 'draft'
    )
  );

-- ---------- 16. order status history ----------

CREATE TABLE public.mkt_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.mkt_orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid,
  changed_by_account_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_order_status_history_order_idx ON public.mkt_order_status_history (order_id, created_at DESC);
GRANT SELECT ON public.mkt_order_status_history TO authenticated;
GRANT ALL ON public.mkt_order_status_history TO service_role;
ALTER TABLE public.mkt_order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_order_status_history_party_read ON public.mkt_order_status_history
  FOR SELECT TO authenticated USING (public.mkt_order_party(order_id) OR public.mkt_store_admin());

-- ---------- 17. store audit ----------

CREATE TABLE public.mkt_store_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.mkt_orders(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_user_id uuid DEFAULT auth.uid(),
  actor_account_id text,
  is_admin_action boolean NOT NULL DEFAULT false,
  reason text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_store_audit_store_idx ON public.mkt_store_audit (storefront_id, created_at DESC);
GRANT SELECT ON public.mkt_store_audit TO authenticated;
GRANT ALL ON public.mkt_store_audit TO service_role;
ALTER TABLE public.mkt_store_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY mkt_store_audit_read ON public.mkt_store_audit
  FOR SELECT TO authenticated USING (
    public.mkt_store_admin() OR (storefront_id IS NOT NULL AND public.mkt_store_manage(storefront_id))
  );

-- ============================================================
-- Triggers: ownership freeze, defaults, order numbering, history
-- ============================================================

CREATE OR REPLACE FUNCTION public.mkt_store_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_storefront_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_permit_ok boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- country always follows the account, never the browser
    IF NEW.country_id IS NULL THEN
      NEW.country_id := public.mkt_account_country_id(NEW.owner_user_id);
    END IF;
    RETURN NEW;
  END IF;

  -- ownership can never be moved from the client
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.tenant_id := OLD.tenant_id;
  NEW.country_id := COALESCE(OLD.country_id, NEW.country_id);
  NEW.updated_at := now();

  -- only platform staff may suspend / un-suspend
  IF NEW.status IS DISTINCT FROM OLD.status
     AND ('suspended' IN (NEW.status, OLD.status))
     AND NOT public.mkt_store_admin() THEN
    RAISE EXCEPTION 'store suspension is an administrative action';
  END IF;

  -- delivery requires an explicit merchant declaration
  IF NEW.merchant_delivery_enabled AND NOT OLD.merchant_delivery_enabled THEN
    SELECT p.delivery_declaration_accepted_at IS NOT NULL INTO v_permit_ok
    FROM public.mkt_store_private p WHERE p.storefront_id = NEW.id;
    IF NOT COALESCE(v_permit_ok, false) THEN
      RAISE EXCEPTION 'delivery requires the merchant compliance declaration';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_storefronts_guard
  BEFORE INSERT OR UPDATE ON public.mkt_storefronts
  FOR EACH ROW EXECUTE FUNCTION public.mkt_storefront_guard();

-- primary branch + private row are created with the storefront
CREATE OR REPLACE FUNCTION public.mkt_storefront_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.mkt_store_private (storefront_id) VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.mkt_store_branches (
    storefront_id, country_id, city_id, district, address_text,
    latitude, longitude, pickup_enabled, delivery_enabled, is_primary
  ) VALUES (
    NEW.id, NEW.country_id, NEW.city_id, NEW.district, NEW.address_text,
    NEW.latitude, NEW.longitude, NEW.pickup_enabled, NEW.merchant_delivery_enabled, true
  );
  INSERT INTO public.mkt_store_audit (storefront_id, entity_type, entity_id, action, actor_user_id)
    VALUES (NEW.id, 'storefront', NEW.id, 'create', NEW.owner_user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_storefronts_after_insert
  AFTER INSERT ON public.mkt_storefronts
  FOR EACH ROW EXECUTE FUNCTION public.mkt_storefront_after_insert();

-- cart items must belong to the cart's storefront
CREATE OR REPLACE FUNCTION public.mkt_cart_item_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store uuid;
  v_item_store uuid;
BEGIN
  SELECT storefront_id INTO v_store FROM public.mkt_carts WHERE id = NEW.cart_id;
  SELECT storefront_id INTO v_item_store FROM public.mkt_store_items WHERE id = NEW.store_item_id AND deleted_at IS NULL;
  IF v_item_store IS NULL OR v_item_store IS DISTINCT FROM v_store THEN
    RAISE EXCEPTION 'cart items must come from a single storefront';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_cart_items_guard
  BEFORE INSERT OR UPDATE ON public.mkt_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.mkt_cart_item_guard();

-- order numbering + merchant/ownership derivation + status history
CREATE OR REPLACE FUNCTION public.mkt_order_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.mkt_storefronts%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO s FROM public.mkt_storefronts WHERE id = NEW.storefront_id;
    IF s.id IS NULL THEN RAISE EXCEPTION 'unknown storefront'; END IF;
    NEW.merchant_user_id := s.owner_user_id;
    NEW.merchant_tenant_id := s.tenant_id;
    NEW.currency_code := s.currency_code;
    NEW.order_number := 'K-' || to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYMMDD') || '-'
                        || lpad(nextval('public.mkt_order_number_seq')::text, 5, '0');
    RETURN NEW;
  END IF;

  -- immutable financial and ownership facts
  NEW.storefront_id := OLD.storefront_id;
  NEW.customer_user_id := OLD.customer_user_id;
  NEW.merchant_user_id := OLD.merchant_user_id;
  NEW.merchant_tenant_id := OLD.merchant_tenant_id;
  NEW.order_number := OLD.order_number;
  NEW.idempotency_key := OLD.idempotency_key;
  NEW.updated_at := now();

  IF OLD.order_status <> 'draft'
     AND (NEW.subtotal, NEW.delivery_fee, NEW.total) IS DISTINCT FROM (OLD.subtotal, OLD.delivery_fee, OLD.total)
     AND NOT public.mkt_store_admin() THEN
    RAISE EXCEPTION 'order totals are fixed once the order is submitted';
  END IF;

  IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    IF NEW.order_status = 'submitted' THEN NEW.submitted_at := COALESCE(NEW.submitted_at, now()); END IF;
    IF NEW.order_status = 'accepted' THEN NEW.accepted_at := COALESCE(NEW.accepted_at, now()); END IF;
    IF NEW.order_status = 'completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, now()); END IF;
    IF NEW.order_status IN ('cancelled','rejected') THEN NEW.cancelled_at := COALESCE(NEW.cancelled_at, now()); END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_orders_before
  BEFORE INSERT OR UPDATE ON public.mkt_orders
  FOR EACH ROW EXECUTE FUNCTION public.mkt_order_before();

CREATE OR REPLACE FUNCTION public.mkt_order_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.mkt_order_status_history (order_id, old_status, new_status, changed_by_user_id, changed_by_account_id)
      VALUES (NEW.id, NULL, NEW.order_status, auth.uid(), NEW.customer_account_id);
  ELSIF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    INSERT INTO public.mkt_order_status_history (order_id, old_status, new_status, changed_by_user_id, note)
      VALUES (NEW.id, OLD.order_status, NEW.order_status, auth.uid(), NEW.cancellation_reason);
    INSERT INTO public.mkt_store_audit (storefront_id, order_id, entity_type, entity_id, action, reason, is_admin_action)
      VALUES (NEW.storefront_id, NEW.id, 'order', NEW.id, 'status:' || NEW.order_status,
              NEW.cancellation_reason, public.mkt_store_admin());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mkt_orders_after
  AFTER INSERT OR UPDATE ON public.mkt_orders
  FOR EACH ROW EXECUTE FUNCTION public.mkt_order_after();

-- generic updated_at triggers
CREATE TRIGGER mkt_store_private_touch BEFORE UPDATE ON public.mkt_store_private
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_branches_touch BEFORE UPDATE ON public.mkt_store_branches
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_sections_touch BEFORE UPDATE ON public.mkt_store_sections
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_items_touch BEFORE UPDATE ON public.mkt_store_items
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_item_variants_touch BEFORE UPDATE ON public.mkt_store_item_variants
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_addon_groups_touch BEFORE UPDATE ON public.mkt_store_addon_groups
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_addons_touch BEFORE UPDATE ON public.mkt_store_addons
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_hours_touch BEFORE UPDATE ON public.mkt_store_hours
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_store_delivery_zones_touch BEFORE UPDATE ON public.mkt_store_delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_carts_touch BEFORE UPDATE ON public.mkt_carts
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();

-- ============================================================
-- Feature flags (free launch mode; nothing monetised yet)
-- ============================================================

CREATE OR REPLACE FUNCTION public.mkt_commerce_flags()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'free_launch_mode', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.free_launch_mode'), true),
    'stores_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.stores_enabled'), true),
    'payments_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.payments_enabled'), false),
    'platform_delivery_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.platform_delivery_enabled'), false),
    'commissions_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.commissions_enabled'), false),
    'subscriptions_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.subscriptions_enabled'), false),
    'coupons_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.coupons_enabled'), false),
    'loyalty_enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.mkt_platform_settings WHERE key = 'commerce.loyalty_enabled'), false)
  )
$$;
GRANT EXECUTE ON FUNCTION public.mkt_commerce_flags() TO anon, authenticated;

-- ============================================================
-- Ownership path for the UI: does the active account own a store?
-- ============================================================

CREATE OR REPLACE FUNCTION public.mkt_my_storefront(_account_key text DEFAULT NULL)
RETURNS TABLE (
  id uuid, slug text, name_ar text, name_en text, store_type text,
  status text, accepts_orders boolean, is_open_manually boolean,
  logo_path text, cover_path text, tenant_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH ctx AS (
    SELECT a.tenant_id FROM public.mkt_my_accounts() a
    WHERE _account_key IS NULL OR a.account_key = _account_key
  )
  SELECT s.id, s.slug, s.name_ar, s.name_en, s.store_type, s.status,
         s.accepts_orders, s.is_open_manually, s.logo_path, s.cover_path, s.tenant_id
  FROM public.mkt_storefronts s
  WHERE s.deleted_at IS NULL
    AND s.owner_user_id = auth.uid()
    AND (
      _account_key IS NULL
      OR s.tenant_id IS NOT DISTINCT FROM (SELECT c.tenant_id FROM ctx c LIMIT 1)
    )
  ORDER BY s.created_at
$$;
GRANT EXECUTE ON FUNCTION public.mkt_my_storefront(text) TO authenticated;