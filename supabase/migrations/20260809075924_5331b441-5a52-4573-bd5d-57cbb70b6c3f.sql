-- ============================================================
-- Stage 2: provider offers  |  Stage 3: ad credit wallet
-- ============================================================

CREATE TABLE public.mkt_store_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL REFERENCES public.mkt_storefronts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  applies_to_all boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_store_offers_discount_type_chk CHECK (discount_type IN ('percent','amount')),
  CONSTRAINT mkt_store_offers_discount_value_chk CHECK (
    discount_value >= 0 AND (discount_type <> 'percent' OR discount_value <= 100)
  ),
  CONSTRAINT mkt_store_offers_title_chk CHECK (char_length(btrim(title)) BETWEEN 2 AND 120)
);

CREATE INDEX mkt_store_offers_storefront_idx
  ON public.mkt_store_offers (storefront_id, is_active, starts_at DESC);

CREATE TABLE public.mkt_store_offer_items (
  offer_id uuid NOT NULL REFERENCES public.mkt_store_offers(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mkt_store_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, item_id)
);

CREATE INDEX mkt_store_offer_items_item_idx ON public.mkt_store_offer_items (item_id);

GRANT SELECT ON public.mkt_store_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_store_offers TO authenticated;
GRANT ALL ON public.mkt_store_offers TO service_role;
GRANT SELECT ON public.mkt_store_offer_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_store_offer_items TO authenticated;
GRANT ALL ON public.mkt_store_offer_items TO service_role;

ALTER TABLE public.mkt_store_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_store_offer_items ENABLE ROW LEVEL SECURITY;

-- A live offer of a published store is public marketing content.
CREATE POLICY "mkt_store_offers_public_read"
  ON public.mkt_store_offers FOR SELECT TO anon, authenticated
  USING (
    archived_at IS NULL
    AND is_active
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
    AND EXISTS (
      SELECT 1 FROM public.mkt_storefronts s
      WHERE s.id = mkt_store_offers.storefront_id
        AND s.deleted_at IS NULL
        AND s.status = 'published'
    )
  );

-- The owner also needs its paused / expired / archived offers, which the
-- public policy filters out.
CREATE POLICY "mkt_store_offers_owner_read"
  ON public.mkt_store_offers FOR SELECT TO authenticated
  USING (public.mkt_store_manage(storefront_id));

CREATE POLICY "mkt_store_offers_owner_write"
  ON public.mkt_store_offers FOR INSERT TO authenticated
  WITH CHECK (public.mkt_store_manage(storefront_id) AND created_by = auth.uid());

CREATE POLICY "mkt_store_offers_owner_update"
  ON public.mkt_store_offers FOR UPDATE TO authenticated
  USING (public.mkt_store_manage(storefront_id))
  WITH CHECK (public.mkt_store_manage(storefront_id));

CREATE POLICY "mkt_store_offers_owner_delete"
  ON public.mkt_store_offers FOR DELETE TO authenticated
  USING (public.mkt_store_manage(storefront_id));

CREATE POLICY "mkt_store_offers_admin_read"
  ON public.mkt_store_offers FOR SELECT TO authenticated
  USING (public.mkt_admin_can('listings.view'));

CREATE POLICY "mkt_store_offer_items_public_read"
  ON public.mkt_store_offer_items FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_store_offers o
      JOIN public.mkt_storefronts s ON s.id = o.storefront_id
      WHERE o.id = mkt_store_offer_items.offer_id
        AND o.archived_at IS NULL AND o.is_active
        AND o.starts_at <= now()
        AND (o.ends_at IS NULL OR o.ends_at > now())
        AND s.deleted_at IS NULL AND s.status = 'published'
    )
  );

CREATE POLICY "mkt_store_offer_items_owner_all"
  ON public.mkt_store_offer_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_store_offers o
      WHERE o.id = mkt_store_offer_items.offer_id
        AND public.mkt_store_manage(o.storefront_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.mkt_store_offers o
      JOIN public.mkt_store_items i ON i.id = mkt_store_offer_items.item_id
      WHERE o.id = mkt_store_offer_items.offer_id
        AND i.storefront_id = o.storefront_id
        AND public.mkt_store_manage(o.storefront_id)
    )
  );

