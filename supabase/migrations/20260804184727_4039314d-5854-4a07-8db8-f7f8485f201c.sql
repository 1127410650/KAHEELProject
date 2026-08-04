create or replace function public.mkt_chat_blocked(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.mkt_call_blocks b
     where b.kind = 'block'
       and ((b.user_id = _a and b.blocked_user_id = _b)
         or (b.user_id = _b and b.blocked_user_id = _a))
  )
$$;

create or replace function public.mkt_chat_peer(_conversation_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select case when c.buyer_user_id = auth.uid() then c.seller_user_id else c.buyer_user_id end
    from public.mkt_conversations c where c.id = _conversation_id
$$;

create or replace function public.mkt_moderation_check_text(_t text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
DECLARE _n text; _score int := 0; _action text := 'allow'; _cat text; r record;
BEGIN
  _n := public.mkt_moderation_normalize(coalesce(_t, ''));
  IF _n = '' THEN RETURN jsonb_build_object('action','allow','score',0); END IF;
  FOR r IN SELECT * FROM public.mkt_moderation_rules WHERE is_active LOOP
    IF position(coalesce(r.normalized, public.mkt_moderation_normalize(r.pattern)) in _n) > 0 THEN
      _score := _score + coalesce(r.weight, 1);
      IF r.action = 'block' THEN _action := 'block'; _cat := r.category;
      ELSIF _action <> 'block' THEN _action := 'review'; _cat := coalesce(_cat, r.category);
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('action', _action, 'score', _score, 'category', _cat);
END $$;

create or replace function public.mkt_conversation_open(_listing_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); _owner uuid; _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.mkt_listing_is_public(_listing_id) THEN RAISE EXCEPTION 'listing_unavailable'; END IF;
  SELECT owner_user_id INTO _owner FROM public.mkt_listings WHERE id = _listing_id;
  IF _owner = _me THEN RAISE EXCEPTION 'self_conversation'; END IF;
  IF public.mkt_chat_blocked(_me, _owner) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF public.mkt_user_blocked(ARRAY['no_messaging']) THEN RAISE EXCEPTION 'restricted'; END IF;

  SELECT id INTO _id FROM public.mkt_conversations
   WHERE listing_id = _listing_id AND buyer_user_id = _me LIMIT 1;
  IF _id IS NOT NULL THEN
    UPDATE public.mkt_conversation_state SET hidden_at = NULL
      WHERE conversation_id = _id AND user_id = _me;
    RETURN _id;
  END IF;

  INSERT INTO public.mkt_conversations (listing_id, buyer_user_id)
  VALUES (_listing_id, _me) RETURNING id INTO _id;
  RETURN _id;
END $$;

create or replace function public.mkt_message_send(
  _conversation_id uuid, _kind text default 'text', _body text default '',
  _payload jsonb default '{}'::jsonb, _reply_to_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); _peer uuid; _id uuid; _scan jsonb; _state text := 'clean'; _recent int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _kind NOT IN ('text','image','video','audio','file','location','contact') THEN
    RAISE EXCEPTION 'unsupported_kind';
  END IF;

  _peer := public.mkt_chat_peer(_conversation_id);
  IF _peer IS NOT NULL AND public.mkt_chat_blocked(_me, _peer) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF public.mkt_user_blocked(ARRAY['no_messaging']) THEN RAISE EXCEPTION 'restricted'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.mkt_account_restrictions r
     WHERE r.subject_type = 'user' AND r.subject_id = _me
       AND r.restriction IN ('suspend_account','suspend_messaging')
       AND r.lifted_at IS NULL AND r.starts_at <= now()
       AND (r.expires_at IS NULL OR r.expires_at > now())
  ) THEN RAISE EXCEPTION 'restricted'; END IF;

  SELECT count(*) INTO _recent FROM public.mkt_messages
   WHERE sender_user_id = _me AND created_at > now() - interval '1 minute';
  IF _recent >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;

  IF _kind = 'text' AND coalesce(btrim(_body), '') = '' THEN RAISE EXCEPTION 'empty_message'; END IF;

  _scan := public.mkt_moderation_check_text(
    concat_ws(' ', _body, _payload->>'name', _payload->>'caption', _payload->>'label'));
  IF _scan->>'action' = 'block' THEN RAISE EXCEPTION 'content_blocked'; END IF;
  IF _scan->>'action' = 'review' THEN _state := 'review'; END IF;

  INSERT INTO public.mkt_messages (conversation_id, sender_user_id, body, kind, payload, reply_to_id, moderation_state)
  VALUES (_conversation_id, _me, coalesce(_body, ''), _kind, coalesce(_payload, '{}'::jsonb), _reply_to_id, _state)
  RETURNING id INTO _id;

  UPDATE public.mkt_conversations SET last_message_at = now() WHERE id = _conversation_id;

  IF _state = 'review' THEN
    INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, message_id, meta)
    VALUES ('message_flagged', _me, _conversation_id, _id,
            jsonb_build_object('score', _scan->'score', 'category', _scan->'category'));
  END IF;

  IF _peer IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.mkt_conversation_state s
       WHERE s.conversation_id = _conversation_id AND s.user_id = _peer AND s.muted) THEN
    INSERT INTO public.mkt_notifications (user_id, event, title)
    VALUES (_peer, 'chat_message', 'رسالة جديدة في السوق');
  END IF;

  RETURN _id;
