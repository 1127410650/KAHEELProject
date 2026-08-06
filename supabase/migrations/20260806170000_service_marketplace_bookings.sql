-- ============================================================================
-- Kahli service marketplace
-- One storefront model for retail sellers and service providers. This migration
-- adds booking-specific data only; it deliberately reuses mkt_storefronts and
-- mkt_store_items so the platform never grows a second, conflicting store model.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Published service-only stores may fulfil work remotely or at a customer's
-- address, so the product pickup/delivery constraint must not reject them.
ALTER TABLE public.mkt_storefronts
  DROP CONSTRAINT IF EXISTS mkt_storefronts_fulfilment_ck;
ALTER TABLE public.mkt_storefronts
  ADD CONSTRAINT mkt_storefronts_fulfilment_ck CHECK (
    status <> 'published'
    OR pickup_enabled
    OR merchant_delivery_enabled
    OR store_type IN ('services', 'mixed')
  );

-- ── Taxonomy and provider configuration ─────────────────────────────────────

CREATE TABLE public.mkt_service_categories (
  code text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.mkt_service_categories (code, name_ar, name_en, icon, color, sort_order) VALUES
  ('home_cleaning', 'تنظيف المنزل', 'Home cleaning', 'sparkles', 'teal', 10),
  ('maintenance', 'صيانة المنزل', 'Home maintenance', 'wrench', 'navy', 20),
  ('beauty', 'العناية والجمال', 'Beauty & wellness', 'heart', 'rose', 30),
  ('health', 'الصحة والعلاج', 'Health & therapy', 'stethoscope', 'emerald', 40),
  ('education', 'التعليم والتدريب', 'Education & training', 'graduation-cap', 'violet', 50),
  ('automotive', 'خدمات السيارات', 'Automotive services', 'car', 'amber', 60),
  ('business', 'خدمات الأعمال', 'Business services', 'briefcase', 'sky', 70),
  ('events', 'المناسبات', 'Events', 'party-popper', 'fuchsia', 80),
  ('technology', 'التقنية', 'Technology', 'laptop', 'indigo', 90),
  ('other', 'خدمات أخرى', 'Other services', 'grid-2x2', 'slate', 999)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE public.mkt_service_settings (
  storefront_id uuid PRIMARY KEY REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  category_code text NOT NULL DEFAULT 'other' REFERENCES public.mkt_service_categories(code),
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  confirmation_mode text NOT NULL DEFAULT 'manual'
    CHECK (confirmation_mode IN ('instant', 'manual')),
  min_notice_minutes integer NOT NULL DEFAULT 120
    CHECK (min_notice_minutes BETWEEN 0 AND 43200),
  max_advance_days integer NOT NULL DEFAULT 60
    CHECK (max_advance_days BETWEEN 1 AND 365),
  slot_interval_minutes integer NOT NULL DEFAULT 30
    CHECK (slot_interval_minutes IN (10, 15, 20, 30, 45, 60)),
  buffer_minutes integer NOT NULL DEFAULT 0
    CHECK (buffer_minutes BETWEEN 0 AND 240),
  cancellation_window_hours integer NOT NULL DEFAULT 6
    CHECK (cancellation_window_hours BETWEEN 0 AND 168),
  service_modes text[] NOT NULL DEFAULT ARRAY['at_provider']::text[],
  visit_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (visit_fee >= 0),
  accepts_bookings boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_service_settings_modes_ck CHECK (
    cardinality(service_modes) > 0
    AND service_modes <@ ARRAY['at_provider','at_customer','remote']::text[]
  )
);

CREATE TABLE public.mkt_service_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL,
  title text,
  bio text,
  avatar_path text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  accepts_bookings boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX mkt_service_professionals_primary_idx
  ON public.mkt_service_professionals (storefront_id)
  WHERE is_primary AND deleted_at IS NULL;
CREATE UNIQUE INDEX mkt_service_professionals_user_idx
  ON public.mkt_service_professionals (storefront_id, user_id)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX mkt_service_professionals_store_idx
  ON public.mkt_service_professionals (storefront_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE public.mkt_service_professional_items (
  professional_id uuid NOT NULL REFERENCES public.mkt_service_professionals(id) ON DELETE CASCADE,
  service_item_id uuid NOT NULL REFERENCES public.mkt_store_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, service_item_id)
);

CREATE TABLE public.mkt_service_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.mkt_service_professionals(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_service_availability_window_ck CHECK (starts_at < ends_at),
  CONSTRAINT mkt_service_availability_unique UNIQUE (professional_id, weekday, starts_at, ends_at)
);

CREATE TABLE public.mkt_service_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.mkt_service_professionals(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_service_time_off_window_ck CHECK (starts_at < ends_at)
);
CREATE INDEX mkt_service_time_off_professional_idx
  ON public.mkt_service_time_off (professional_id, starts_at, ends_at);

-- ── Bookings, lifecycle and verified reviews ────────────────────────────────

CREATE SEQUENCE public.mkt_service_booking_number_seq START 1000;

CREATE TABLE public.mkt_service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL UNIQUE,
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.mkt_store_branches(id) ON DELETE SET NULL,
  service_item_id uuid NOT NULL REFERENCES public.mkt_store_items(id) ON DELETE RESTRICT,
  professional_id uuid NOT NULL REFERENCES public.mkt_service_professionals(id) ON DELETE RESTRICT,
  customer_user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_account_key text NOT NULL,
  provider_user_id uuid NOT NULL,
  provider_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  service_name_snapshot text NOT NULL,
  provider_name_snapshot text NOT NULL,
  customer_name_snapshot text,
  customer_phone_snapshot text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  service_mode text NOT NULL CHECK (service_mode IN ('at_provider','at_customer','remote')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','en_route','in_progress','completed','rejected',
    'cancelled_by_customer','cancelled_by_provider','no_show'
  )),
  payment_method text NOT NULL DEFAULT 'pay_after_service'
    CHECK (payment_method IN ('pay_after_service','cash','bank_transfer','online')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','refunded','failed')),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  visit_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (visit_fee >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  currency_code text NOT NULL DEFAULT 'SAR',
  address_text text,
  district text,
  latitude double precision,
  longitude double precision,
  customer_notes text,
  provider_notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_service_booking_window_ck CHECK (starts_at < ends_at),
  CONSTRAINT mkt_service_booking_location_ck CHECK (
    service_mode <> 'at_customer' OR nullif(btrim(address_text), '') IS NOT NULL
  )
);
CREATE UNIQUE INDEX mkt_service_bookings_idempotency_idx
  ON public.mkt_service_bookings (customer_user_id, idempotency_key);
