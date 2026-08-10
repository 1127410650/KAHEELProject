CREATE OR REPLACE FUNCTION public.mkt_listing_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_country uuid;
  v_city_country uuid;
  v_root_slug text;
  v_cat_parent uuid;
  v_sub_parent uuid;
  v_title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT public.mkt_is_platform_admin() THEN
      NEW.owner_user_id := auth.uid();
      IF NEW.tenant_id IS NOT NULL AND NOT public.mkt_can_publish_as_business(NEW.tenant_id) THEN
        RAISE EXCEPTION 'BUSINESS_NOT_ALLOWED';
      END IF;
    END IF;
  ELSE
    NEW.owner_user_id := OLD.owner_user_id;
    NEW.tenant_id := OLD.tenant_id;
  END IF;

  v_title := btrim(coalesce(NEW.title, ''));
  NEW.title := v_title;
  IF char_length(v_title) < 5 OR char_length(v_title) > 120 THEN
    RAISE EXCEPTION 'TITLE_LENGTH';
  END IF;
  IF v_title !~ '[[:alnum:]]' THEN
    RAISE EXCEPTION 'TITLE_INVALID';
  END IF;

  -- The country always comes from the owner's account, never from the client.
  IF NEW.owner_user_id IS NOT NULL THEN
    v_account_country := public.mkt_account_country_id(NEW.owner_user_id);
  END IF;
  IF v_account_country IS NULL THEN
    SELECT id INTO v_account_country FROM public.mkt_countries
      WHERE iso2 = 'SA' AND is_active ORDER BY sort_order LIMIT 1;
  END IF;
  IF v_account_country IS NOT NULL THEN
    NEW.country_id := v_account_country;
  END IF;

  IF NEW.city_id IS NOT NULL THEN
    SELECT country_id INTO v_city_country FROM public.mkt_cities WHERE id = NEW.city_id;
    IF v_city_country IS NULL OR v_city_country IS DISTINCT FROM NEW.country_id THEN
      RAISE EXCEPTION 'CITY_COUNTRY_MISMATCH';
    END IF;
  END IF;

  IF NEW.category_id IS NOT NULL THEN
    SELECT parent_id, slug INTO v_cat_parent, v_root_slug
      FROM public.mkt_categories WHERE id = NEW.category_id AND is_active;
    IF v_root_slug IS NULL OR v_cat_parent IS NOT NULL THEN
      RAISE EXCEPTION 'CATEGORY_INVALID';
    END IF;
  END IF;
  IF NEW.subcategory_id IS NOT NULL THEN
    SELECT parent_id INTO v_sub_parent
      FROM public.mkt_categories WHERE id = NEW.subcategory_id AND is_active;
    IF v_sub_parent IS NULL OR v_sub_parent IS DISTINCT FROM NEW.category_id THEN
      RAISE EXCEPTION 'CATEGORY_PATH_INVALID';
    END IF;
  END IF;

  IF NEW.type_code LIKE 'property\_%' AND v_root_slug IS DISTINCT FROM 'real-estate' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;
  IF NEW.type_code LIKE 'equipment\_%' AND v_root_slug IS DISTINCT FROM 'equipment' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;
  IF v_root_slug = 'real-estate' AND NEW.type_code NOT LIKE 'property\_%' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;
  IF v_root_slug = 'equipment' AND NEW.type_code NOT LIKE 'equipment\_%'
     AND NEW.type_code <> 'need_supplier' THEN
    RAISE EXCEPTION 'TYPE_CATEGORY_MISMATCH';
  END IF;

  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.latitude := NULL; NEW.longitude := NULL; NEW.location_accuracy := NULL;
  END IF;

  RETURN NEW;
END; $function$;