END $$;

create or replace function public.mkt_messages_list(_conversation_id uuid, _limit int default 200)
returns table (
  id uuid, sender_user_id uuid, kind text, body text, payload jsonb,
  reply_to_id uuid, created_at timestamptz, read_at timestamptz, deleted_at timestamptz, mine boolean
) language sql stable security definer set search_path to 'public' as $$
  SELECT m.id, m.sender_user_id, m.kind,
         CASE WHEN m.deleted_at IS NOT NULL THEN '' ELSE m.body END,
         CASE WHEN m.deleted_at IS NOT NULL THEN '{}'::jsonb ELSE m.payload END,
         m.reply_to_id, m.created_at, m.read_at, m.deleted_at,
         m.sender_user_id = auth.uid()
    FROM public.mkt_messages m
   WHERE m.conversation_id = _conversation_id
     AND public.mkt_can_view_conversation(_conversation_id)
     AND NOT EXISTS (SELECT 1 FROM public.mkt_message_hides h
                      WHERE h.message_id = m.id AND h.user_id = auth.uid())
   ORDER BY m.created_at
   LIMIT greatest(1, least(_limit, 500));
$$;

create or replace function public.mkt_conversation_context(_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); c record; l record; _peer uuid; _peer_name text;
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.mkt_conversations WHERE id = _conversation_id;
  SELECT id, title, slug, price, currency_code, city, cover_image_url, status
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
    'listing_currency', l.currency_code,
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
END $$;

create or replace function public.mkt_conversation_state_set(
  _conversation_id uuid, _muted boolean default null, _hidden boolean default null)
returns void language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.mkt_conversation_state (conversation_id, user_id, muted, hidden_at)
  VALUES (_conversation_id, _me, coalesce(_muted, false),
          CASE WHEN _hidden THEN now() ELSE NULL END)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
     SET muted = coalesce(_muted, public.mkt_conversation_state.muted),
         hidden_at = CASE WHEN _hidden IS NULL THEN public.mkt_conversation_state.hidden_at
                          WHEN _hidden THEN now() ELSE NULL END;
END $$;

create or replace function public.mkt_chat_block_set(_conversation_id uuid, _blocked boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); _peer uuid;
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  _peer := public.mkt_chat_peer(_conversation_id);
  IF _peer IS NULL THEN RAISE EXCEPTION 'no_peer'; END IF;
  IF _blocked THEN
    INSERT INTO public.mkt_call_blocks (user_id, blocked_user_id, kind)
    SELECT _me, _peer, 'block'
     WHERE NOT EXISTS (SELECT 1 FROM public.mkt_call_blocks b
                        WHERE b.user_id = _me AND b.blocked_user_id = _peer AND b.kind = 'block');
  ELSE
    DELETE FROM public.mkt_call_blocks
     WHERE user_id = _me AND blocked_user_id = _peer AND kind = 'block';
  END IF;
  INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, meta)
  VALUES (CASE WHEN _blocked THEN 'block' ELSE 'unblock' END, _me, _conversation_id, '{}'::jsonb);