CREATE INDEX mkt_service_bookings_customer_idx
  ON public.mkt_service_bookings (customer_user_id, starts_at DESC);
CREATE INDEX mkt_service_bookings_store_idx
  ON public.mkt_service_bookings (storefront_id, status, starts_at);
ALTER TABLE public.mkt_service_bookings
  ADD CONSTRAINT mkt_service_bookings_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('pending','confirmed','en_route','in_progress'));

CREATE TABLE public.mkt_service_booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.mkt_service_bookings(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid,
  changed_by_account_key text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_service_booking_history_idx
  ON public.mkt_service_booking_status_history (booking_id, created_at);

CREATE TABLE public.mkt_service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.mkt_service_bookings(id) ON DELETE CASCADE,
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.mkt_service_professionals(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL DEFAULT auth.uid(),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','flagged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mkt_service_reviews_store_idx
  ON public.mkt_service_reviews (storefront_id, status, created_at DESC);

-- ── Ownership helpers and RLS ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_service_booking_party(_booking_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mkt_service_bookings b
    WHERE b.id = _booking_id
      AND (b.customer_user_id = auth.uid() OR public.mkt_store_manage(b.storefront_id))
  )
$$;

REVOKE ALL ON FUNCTION public.mkt_service_booking_party(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_service_booking_party(uuid) TO authenticated, service_role;

GRANT SELECT ON public.mkt_service_categories TO anon, authenticated;
GRANT SELECT ON public.mkt_service_settings, public.mkt_service_professionals,
  public.mkt_service_professional_items, public.mkt_service_availability,
  public.mkt_service_time_off TO authenticated;
GRANT SELECT ON public.mkt_service_bookings, public.mkt_service_booking_status_history,
  public.mkt_service_reviews TO authenticated;
GRANT SELECT ON public.mkt_service_reviews TO anon;
GRANT ALL ON public.mkt_service_categories, public.mkt_service_settings,
  public.mkt_service_professionals, public.mkt_service_professional_items,
  public.mkt_service_availability, public.mkt_service_time_off,
  public.mkt_service_bookings, public.mkt_service_booking_status_history,
  public.mkt_service_reviews TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mkt_service_booking_number_seq TO service_role;

ALTER TABLE public.mkt_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_professional_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_service_categories_read ON public.mkt_service_categories
  FOR SELECT USING (is_active OR public.mkt_store_admin());
CREATE POLICY mkt_service_settings_owner_read ON public.mkt_service_settings
  FOR SELECT TO authenticated USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin());
CREATE POLICY mkt_service_professionals_owner_read ON public.mkt_service_professionals
  FOR SELECT TO authenticated USING (public.mkt_store_manage(storefront_id) OR public.mkt_store_admin());
CREATE POLICY mkt_service_professional_items_owner_read ON public.mkt_service_professional_items
  FOR SELECT TO authenticated USING (public.mkt_store_item_manage(service_item_id) OR public.mkt_store_admin());
CREATE POLICY mkt_service_availability_owner_read ON public.mkt_service_availability
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mkt_service_professionals p
            WHERE p.id = professional_id AND public.mkt_store_manage(p.storefront_id))
    OR public.mkt_store_admin()
  );
CREATE POLICY mkt_service_time_off_owner_read ON public.mkt_service_time_off
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mkt_service_professionals p
            WHERE p.id = professional_id AND public.mkt_store_manage(p.storefront_id))
    OR public.mkt_store_admin()
  );
CREATE POLICY mkt_service_bookings_party_read ON public.mkt_service_bookings
  FOR SELECT TO authenticated USING (
    customer_user_id = auth.uid() OR public.mkt_store_manage(storefront_id) OR public.mkt_store_admin()
  );
CREATE POLICY mkt_service_booking_history_party_read ON public.mkt_service_booking_status_history
  FOR SELECT TO authenticated USING (public.mkt_service_booking_party(booking_id) OR public.mkt_store_admin());
CREATE POLICY mkt_service_reviews_public_read ON public.mkt_service_reviews
  FOR SELECT USING (status = 'published' AND public.mkt_store_visible(storefront_id));

-- Direct mutations are intentionally not granted. All writes go through the
-- server-side functions below, which re-resolve auth.uid() and account scope.

CREATE TRIGGER mkt_service_settings_touch BEFORE UPDATE ON public.mkt_service_settings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_service_professionals_touch BEFORE UPDATE ON public.mkt_service_professionals
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_service_availability_touch BEFORE UPDATE ON public.mkt_service_availability
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_service_bookings_touch BEFORE UPDATE ON public.mkt_service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();
CREATE TRIGGER mkt_service_reviews_touch BEFORE UPDATE ON public.mkt_service_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_touch();

-- Every service store gets exactly one default provider and a sane schedule.
CREATE OR REPLACE FUNCTION public.mkt_service_store_bootstrap()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_professional uuid;
  v_name text;
  v_day smallint;
