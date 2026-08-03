CREATE OR REPLACE FUNCTION public.mkt_guard_listing_status()
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
       AND NOT public.mkt_is_platform_admin()
       AND NOT (NEW.status = 'suspended' AND public.mkt_is_system_action())
       -- resume/renew of an ad the reviewers already approved once
       AND NOT (NEW.status = 'published' AND public.mkt_is_listing_op() AND OLD.published_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Only platform reviewers can set status %', NEW.status;
    END IF;
    IF NEW.status = 'rejected' AND coalesce(btrim(NEW.rejection_reason),'') = '' THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN
      NEW.published_at := coalesce(OLD.published_at, now());
    END IF;
  END IF;
  RETURN NEW;
END $$;