END $$;

create or replace function public.mkt_message_delete(_message_id uuid, _scope text default 'me')
returns void language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); m record;
BEGIN
  SELECT * INTO m FROM public.mkt_messages WHERE id = _message_id;
  IF m.id IS NULL OR NOT public.mkt_can_view_conversation(m.conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _scope = 'all' THEN
    IF m.sender_user_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF m.created_at < now() - interval '60 minutes' THEN RAISE EXCEPTION 'too_late'; END IF;
    UPDATE public.mkt_messages SET deleted_at = now(), deleted_by = _me WHERE id = _message_id;
    INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, message_id, meta)
    VALUES ('delete_all', _me, m.conversation_id, m.id, jsonb_build_object('kind', m.kind));
  ELSE
    INSERT INTO public.mkt_message_hides (message_id, user_id)
    VALUES (_message_id, _me) ON CONFLICT DO NOTHING;
  END IF;
END $$;

create or replace function public.mkt_bank_accounts_for(_account_key text)
returns table (id uuid, bank_name text, beneficiary_name text, last4 text, owner_label text)
language plpgsql stable security definer set search_path to 'public' as $$
DECLARE ctx record;
BEGIN
  SELECT * INTO ctx FROM public.mkt_account_context(_account_key);
  IF ctx IS NULL THEN RETURN; END IF;
  IF ctx.kind = 'business' THEN
    RETURN QUERY
      SELECT a.id, a.bank_name, a.beneficiary_name, right(replace(a.iban,' ',''), 4), ctx.name
        FROM public.mkt_bank_accounts a
       WHERE a.tenant_id = ctx.tenant_id AND a.status = 'verified' AND a.deleted_at IS NULL;
  ELSE
    RETURN QUERY
      SELECT a.id, a.bank_name, a.beneficiary_name, right(replace(a.iban,' ',''), 4), ctx.name
        FROM public.mkt_bank_accounts a
       WHERE a.tenant_id IS NULL AND a.owner_user_id = auth.uid()
         AND a.status = 'verified' AND a.deleted_at IS NULL;
  END IF;
END $$;

create or replace function public.mkt_bank_request_send(_conversation_id uuid, _account_key text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); ctx record; _id uuid; _peer uuid;
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO ctx FROM public.mkt_account_context(_account_key);
  IF ctx IS NULL THEN RAISE EXCEPTION 'account_required'; END IF;
  _peer := public.mkt_chat_peer(_conversation_id);
  IF _peer IS NOT NULL AND public.mkt_chat_blocked(_me, _peer) THEN RAISE EXCEPTION 'blocked'; END IF;

  INSERT INTO public.mkt_messages (conversation_id, sender_user_id, kind, body, payload)
  VALUES (_conversation_id, _me, 'bank_request', '',
          jsonb_build_object('status','pending','requester', ctx.name))
  RETURNING id INTO _id;
  UPDATE public.mkt_conversations SET last_message_at = now() WHERE id = _conversation_id;
  INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, message_id, meta)
  VALUES ('bank_request', _me, _conversation_id, _id, '{}'::jsonb);
  IF _peer IS NOT NULL THEN
    INSERT INTO public.mkt_notifications (user_id, event, title)
    VALUES (_peer, 'chat_bank_request', 'طلب مشاركة حساب بنكي موثق');
  END IF;
  RETURN _id;
END $$;

create or replace function public.mkt_bank_request_respond(_message_id uuid, _action text)
returns void language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); m record;
BEGIN
  SELECT * INTO m FROM public.mkt_messages WHERE id = _message_id AND kind = 'bank_request';
  IF m.id IS NULL OR NOT public.mkt_can_view_conversation(m.conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _action NOT IN ('cancel','decline') THEN RAISE EXCEPTION 'bad_action'; END IF;
  IF _action = 'cancel' AND m.sender_user_id <> _me THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action = 'decline' AND m.sender_user_id = _me THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.mkt_messages
     SET payload = payload || jsonb_build_object('status', CASE WHEN _action = 'cancel' THEN 'cancelled' ELSE 'declined' END)
   WHERE id = _message_id;
  INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, message_id, meta)
  VALUES ('bank_request_' || _action, _me, m.conversation_id, m.id, '{}'::jsonb);