BEGIN
  IF NEW.store_type NOT IN ('services','mixed') OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mkt_service_settings (storefront_id)
  VALUES (NEW.id) ON CONFLICT (storefront_id) DO NOTHING;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), NEW.name_ar, 'مقدم الخدمة')
    INTO v_name FROM public.profiles p WHERE p.user_id = NEW.owner_user_id;
  v_name := COALESCE(v_name, NEW.name_ar, 'مقدم الخدمة');

  SELECT p.id INTO v_professional
  FROM public.mkt_service_professionals p
  WHERE p.storefront_id = NEW.id AND p.is_primary AND p.deleted_at IS NULL
  LIMIT 1;

  IF v_professional IS NULL THEN
    INSERT INTO public.mkt_service_professionals (
      storefront_id, user_id, display_name, is_primary, sort_order
    ) VALUES (NEW.id, NEW.owner_user_id, v_name, true, 0)
    RETURNING id INTO v_professional;

    FOREACH v_day IN ARRAY ARRAY[0,1,2,3,4]::smallint[] LOOP
      INSERT INTO public.mkt_service_availability (
        professional_id, weekday, starts_at, ends_at
      ) VALUES (v_professional, v_day, '09:00', '17:00')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER mkt_service_store_bootstrap_trigger
  AFTER INSERT OR UPDATE OF store_type ON public.mkt_storefronts
  FOR EACH ROW EXECUTE FUNCTION public.mkt_service_store_bootstrap();

-- Bootstrap service stores that existed before this migration.
INSERT INTO public.mkt_service_settings (storefront_id)
SELECT s.id FROM public.mkt_storefronts s
WHERE s.store_type IN ('services','mixed') AND s.deleted_at IS NULL
ON CONFLICT (storefront_id) DO NOTHING;

INSERT INTO public.mkt_service_professionals (
  storefront_id, user_id, display_name, is_primary, sort_order
)
SELECT s.id, s.owner_user_id,
       COALESCE(NULLIF(btrim(p.full_name), ''), s.name_ar, 'مقدم الخدمة'),
       true, 0
FROM public.mkt_storefronts s
LEFT JOIN public.profiles p ON p.user_id = s.owner_user_id
WHERE s.store_type IN ('services','mixed') AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.mkt_service_professionals x
    WHERE x.storefront_id = s.id AND x.is_primary AND x.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.mkt_service_availability (professional_id, weekday, starts_at, ends_at)
SELECT p.id, d.weekday, '09:00'::time, '17:00'::time
FROM public.mkt_service_professionals p
CROSS JOIN (VALUES (0::smallint),(1::smallint),(2::smallint),(3::smallint),(4::smallint)) d(weekday)
WHERE p.is_primary AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.mkt_service_availability a
    WHERE a.professional_id = p.id AND a.weekday = d.weekday
  )
ON CONFLICT DO NOTHING;

