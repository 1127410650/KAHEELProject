CREATE OR REPLACE FUNCTION public.mkt_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.mkt_canvas_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  artboard_ratio text NOT NULL DEFAULT '16/5',
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  preview_path text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mkt_canvas_designs_name_chk CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT mkt_canvas_designs_ratio_chk CHECK (artboard_ratio IN ('16/5','4/3','1/1','9/16','16/7')),
  CONSTRAINT mkt_canvas_designs_elements_chk CHECK (jsonb_typeof(elements) = 'array' AND jsonb_array_length(elements) <= 40)
);
GRANT SELECT ON public.mkt_canvas_designs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_canvas_designs TO authenticated;
GRANT ALL ON public.mkt_canvas_designs TO service_role;
ALTER TABLE public.mkt_canvas_designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canvas designs readable when live" ON public.mkt_canvas_designs FOR SELECT TO anon, authenticated USING (deleted_at IS NULL);
CREATE POLICY "platform admin reads all canvas designs" ON public.mkt_canvas_designs FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());
CREATE POLICY "platform admin creates canvas designs" ON public.mkt_canvas_designs FOR INSERT TO authenticated WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY "platform admin edits canvas designs" ON public.mkt_canvas_designs FOR UPDATE TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE TRIGGER mkt_canvas_designs_touch BEFORE UPDATE ON public.mkt_canvas_designs FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

CREATE TABLE public.mkt_custom_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  design_id uuid NOT NULL REFERENCES public.mkt_canvas_designs(id) ON DELETE RESTRICT,
  zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT mkt_custom_blocks_name_chk CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT mkt_custom_blocks_zones_chk CHECK (jsonb_typeof(zones) = 'array' AND jsonb_array_length(zones) <= 6)
);
CREATE INDEX mkt_custom_blocks_design_idx ON public.mkt_custom_blocks(design_id);
GRANT SELECT ON public.mkt_custom_blocks TO anon;
GRANT SELECT, INSERT, UPDATE ON public.mkt_custom_blocks TO authenticated;
GRANT ALL ON public.mkt_custom_blocks TO service_role;
ALTER TABLE public.mkt_custom_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom blocks readable when live" ON public.mkt_custom_blocks FOR SELECT TO anon, authenticated USING (deleted_at IS NULL);
CREATE POLICY "platform admin reads all custom blocks" ON public.mkt_custom_blocks FOR SELECT TO authenticated USING (public.mkt_is_platform_admin());
CREATE POLICY "platform admin creates custom blocks" ON public.mkt_custom_blocks FOR INSERT TO authenticated WITH CHECK (public.mkt_is_platform_admin());
CREATE POLICY "platform admin edits custom blocks" ON public.mkt_custom_blocks FOR UPDATE TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE TRIGGER mkt_custom_blocks_touch BEFORE UPDATE ON public.mkt_custom_blocks FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

ALTER TABLE public.mkt_page_blocks DROP CONSTRAINT mkt_page_blocks_type_chk;
ALTER TABLE public.mkt_page_blocks ADD CONSTRAINT mkt_page_blocks_type_chk CHECK (block_type = ANY (ARRAY['hero_image','hero_gradient','search_field','text_strip','campaign_mosaic','sponsored_banner','category_grid','listing_rail','type_cards','city_circles','link_tile','design_banner','spacer','shape_layer','quick_tiles','pride_strip','exclusive_offers','stories_rail','category_marquee','jeeb_li','custom_block']));

CREATE TABLE public.mkt_platform_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  adapter text NOT NULL,
  provider text NOT NULL,
  name_ar text NOT NULL,
  secret_name text,
  signup_url text,
  unit_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  monthly_cap_usd numeric(10,2) NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_platform_integrations_adapter_chk CHECK (adapter IN ('image_generate','image_enhance','text_generate','translate')),
  CONSTRAINT mkt_platform_integrations_cap_chk CHECK (monthly_cap_usd >= 0 AND monthly_cap_usd <= 5000)
);
GRANT SELECT, INSERT, UPDATE ON public.mkt_platform_integrations TO authenticated;
GRANT ALL ON public.mkt_platform_integrations TO service_role;
ALTER TABLE public.mkt_platform_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin manages integrations" ON public.mkt_platform_integrations FOR ALL TO authenticated USING (public.mkt_is_platform_admin()) WITH CHECK (public.mkt_is_platform_admin());
CREATE TRIGGER mkt_platform_integrations_touch BEFORE UPDATE ON public.mkt_platform_integrations FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at();

INSERT INTO public.mkt_platform_integrations (code, adapter, provider, name_ar, secret_name, signup_url, unit_cost_usd)
VALUES
  ('generation', 'image_generate', 'lovable-ai-gateway', 'توليد الصور', 'LOVABLE_API_KEY', 'https://docs.lovable.dev', 0.0200),
  ('enhancement', 'image_enhance', 'replicate-real-esrgan', 'تحسين الصور — النصاعة', 'IMAGE_ENHANCE_API_KEY', 'https://replicate.com/account/api-tokens', 0.0025);