END $$;

create or replace function public.mkt_bank_share(
  _conversation_id uuid, _bank_account_id uuid, _account_key text, _request_message_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
DECLARE _me uuid := auth.uid(); ctx record; a record; _id uuid; _peer uuid; _iban text;
BEGIN
  IF NOT public.mkt_can_view_conversation(_conversation_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO ctx FROM public.mkt_account_context(_account_key);
  IF ctx IS NULL THEN RAISE EXCEPTION 'account_required'; END IF;
  _peer := public.mkt_chat_peer(_conversation_id);
  IF _peer IS NOT NULL AND public.mkt_chat_blocked(_me, _peer) THEN RAISE EXCEPTION 'blocked'; END IF;

  SELECT * INTO a FROM public.mkt_bank_accounts
   WHERE id = _bank_account_id AND status = 'verified' AND deleted_at IS NULL;
  IF a.id IS NULL THEN RAISE EXCEPTION 'not_verified'; END IF;

  IF ctx.kind = 'business' THEN
    IF a.tenant_id IS DISTINCT FROM ctx.tenant_id THEN RAISE EXCEPTION 'account_mismatch'; END IF;
    IF NOT public.mkt_can_manage_business(ctx.tenant_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSE
    IF a.tenant_id IS NOT NULL OR a.owner_user_id <> _me THEN RAISE EXCEPTION 'account_mismatch'; END IF;
  END IF;

  _iban := upper(replace(a.iban, ' ', ''));

  INSERT INTO public.mkt_messages (conversation_id, sender_user_id, kind, body, payload)
  VALUES (_conversation_id, _me, 'bank_share', '',
          jsonb_build_object(
            'bank_name', a.bank_name,
            'beneficiary_name', a.beneficiary_name,
            'iban', _iban,
            'last4', right(_iban, 4),
            'verified', true,
            'sender_account', ctx.name))
  RETURNING id INTO _id;

  UPDATE public.mkt_conversations SET last_message_at = now() WHERE id = _conversation_id;

  IF _request_message_id IS NOT NULL THEN
    UPDATE public.mkt_messages SET payload = payload || jsonb_build_object('status','sent')
     WHERE id = _request_message_id AND kind = 'bank_request'
       AND conversation_id = _conversation_id;
  END IF;

  INSERT INTO public.mkt_chat_audit (event, actor_user_id, conversation_id, message_id, meta)
  VALUES ('bank_share', _me, _conversation_id, _id,
          jsonb_build_object('bank_account_id', a.id, 'last4', right(_iban, 4)));

  IF _peer IS NOT NULL THEN
    INSERT INTO public.mkt_notifications (user_id, event, title)
    VALUES (_peer, 'chat_bank_share', 'تمت مشاركة بيانات حساب بنكي موثق');
  END IF;
  RETURN _id;
END $$;

revoke execute on function public.mkt_chat_blocked(uuid, uuid) from anon;
revoke execute on function public.mkt_chat_peer(uuid) from anon;
revoke execute on function public.mkt_moderation_check_text(text) from anon;
revoke execute on function public.mkt_conversation_open(uuid) from anon;
revoke execute on function public.mkt_message_send(uuid, text, text, jsonb, uuid) from anon;
revoke execute on function public.mkt_messages_list(uuid, int) from anon;
revoke execute on function public.mkt_conversation_context(uuid) from anon;
revoke execute on function public.mkt_conversation_state_set(uuid, boolean, boolean) from anon;
revoke execute on function public.mkt_chat_block_set(uuid, boolean) from anon;
revoke execute on function public.mkt_message_delete(uuid, text) from anon;
revoke execute on function public.mkt_bank_accounts_for(text) from anon;
revoke execute on function public.mkt_bank_request_send(uuid, text) from anon;
revoke execute on function public.mkt_bank_request_respond(uuid, text) from anon;
revoke execute on function public.mkt_bank_share(uuid, uuid, text, uuid) from anon;