CREATE TRIGGER mkt_store_offers_updated_at
  BEFORE UPDATE ON public.mkt_store_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- An offer must never move to another storefront after creation.
CREATE OR REPLACE FUNCTION public.mkt_store_offers_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  NEW.storefront_id := OLD.storefront_id;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_store_offers_freeze() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER aa_mkt_store_offers_freeze
  BEFORE UPDATE ON public.mkt_store_offers
  FOR EACH ROW EXECUTE FUNCTION public.mkt_store_offers_freeze();

-- ---------- ad credit wallet ----------
CREATE TABLE public.mkt_ad_credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  total_consumed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_ad_credit_wallets_balance_chk CHECK (balance >= 0)
);

CREATE UNIQUE INDEX mkt_ad_credit_wallets_tenant_key
  ON public.mkt_ad_credit_wallets (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX mkt_ad_credit_wallets_user_key
  ON public.mkt_ad_credit_wallets (owner_user_id) WHERE tenant_id IS NULL;

CREATE TABLE public.mkt_ad_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.mkt_ad_credit_wallets(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'settled',
  amount integer NOT NULL,
  balance_after integer,
  price_sar numeric(12,2),
  payment_ref text,
  reference_type text,
  reference_id uuid,
  note text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_ad_credit_entries_kind_chk
    CHECK (kind IN ('purchase','admin_grant','consume','adjustment','refund')),
  CONSTRAINT mkt_ad_credit_entries_status_chk
    CHECK (status IN ('pending','settled','cancelled')),
  CONSTRAINT mkt_ad_credit_entries_amount_chk CHECK (amount <> 0)
);

CREATE INDEX mkt_ad_credit_entries_wallet_idx
  ON public.mkt_ad_credit_entries (wallet_id, created_at DESC);

GRANT SELECT ON public.mkt_ad_credit_wallets TO authenticated;
GRANT ALL ON public.mkt_ad_credit_wallets TO service_role;
GRANT SELECT ON public.mkt_ad_credit_entries TO authenticated;
GRANT ALL ON public.mkt_ad_credit_entries TO service_role;

ALTER TABLE public.mkt_ad_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_ad_credit_entries ENABLE ROW LEVEL SECURITY;

-- Balances are written only by the definer functions below, so clients get
-- read-only access to their own wallet and platform admins see all.
CREATE POLICY "mkt_ad_credit_wallets_owner_read"
  ON public.mkt_ad_credit_wallets FOR SELECT TO authenticated
  USING (
    (tenant_id IS NULL AND owner_user_id = auth.uid())
    OR (tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(tenant_id))
  );

CREATE POLICY "mkt_ad_credit_wallets_admin_read"
  ON public.mkt_ad_credit_wallets FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage'));

CREATE POLICY "mkt_ad_credit_entries_owner_read"
  ON public.mkt_ad_credit_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mkt_ad_credit_wallets w
      WHERE w.id = mkt_ad_credit_entries.wallet_id
        AND (
          (w.tenant_id IS NULL AND w.owner_user_id = auth.uid())
          OR (w.tenant_id IS NOT NULL AND public.mkt_tenant_operational_allowed(w.tenant_id))
        )
    )
  );

