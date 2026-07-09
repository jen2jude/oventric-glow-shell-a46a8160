
-- Products table for marketplace
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('themes','plugins','blocks','scripts')),
  description TEXT NOT NULL DEFAULT '',
  price_usd NUMERIC(10,2) NOT NULL CHECK (price_usd >= 0),
  hue TEXT NOT NULL DEFAULT 'from-emerald-500 to-teal-700',
  cover_path TEXT,
  file_path TEXT,
  external_url TEXT,
  vendor TEXT NOT NULL DEFAULT '',
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
  reviews INTEGER NOT NULL DEFAULT 0,
  promoted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Sellers insert own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers update own products"
  ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers delete own products"
  ON public.products FOR DELETE TO authenticated
  USING (auth.uid() = seller_id);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_usd NUMERIC(10,2) NOT NULL,
  total_usd NUMERIC(12,2) NOT NULL,
  display_currency public.wallet_currency NOT NULL DEFAULT 'USD',
  display_total NUMERIC(14,2) NOT NULL,
  fx_rate NUMERIC(14,6) NOT NULL DEFAULT 1,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('wallet','card','bank','mobile_money','ussd')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  download_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers insert own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers update own pending orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);

-- Wallet debit function (SECURITY DEFINER, balance-checked)
CREATE OR REPLACE FUNCTION public.wallet_debit(_user_id UUID, _amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bal NUMERIC;
BEGIN
  IF _amount <= 0 THEN RETURN false; END IF;
  SELECT available_balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN RETURN false; END IF;
  UPDATE public.wallets SET available_balance = available_balance - _amount, updated_at = now()
    WHERE user_id = _user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_credit(_user_id UUID, _amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (_user_id, 'USD', _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance = public.wallets.available_balance + _amount, updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wallet_debit(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_debit(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_credit(UUID, NUMERIC) TO service_role;