-- ── Public discovery and booking context ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_service_categories_public()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'code', c.code, 'name_ar', c.name_ar, 'name_en', c.name_en,
        'icon', c.icon, 'color', c.color
      ) ORDER BY c.sort_order, c.code
    ),
    '[]'::jsonb
  )
  FROM public.mkt_service_categories c
  WHERE c.is_active
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_directory(
  _q text DEFAULT NULL,
  _category_code text DEFAULT NULL,
  _city_id uuid DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH rows AS (
    SELECT
      s.id AS storefront_id, s.slug, s.name_ar AS store_name_ar,
      s.name_en AS store_name_en, s.logo_path, s.cover_path,
      s.verification_status, s.city_id, c.name_ar AS city_name_ar,
      c.name_en AS city_name_en, cfg.category_code, cfg.service_modes,
      cfg.confirmation_mode, i.id AS item_id, i.name_ar, i.name_en,
      i.description_ar, i.description_en, i.base_price, i.compare_at_price,
      i.currency_code, i.image_path, COALESCE(i.duration_minutes, 60) AS duration_minutes,
      i.is_featured,
      COALESCE((SELECT round(avg(r.rating)::numeric, 2)
                FROM public.mkt_service_reviews r
                WHERE r.storefront_id = s.id AND r.status = 'published'), 0) AS rating,
      (SELECT count(*) FROM public.mkt_service_reviews r
       WHERE r.storefront_id = s.id AND r.status = 'published') AS reviews_count,
      (SELECT count(*) FROM public.mkt_service_bookings b
       WHERE b.storefront_id = s.id AND b.status = 'completed') AS completed_count
    FROM public.mkt_storefronts s
    JOIN public.mkt_service_settings cfg ON cfg.storefront_id = s.id
    JOIN public.mkt_store_items i ON i.storefront_id = s.id
    LEFT JOIN public.mkt_cities c ON c.id = s.city_id
    WHERE s.deleted_at IS NULL
      AND s.status = 'published'
      AND s.store_type IN ('services','mixed')
      AND s.accepts_orders
      AND cfg.accepts_bookings
      AND i.deleted_at IS NULL
      AND i.is_available
      AND i.item_type IN ('service','package')
      AND (_category_code IS NULL OR cfg.category_code = _category_code)
      AND (_city_id IS NULL OR s.city_id = _city_id)
      AND (
        NULLIF(btrim(COALESCE(_q, '')), '') IS NULL
        OR s.name_ar ILIKE '%' || btrim(_q) || '%'
        OR COALESCE(s.name_en, '') ILIKE '%' || btrim(_q) || '%'
        OR i.name_ar ILIKE '%' || btrim(_q) || '%'
        OR COALESCE(i.name_en, '') ILIKE '%' || btrim(_q) || '%'
      )
    ORDER BY i.is_featured DESC, s.verification_status = 'approved' DESC,
             rating DESC, reviews_count DESC, i.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 60)
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) FROM rows
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_booking_context(
  _store_slug text,
  _service_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_store public.mkt_storefronts;
  v_item public.mkt_store_items;
  v_settings public.mkt_service_settings;
BEGIN
  SELECT * INTO v_store FROM public.mkt_storefronts s
  WHERE s.slug = _store_slug AND s.deleted_at IS NULL AND s.status = 'published'
    AND s.store_type IN ('services','mixed');
  IF v_store.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_item FROM public.mkt_store_items i
  WHERE i.id = _service_item_id AND i.storefront_id = v_store.id
    AND i.deleted_at IS NULL AND i.is_available AND i.item_type IN ('service','package');
  IF v_item.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_settings FROM public.mkt_service_settings x
  WHERE x.storefront_id = v_store.id AND x.accepts_bookings;
  IF v_settings.storefront_id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id, 'slug', v_store.slug, 'name_ar', v_store.name_ar,
      'name_en', v_store.name_en, 'logo_path', v_store.logo_path,
      'cover_path', v_store.cover_path, 'city_id', v_store.city_id,
      'district', v_store.district, 'verification_status', v_store.verification_status
    ),
    'service', jsonb_build_object(
      'id', v_item.id, 'name_ar', v_item.name_ar, 'name_en', v_item.name_en,
      'description_ar', v_item.description_ar, 'description_en', v_item.description_en,
      'base_price', v_item.base_price, 'compare_at_price', v_item.compare_at_price,
      'currency_code', v_item.currency_code, 'image_path', v_item.image_path,
      'duration_minutes', COALESCE(v_item.duration_minutes, 60)
    ),
    'settings', jsonb_build_object(
      'timezone', v_settings.timezone,
      'confirmation_mode', v_settings.confirmation_mode,
      'service_modes', to_jsonb(v_settings.service_modes),
      'visit_fee', v_settings.visit_fee,
      'min_notice_minutes', v_settings.min_notice_minutes,
      'max_advance_days', v_settings.max_advance_days,
      'cancellation_window_hours', v_settings.cancellation_window_hours
    ),
    'professionals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'title', p.title,
        'bio', p.bio, 'avatar_path', p.avatar_path, 'is_primary', p.is_primary
      ) ORDER BY p.sort_order, p.created_at)
      FROM public.mkt_service_professionals p
      WHERE p.storefront_id = v_store.id AND p.deleted_at IS NULL
        AND p.is_active AND p.accepts_bookings
        AND (
          NOT EXISTS (SELECT 1 FROM public.mkt_service_professional_items z
                      WHERE z.service_item_id = v_item.id)
          OR EXISTS (SELECT 1 FROM public.mkt_service_professional_items z
                     WHERE z.service_item_id = v_item.id AND z.professional_id = p.id)
        )
    ), '[]'::jsonb),
    'rating', COALESCE((SELECT round(avg(r.rating)::numeric, 2)
                       FROM public.mkt_service_reviews r
                       WHERE r.storefront_id = v_store.id AND r.status = 'published'), 0),
    'reviews_count', (SELECT count(*) FROM public.mkt_service_reviews r
                      WHERE r.storefront_id = v_store.id AND r.status = 'published')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_slots(
  _service_item_id uuid,
  _date date,
  _professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH cfg AS (
    SELECT i.id AS item_id, i.storefront_id,
           GREATEST(COALESCE(i.duration_minutes, 60), 10) AS duration_minutes,
           s.timezone, s.slot_interval_minutes, s.buffer_minutes,
           s.min_notice_minutes, s.max_advance_days
    FROM public.mkt_store_items i
    JOIN public.mkt_storefronts f ON f.id = i.storefront_id
    JOIN public.mkt_service_settings s ON s.storefront_id = i.storefront_id
    WHERE i.id = _service_item_id AND i.deleted_at IS NULL AND i.is_available
      AND i.item_type IN ('service','package')
      AND f.status = 'published' AND f.deleted_at IS NULL
      AND f.accepts_orders AND s.accepts_bookings
  ), eligible AS (
    SELECT p.id AS professional_id, p.display_name, a.starts_at AS day_start,
           a.ends_at AS day_end, c.*
    FROM cfg c
    JOIN public.mkt_service_professionals p ON p.storefront_id = c.storefront_id
    JOIN public.mkt_service_availability a ON a.professional_id = p.id
    WHERE p.deleted_at IS NULL AND p.is_active AND p.accepts_bookings
      AND a.is_active AND a.weekday = EXTRACT(DOW FROM _date)::smallint
      AND (_professional_id IS NULL OR p.id = _professional_id)
      AND (
        NOT EXISTS (SELECT 1 FROM public.mkt_service_professional_items z
                    WHERE z.service_item_id = c.item_id)
        OR EXISTS (SELECT 1 FROM public.mkt_service_professional_items z
                   WHERE z.service_item_id = c.item_id AND z.professional_id = p.id)
      )
  ), generated AS (
    SELECT e.professional_id, e.display_name, e.timezone, e.buffer_minutes,
           slot_start AS starts_at,
           slot_start + make_interval(mins => e.duration_minutes) AS ends_at
    FROM eligible e
    CROSS JOIN LATERAL generate_series(
      ((_date + e.day_start) AT TIME ZONE e.timezone),
      ((_date + e.day_end) AT TIME ZONE e.timezone)
        - make_interval(mins => e.duration_minutes + e.buffer_minutes),
      make_interval(mins => e.slot_interval_minutes)
    ) slot_start
    WHERE _date >= (now() AT TIME ZONE e.timezone)::date
      AND _date <= ((now() AT TIME ZONE e.timezone)::date + e.max_advance_days)
      AND slot_start >= now() + make_interval(mins => e.min_notice_minutes)
  ), available AS (
    SELECT g.* FROM generated g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mkt_service_time_off x
      WHERE x.professional_id = g.professional_id
        AND tstzrange(x.starts_at, x.ends_at, '[)') && tstzrange(g.starts_at, g.ends_at, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.mkt_service_bookings b
      WHERE b.professional_id = g.professional_id
        AND b.status IN ('pending','confirmed','en_route','in_progress')
        AND tstzrange(b.starts_at, b.ends_at, '[)') &&
            tstzrange(g.starts_at - make_interval(mins => g.buffer_minutes),
                      g.ends_at + make_interval(mins => g.buffer_minutes), '[)')
    )
    ORDER BY g.starts_at, g.display_name
    LIMIT 240
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'professional_id', professional_id,
    'professional_name', display_name,
    'starts_at', starts_at,
    'ends_at', ends_at,
    'timezone', timezone
  )), '[]'::jsonb) FROM available