CREATE POLICY "mkt_ad_credit_entries_admin_read"
  ON public.mkt_ad_credit_entries FOR SELECT TO authenticated
  USING (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage'));

CREATE TRIGGER mkt_ad_credit_wallets_updated_at
  BEFORE UPDATE ON public.mkt_ad_credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- wallet RPCs ----------
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_wallet(_tenant_id uuid DEFAULT NULL)
RETURNS public.mkt_ad_credit_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  wallet public.mkt_ad_credit_wallets;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _tenant_id IS NOT NULL AND NOT public.mkt_tenant_operational_allowed(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO wallet FROM public.mkt_ad_credit_wallets w
  WHERE (_tenant_id IS NULL AND w.tenant_id IS NULL AND w.owner_user_id = auth.uid())
     OR (_tenant_id IS NOT NULL AND w.tenant_id = _tenant_id);

  IF wallet.id IS NULL THEN
    INSERT INTO public.mkt_ad_credit_wallets (owner_user_id, tenant_id)
    VALUES (auth.uid(), _tenant_id)
    RETURNING * INTO wallet;
  END IF;

  RETURN wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_wallet(uuid) TO authenticated;

-- Purchases stay `pending` until a payment provider settles them later; no
-- external keys are needed today and no balance moves until settlement.
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_request_purchase(
  _amount integer,
  _price_sar numeric DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  wallet public.mkt_ad_credit_wallets;
  entry_id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  wallet := public.mkt_ad_credit_wallet(_tenant_id);

  INSERT INTO public.mkt_ad_credit_entries
    (wallet_id, kind, status, amount, price_sar, actor_user_id)
  VALUES (wallet.id, 'purchase', 'pending', _amount, _price_sar, auth.uid())
  RETURNING id INTO entry_id;

  RETURN entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_request_purchase(integer, numeric, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_consume(
  _amount integer,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  wallet public.mkt_ad_credit_wallets;
  new_balance integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  wallet := public.mkt_ad_credit_wallet(_tenant_id);

  UPDATE public.mkt_ad_credit_wallets
     SET balance = balance - _amount,
         total_consumed = total_consumed + _amount
   WHERE id = wallet.id AND balance >= _amount
   RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credit';
  END IF;

  INSERT INTO public.mkt_ad_credit_entries
    (wallet_id, kind, amount, balance_after, reference_type, reference_id, actor_user_id)
  VALUES (wallet.id, 'consume', -_amount, new_balance, _reference_type, _reference_id, auth.uid());

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_consume(integer, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_consume(integer, text, uuid, uuid) TO authenticated;

-- Admin grant / adjust: platform admins or staff holding `ads.credit_manage`.
CREATE OR REPLACE FUNCTION public.mkt_ad_credit_admin_grant(
  _wallet_id uuid,
  _amount integer,
  _kind text DEFAULT 'admin_grant',
  _note text DEFAULT NULL,
  _price_sar numeric DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _kind NOT IN ('admin_grant','purchase','adjustment','refund') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  IF _amount IS NULL OR _amount = 0 OR abs(_amount) > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.mkt_ad_credit_wallets
     SET balance = balance + _amount,
         total_purchased = total_purchased + GREATEST(_amount, 0)
   WHERE id = _wallet_id AND balance + _amount >= 0
   RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found_or_negative';
  END IF;

  INSERT INTO public.mkt_ad_credit_entries
    (wallet_id, kind, amount, balance_after, note, price_sar, actor_user_id)
  VALUES (_wallet_id, _kind, _amount, new_balance, _note, _price_sar, auth.uid());

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_admin_grant(uuid, integer, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_admin_grant(uuid, integer, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_ad_credit_admin_settle(_entry_id uuid, _payment_ref text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  entry public.mkt_ad_credit_entries;
  new_balance integer;
BEGIN
  IF NOT (public.mkt_is_platform_admin() OR public.mkt_staff_has('ads.credit_manage')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO entry FROM public.mkt_ad_credit_entries
   WHERE id = _entry_id AND kind = 'purchase' AND status = 'pending'
   FOR UPDATE;
  IF entry.id IS NULL THEN
    RAISE EXCEPTION 'entry_not_pending';
  END IF;

  UPDATE public.mkt_ad_credit_wallets
     SET balance = balance + entry.amount,
         total_purchased = total_purchased + entry.amount
   WHERE id = entry.wallet_id
   RETURNING balance INTO new_balance;

  UPDATE public.mkt_ad_credit_entries
     SET status = 'settled',
         balance_after = new_balance,
         payment_ref = COALESCE(_payment_ref, payment_ref)
   WHERE id = _entry_id;

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.mkt_ad_credit_admin_settle(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_ad_credit_admin_settle(uuid, text) TO authenticated;