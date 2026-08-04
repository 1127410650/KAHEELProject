CREATE OR REPLACE FUNCTION public.mkt_conversation_context(_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); c record; l record; _peer uuid; _peer_name text;
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.mkt_conversations WHERE id = _conversation_id;
  SELECT id, title, slug, price, currency, city, cover_image_url, status
    INTO l FROM public.mkt_listings WHERE id = c.listing_id;
  _peer := CASE WHEN c.buyer_user_id = _me THEN c.seller_user_id ELSE c.buyer_user_id END;

  IF c.seller_tenant_id IS NOT NULL AND c.buyer_user_id = _me THEN
    SELECT b.display_name_ar INTO _peer_name FROM public.mkt_business_profiles b
     WHERE b.tenant_id = c.seller_tenant_id;
  ELSE
    SELECT p.display_name INTO _peer_name FROM public.mkt_user_profiles p WHERE p.user_id = _peer;
  END IF;

  RETURN jsonb_build_object(
    'conversation_id', c.id,
    'listing_id', l.id,
    'listing_title', l.title,
    'listing_slug', l.slug,
    'listing_price', l.price,
    'listing_currency', l.currency,
    'listing_city', l.city,
    'listing_cover', l.cover_image_url,
    'listing_status', l.status,
    'peer_name', coalesce(_peer_name, 'مستخدم'),
    'is_seller_side', (c.buyer_user_id <> _me),
    'blocked', coalesce(public.mkt_chat_blocked(_me, _peer), false),
    'muted', coalesce((SELECT s.muted FROM public.mkt_conversation_state s
                        WHERE s.conversation_id = c.id AND s.user_id = _me), false),
    'message_count', (SELECT count(*) FROM public.mkt_messages m WHERE m.conversation_id = c.id)
  );
END $function$;