$$;

-- ── Provider seller centre ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_service_provider_setup(_account_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_store public.mkt_storefronts;
BEGIN
  SELECT s.* INTO v_store
  FROM public.mkt_storefronts s
  JOIN public.mkt_my_storefront(_account_key) mine ON mine.id = s.id
  WHERE s.store_type IN ('services','mixed')
  LIMIT 1;
  IF v_store.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'storefront_id', v_store.id,
    'store_slug', v_store.slug,
    'store_name', v_store.name_ar,
    'store_status', v_store.status,
    'settings', (SELECT to_jsonb(x) - 'created_at' - 'updated_at'
                 FROM public.mkt_service_settings x WHERE x.storefront_id = v_store.id),
    'professionals', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) - 'user_id' - 'created_at' - 'updated_at' - 'deleted_at'
                       ORDER BY p.sort_order, p.created_at)
      FROM public.mkt_service_professionals p
      WHERE p.storefront_id = v_store.id AND p.deleted_at IS NULL
    ), '[]'::jsonb),
    'availability', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'professional_id', a.professional_id, 'weekday', a.weekday,
        'starts_at', a.starts_at, 'ends_at', a.ends_at, 'is_active', a.is_active
      ) ORDER BY a.weekday, a.starts_at)
      FROM public.mkt_service_availability a
      JOIN public.mkt_service_professionals p ON p.id = a.professional_id
      WHERE p.storefront_id = v_store.id AND p.deleted_at IS NULL
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'pending', (SELECT count(*) FROM public.mkt_service_bookings b
                  WHERE b.storefront_id = v_store.id AND b.status = 'pending'),
      'today', (SELECT count(*) FROM public.mkt_service_bookings b
                JOIN public.mkt_service_settings x ON x.storefront_id = b.storefront_id
                WHERE b.storefront_id = v_store.id
                  AND (b.starts_at AT TIME ZONE x.timezone)::date =
                      (now() AT TIME ZONE x.timezone)::date
                  AND b.status IN ('confirmed','en_route','in_progress')),
      'upcoming', (SELECT count(*) FROM public.mkt_service_bookings b
                   WHERE b.storefront_id = v_store.id AND b.starts_at > now()
                     AND b.status IN ('pending','confirmed')),
      'completed', (SELECT count(*) FROM public.mkt_service_bookings b
                    WHERE b.storefront_id = v_store.id AND b.status = 'completed')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_provider_save(
  _account_key text,
  _patch jsonb,
  _availability jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_store public.mkt_storefronts;
  v_professional uuid;
  v_category text;
  r jsonb;
BEGIN
  SELECT s.* INTO v_store
  FROM public.mkt_storefronts s
  JOIN public.mkt_my_storefront(_account_key) mine ON mine.id = s.id
  WHERE s.store_type IN ('services','mixed')
  LIMIT 1;
  IF v_store.id IS NULL OR NOT public.mkt_store_manage(v_store.id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_category := COALESCE(NULLIF(_patch->>'category_code',''), 'other');
  IF NOT EXISTS (SELECT 1 FROM public.mkt_service_categories c
                 WHERE c.code = v_category AND c.is_active) THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  INSERT INTO public.mkt_service_settings AS current_settings (storefront_id, category_code)
  VALUES (v_store.id, v_category)
  ON CONFLICT (storefront_id) DO UPDATE SET
    category_code = v_category,
    confirmation_mode = COALESCE(NULLIF(_patch->>'confirmation_mode',''),
                                 current_settings.confirmation_mode),
    min_notice_minutes = COALESCE(NULLIF(_patch->>'min_notice_minutes','')::integer,
                                  current_settings.min_notice_minutes),
    max_advance_days = COALESCE(NULLIF(_patch->>'max_advance_days','')::integer,
                                current_settings.max_advance_days),
    slot_interval_minutes = COALESCE(NULLIF(_patch->>'slot_interval_minutes','')::integer,
                                     current_settings.slot_interval_minutes),
    buffer_minutes = COALESCE(NULLIF(_patch->>'buffer_minutes','')::integer,
                              current_settings.buffer_minutes),
    cancellation_window_hours = COALESCE(NULLIF(_patch->>'cancellation_window_hours','')::integer,
                                         current_settings.cancellation_window_hours),
    service_modes = CASE WHEN _patch ? 'service_modes'
      THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'service_modes'))
      ELSE current_settings.service_modes END,
    visit_fee = COALESCE(NULLIF(_patch->>'visit_fee','')::numeric,
                         current_settings.visit_fee),
    accepts_bookings = COALESCE((_patch->>'accepts_bookings')::boolean,
                                current_settings.accepts_bookings);

  SELECT p.id INTO v_professional FROM public.mkt_service_professionals p
  WHERE p.storefront_id = v_store.id AND p.is_primary AND p.deleted_at IS NULL LIMIT 1;
  IF v_professional IS NULL THEN
    INSERT INTO public.mkt_service_professionals (
      storefront_id, user_id, display_name, is_primary
    ) VALUES (
      v_store.id, auth.uid(),
      COALESCE(NULLIF(_patch->>'professional_name',''), v_store.name_ar, 'مقدم الخدمة'), true
    ) RETURNING id INTO v_professional;
  ELSE
    UPDATE public.mkt_service_professionals SET
      display_name = COALESCE(NULLIF(_patch->>'professional_name',''), display_name),
      title = CASE WHEN _patch ? 'professional_title' THEN NULLIF(_patch->>'professional_title','') ELSE title END,
      bio = CASE WHEN _patch ? 'professional_bio' THEN NULLIF(_patch->>'professional_bio','') ELSE bio END,
      accepts_bookings = COALESCE((_patch->>'accepts_bookings')::boolean, accepts_bookings)
    WHERE id = v_professional;
  END IF;

  IF _availability IS NOT NULL THEN
    DELETE FROM public.mkt_service_availability WHERE professional_id = v_professional;
    FOR r IN SELECT * FROM jsonb_array_elements(_availability) LOOP
      IF COALESCE((r->>'is_active')::boolean, true) THEN
        INSERT INTO public.mkt_service_availability (
          professional_id, weekday, starts_at, ends_at, is_active
        ) VALUES (
          v_professional, (r->>'weekday')::smallint,
          (r->>'starts_at')::time, (r->>'ends_at')::time, true
        );
      END IF;
    END LOOP;
  END IF;

  RETURN public.mkt_service_provider_setup(_account_key);
END;
$$;

-- ── Customer booking and lifecycle actions ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_service_create_booking(
  _account_key text,
  _service_item_id uuid,
  _starts_at timestamptz,
  _professional_id uuid DEFAULT NULL,
  _service_mode text DEFAULT 'at_provider',
  _customer_phone text DEFAULT NULL,
  _address_text text DEFAULT NULL,
  _district text DEFAULT NULL,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _notes text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_item public.mkt_store_items;
  v_store public.mkt_storefronts;
  v_cfg public.mkt_service_settings;
  v_professional public.mkt_service_professionals;
  v_slot jsonb;
  v_booking public.mkt_service_bookings;
  v_account record;
  v_status text;
  v_fee numeric(12,2);
  v_idem text;
  v_branch uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_account FROM public.mkt_account_context(_account_key) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_mismatch'; END IF;

  SELECT * INTO v_item FROM public.mkt_store_items i
  WHERE i.id = _service_item_id AND i.deleted_at IS NULL AND i.is_available
    AND i.item_type IN ('service','package');
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'service_unavailable'; END IF;

  SELECT * INTO v_store FROM public.mkt_storefronts s
  WHERE s.id = v_item.storefront_id AND s.deleted_at IS NULL
    AND s.status = 'published' AND s.store_type IN ('services','mixed')
    AND s.accepts_orders;
  IF v_store.id IS NULL THEN RAISE EXCEPTION 'service_unavailable'; END IF;

  SELECT * INTO v_cfg FROM public.mkt_service_settings x
  WHERE x.storefront_id = v_store.id AND x.accepts_bookings;
  IF v_cfg.storefront_id IS NULL THEN RAISE EXCEPTION 'bookings_paused'; END IF;
  IF NOT (_service_mode = ANY(v_cfg.service_modes)) THEN RAISE EXCEPTION 'invalid_service_mode'; END IF;
  IF _service_mode = 'at_customer' AND NULLIF(btrim(COALESCE(_address_text,'')), '') IS NULL THEN
    RAISE EXCEPTION 'address_required';
  END IF;

  SELECT x INTO v_slot
  FROM jsonb_array_elements(public.mkt_service_slots(
    v_item.id, (_starts_at AT TIME ZONE v_cfg.timezone)::date, _professional_id
  )) x
  WHERE (x->>'starts_at')::timestamptz = _starts_at
  LIMIT 1;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'slot_unavailable'; END IF;

  SELECT * INTO v_professional FROM public.mkt_service_professionals p
  WHERE p.id = (v_slot->>'professional_id')::uuid
    AND p.storefront_id = v_store.id AND p.deleted_at IS NULL;
  IF v_professional.id IS NULL THEN RAISE EXCEPTION 'professional_unavailable'; END IF;

  v_idem := COALESCE(NULLIF(_idempotency_key,''), gen_random_uuid()::text);
  SELECT * INTO v_booking FROM public.mkt_service_bookings b
  WHERE b.customer_user_id = auth.uid() AND b.idempotency_key = v_idem;
  IF v_booking.id IS NOT NULL THEN
    RETURN to_jsonb(v_booking) - 'provider_user_id' - 'provider_tenant_id';
  END IF;

  v_status := CASE WHEN v_cfg.confirmation_mode = 'instant' THEN 'confirmed' ELSE 'pending' END;
  v_fee := CASE WHEN _service_mode = 'at_customer' THEN v_cfg.visit_fee ELSE 0 END;
  SELECT b.id INTO v_branch FROM public.mkt_store_branches b
  WHERE b.storefront_id = v_store.id AND b.is_primary AND b.deleted_at IS NULL LIMIT 1;

  BEGIN
    INSERT INTO public.mkt_service_bookings (
      booking_number, storefront_id, branch_id, service_item_id, professional_id,
      customer_user_id, customer_account_key, provider_user_id, provider_tenant_id,
      idempotency_key, service_name_snapshot, provider_name_snapshot,
      customer_name_snapshot, customer_phone_snapshot, starts_at, ends_at, timezone,
      service_mode, status, subtotal, visit_fee, total, currency_code,
      address_text, district, latitude, longitude, customer_notes, confirmed_at
    ) VALUES (
      'KSB-' || to_char(now(), 'YYMM') || '-' ||
        lpad(nextval('public.mkt_service_booking_number_seq')::text, 6, '0'),
      v_store.id, v_branch, v_item.id, v_professional.id,
      auth.uid(), _account_key, v_store.owner_user_id, v_store.tenant_id,
      v_idem, v_item.name_ar, v_professional.display_name,
      v_account.name, NULLIF(btrim(COALESCE(_customer_phone,'')), ''),
      _starts_at, (v_slot->>'ends_at')::timestamptz, v_cfg.timezone,
      _service_mode, v_status, v_item.base_price, v_fee, v_item.base_price + v_fee,
      v_item.currency_code, NULLIF(btrim(COALESCE(_address_text,'')), ''),
      NULLIF(btrim(COALESCE(_district,'')), ''), _latitude, _longitude,
      NULLIF(btrim(COALESCE(_notes,'')), ''),
      CASE WHEN v_status = 'confirmed' THEN now() ELSE NULL END
    ) RETURNING * INTO v_booking;
  EXCEPTION WHEN exclusion_violation OR unique_violation THEN
    RAISE EXCEPTION 'slot_unavailable';
  END;

  INSERT INTO public.mkt_service_booking_status_history (
    booking_id, old_status, new_status, changed_by_user_id, changed_by_account_key
  ) VALUES (v_booking.id, NULL, v_booking.status, auth.uid(), _account_key);

  IF v_store.owner_user_id <> auth.uid() THEN
    INSERT INTO public.mkt_notifications (user_id, event, title, body)
    VALUES (v_store.owner_user_id, 'service_booking_new', 'طلب حجز جديد',
            v_booking.booking_number || ' · ' || v_booking.service_name_snapshot);
  END IF;

  RETURN to_jsonb(v_booking) - 'provider_user_id' - 'provider_tenant_id';
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_bookings_list(
  _account_key text,
  _side text DEFAULT 'customer',
  _status text DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_store uuid;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_account_context(_account_key)) THEN
    RAISE EXCEPTION 'account_mismatch';
  END IF;

  IF _side = 'provider' THEN
    SELECT id INTO v_store FROM public.mkt_my_storefront(_account_key) LIMIT 1;
    IF v_store IS NULL THEN RETURN '[]'::jsonb; END IF;
  ELSIF _side <> 'customer' THEN
    RAISE EXCEPTION 'invalid_side';
  END IF;

  SELECT COALESCE(jsonb_agg(row_payload ORDER BY sort_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT b.starts_at AS sort_at,
      jsonb_build_object(
        'id', b.id, 'booking_number', b.booking_number, 'storefront_id', b.storefront_id,
        'store_slug', s.slug, 'store_name', s.name_ar, 'store_logo_path', s.logo_path,
        'service_item_id', b.service_item_id, 'service_name', b.service_name_snapshot,
        'professional_name', b.provider_name_snapshot,
        'customer_name', b.customer_name_snapshot, 'customer_phone', b.customer_phone_snapshot,
        'starts_at', b.starts_at, 'ends_at', b.ends_at, 'timezone', b.timezone,
        'service_mode', b.service_mode, 'status', b.status,
        'cancellation_window_hours', COALESCE((
          SELECT x.cancellation_window_hours
          FROM public.mkt_service_settings x
          WHERE x.storefront_id = b.storefront_id
        ), 0),
        'total', b.total, 'currency_code', b.currency_code,
        'address_text', b.address_text, 'district', b.district,
        'customer_notes', b.customer_notes, 'provider_notes', b.provider_notes,
        'created_at', b.created_at
      ) AS row_payload
    FROM public.mkt_service_bookings b
    JOIN public.mkt_storefronts s ON s.id = b.storefront_id
    WHERE ((_side = 'provider' AND b.storefront_id = v_store)
       OR (_side = 'customer' AND b.customer_user_id = auth.uid()
           AND b.customer_account_key = _account_key))
      AND (_status IS NULL OR b.status = _status)
    ORDER BY b.starts_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit,100),1),200)
  ) q;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_booking_action(
  _booking_id uuid,
  _account_key text,
  _action text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_booking public.mkt_service_bookings;
  v_old text;
  v_provider boolean;
  v_customer boolean;
  v_cancel_hours integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mkt_account_context(_account_key)) THEN
    RAISE EXCEPTION 'account_mismatch';
  END IF;

  SELECT * INTO v_booking FROM public.mkt_service_bookings b
  WHERE b.id = _booking_id FOR UPDATE;
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'booking_not_found'; END IF;

  v_provider := public.mkt_store_manage(v_booking.storefront_id)
    AND EXISTS (SELECT 1 FROM public.mkt_my_storefront(_account_key) s
                WHERE s.id = v_booking.storefront_id);
  v_customer := v_booking.customer_user_id = auth.uid()
    AND v_booking.customer_account_key = _account_key;
  IF NOT v_provider AND NOT v_customer THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_old := v_booking.status;
  IF v_customer THEN
    IF _action <> 'cancelled_by_customer'
       OR v_old NOT IN ('pending','confirmed') OR now() >= v_booking.starts_at THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    SELECT cancellation_window_hours INTO v_cancel_hours
    FROM public.mkt_service_settings WHERE storefront_id = v_booking.storefront_id;
    IF now() >= v_booking.starts_at - make_interval(hours => COALESCE(v_cancel_hours, 0)) THEN
      RAISE EXCEPTION 'cancellation_window_closed';
    END IF;
  ELSE
    IF NOT (
      (v_old = 'pending' AND _action IN ('confirmed','rejected','cancelled_by_provider'))
      OR (v_old = 'confirmed' AND _action IN ('en_route','in_progress','cancelled_by_provider','no_show'))
      OR (v_old = 'en_route' AND _action IN ('in_progress','cancelled_by_provider'))
      OR (v_old = 'in_progress' AND _action = 'completed')
    ) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    IF _action = 'no_show' AND now() < v_booking.starts_at THEN
      RAISE EXCEPTION 'too_early';
    END IF;
    IF _action = 'completed' AND now() < v_booking.starts_at THEN
      RAISE EXCEPTION 'too_early';
    END IF;
  END IF;

  UPDATE public.mkt_service_bookings SET
    status = _action,
    provider_notes = CASE WHEN v_provider AND NULLIF(btrim(COALESCE(_note,'')), '') IS NOT NULL
                          THEN btrim(_note) ELSE provider_notes END,
    cancellation_reason = CASE WHEN _action LIKE 'cancelled_%' OR _action = 'rejected'
                               THEN NULLIF(btrim(COALESCE(_note,'')), '') ELSE cancellation_reason END,
    cancelled_at = CASE WHEN _action LIKE 'cancelled_%' OR _action = 'rejected'
                        THEN now() ELSE cancelled_at END,
    confirmed_at = CASE WHEN _action = 'confirmed' THEN now() ELSE confirmed_at END,
    started_at = CASE WHEN _action = 'in_progress' THEN now() ELSE started_at END,
    completed_at = CASE WHEN _action = 'completed' THEN now() ELSE completed_at END
  WHERE id = _booking_id
  RETURNING * INTO v_booking;

  INSERT INTO public.mkt_service_booking_status_history (
    booking_id, old_status, new_status, changed_by_user_id, changed_by_account_key, note
  ) VALUES (_booking_id, v_old, _action, auth.uid(), _account_key,
            NULLIF(btrim(COALESCE(_note,'')), ''));

  IF v_provider AND v_booking.customer_user_id <> auth.uid() THEN
    INSERT INTO public.mkt_notifications (user_id, event, title, body)
    VALUES (v_booking.customer_user_id, 'service_booking_status', 'تحديث على حجزك',
            v_booking.booking_number || ' · ' || _action);
  ELSIF v_customer AND v_booking.provider_user_id <> auth.uid() THEN
    INSERT INTO public.mkt_notifications (user_id, event, title, body)
    VALUES (v_booking.provider_user_id, 'service_booking_status', 'تحديث على طلب الحجز',
            v_booking.booking_number || ' · ' || _action);
  END IF;

  RETURN to_jsonb(v_booking) - 'provider_user_id' - 'provider_tenant_id';
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_service_review_save(
  _booking_id uuid,
  _rating smallint,
  _comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_booking public.mkt_service_bookings;
  v_id uuid;
  v_status text := 'published';
  v_scan jsonb;
BEGIN
  SELECT * INTO v_booking FROM public.mkt_service_bookings b
  WHERE b.id = _booking_id AND b.customer_user_id = auth.uid() AND b.status = 'completed';
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'review_not_allowed'; END IF;
  IF _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid_rating'; END IF;

  v_scan := public.mkt_moderation_check_text(COALESCE(_comment,''));
  IF v_scan->>'action' = 'block' THEN RAISE EXCEPTION 'content_blocked'; END IF;
  IF v_scan->>'action' = 'review' THEN v_status := 'flagged'; END IF;

  INSERT INTO public.mkt_service_reviews (
    booking_id, storefront_id, professional_id, customer_user_id, rating, comment, status
  ) VALUES (
    v_booking.id, v_booking.storefront_id, v_booking.professional_id,
    auth.uid(), _rating, NULLIF(btrim(COALESCE(_comment,'')), ''), v_status
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    rating = EXCLUDED.rating, comment = EXCLUDED.comment,
    status = EXCLUDED.status, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_service_categories_public() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_directory(text,text,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_booking_context(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_slots(uuid,date,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_provider_setup(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_provider_save(text,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_create_booking(text,uuid,timestamptz,uuid,text,text,text,text,double precision,double precision,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_bookings_list(text,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_booking_action(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mkt_service_review_save(uuid,smallint,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mkt_service_categories_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_directory(text,text,uuid,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_booking_context(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_slots(uuid,date,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_provider_setup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_provider_save(text,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_create_booking(text,uuid,timestamptz,uuid,text,text,text,text,double precision,double precision,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_bookings_list(text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_booking_action(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_service_review_save(uuid,smallint,text) TO authenticated;

-- The original product-store submission function required pickup/delivery and a
-- delivery declaration. A service-only storefront instead fulfils bookings via
-- its service_modes, so review submission validates that canonical setting.
CREATE OR REPLACE FUNCTION public.mkt_store_submit(_storefront_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s public.mkt_storefronts;
  v_decl timestamptz;
  v_missing text[] := '{}';
  v_open integer;
BEGIN
  IF NOT public.mkt_store_manage(_storefront_id) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO s FROM public.mkt_storefronts WHERE id = _storefront_id AND deleted_at IS NULL;
  IF s.id IS NULL THEN RAISE EXCEPTION 'store not found'; END IF;
  IF s.status NOT IN ('draft','pending_review') THEN RAISE EXCEPTION 'store already submitted'; END IF;

  SELECT p.delivery_declaration_accepted_at INTO v_decl
  FROM public.mkt_store_private p WHERE p.storefront_id = s.id;

  IF COALESCE(trim(s.name_ar), '') = '' THEN v_missing := v_missing || 'name'; END IF;
  IF s.city_id IS NULL THEN v_missing := v_missing || 'city'; END IF;
  IF s.latitude IS NULL OR s.longitude IS NULL THEN v_missing := v_missing || 'location'; END IF;

  IF s.store_type = 'services' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mkt_service_settings x
      WHERE x.storefront_id = s.id AND cardinality(x.service_modes) > 0
    ) THEN v_missing := v_missing || 'fulfilment'; END IF;
  ELSE
    IF NOT s.pickup_enabled AND NOT s.merchant_delivery_enabled THEN
      v_missing := v_missing || 'fulfilment';
    END IF;
    IF s.merchant_delivery_enabled AND v_decl IS NULL THEN
      v_missing := v_missing || 'declaration';
    END IF;
  END IF;

  SELECT count(*) INTO v_open
  FROM public.mkt_store_hours h
  JOIN public.mkt_store_branches b ON b.id = h.branch_id
  WHERE b.storefront_id = s.id AND b.is_primary AND NOT h.is_closed;
  IF COALESCE(v_open, 0) = 0 THEN v_missing := v_missing || 'hours'; END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'missing', to_jsonb(v_missing));
  END IF;

  UPDATE public.mkt_storefronts SET status = 'pending_review', draft_step = 7, updated_at = now()
  WHERE id = s.id;
  INSERT INTO public.mkt_store_audit (
    storefront_id, actor_user_id, action, new_value
  ) VALUES (
    s.id, auth.uid(), 'store.submit_review', jsonb_build_object('from', s.status)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;
